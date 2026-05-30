import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { validateOnlinePurchase } from "@/lib/order-rules";
import { resolveAppUrl, resolveCheckoutFeeItems } from "@/lib/platform-config";
import { calculateCheckoutAmounts } from "@/lib/checkout-fees";
import { ORDER_KIND } from "@/lib/order-kind";
import { generateTicketsForPaidOrder } from "@/lib/tickets";
import { sendOrderTicketsEmail } from "@/lib/email";
import {
  resolveMercadoPagoContextForEvent,
  serializeMercadoPagoSnapshot
} from "@/lib/application/payments/resolve-mercadopago-context";
import { isSerializationConflict } from "@/lib/application/payments/create-mercadopago-checkout";

export const runtime = "nodejs";

const SERIALIZABLE_RETRY_ATTEMPTS = 3;

const schema = z.object({
  eventId: z.string().min(1),
  ticketTypeId: z.string().min(1),
  quantity: z.number().int().min(1).max(100),
  buyerName: z.string().min(2),
  buyerEmail: z.string().email(),
  buyerPhone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value?.trim() ? value.trim() : undefined))
    .refine((value) => !value || (value.length >= 6 && value.length <= 30 && /^[0-9+().\-\s]+$/.test(value)), "Telefono invalido"),
  couponCode: z.string().trim().max(40).optional()
});

export async function POST(request: Request) {
  try {
    const data = schema.parse(await request.json());
    const commercialContext = await resolveMercadoPagoContextForEvent(data.eventId);
    const feeItems = await resolveCheckoutFeeItems();

    let transactionResult:
      | {
          orderId: string;
          eventSlug: string;
        }
      | null = null;

    for (let attempt = 1; attempt <= SERIALIZABLE_RETRY_ATTEMPTS; attempt += 1) {
      try {
        transactionResult = await db.$transaction(
          async (tx) => {
            const validated = await validateOnlinePurchase(tx, {
              eventId: data.eventId,
              ticketTypeId: data.ticketTypeId,
              quantity: data.quantity,
              buyerEmail: data.buyerEmail,
              couponCode: data.couponCode
            });

            if (validated.coupon) {
              const updatedCoupon = await tx.coupon.updateMany({
                where: {
                  id: validated.coupon.id,
                  isActive: true,
                  usedCount: { lt: validated.coupon.maxUses }
                },
                data: {
                  usedCount: { increment: 1 }
                }
              });

              if (updatedCoupon.count === 0) {
                throw new Error("El cupon alcanzo su limite de uso");
              }
            }

            const amounts = calculateCheckoutAmounts(validated.discountedSubtotalCents, feeItems);
            if (amounts.totalCents !== 0) {
              throw new Error("Este registro no es gratuito");
            }

            const order = await tx.order.create({
              data: {
                eventId: data.eventId,
                ticketTypeId: data.ticketTypeId,
                clientId: commercialContext.snapshot.clientId,
                merchantAccountId: commercialContext.snapshot.merchantAccountId,
                kind: ORDER_KIND.ONLINE,
                commercialModel: commercialContext.snapshot.mode,
                platformCommissionRateBps: commercialContext.commissionRateBps,
                quantity: data.quantity,
                totalCents: 0,
                subtotalCents: validated.baseSubtotalCents,
                discountCents: validated.discountCents,
                buyerName: data.buyerName,
                buyerEmail: validated.normalizedEmail,
                buyerPhone: data.buyerPhone ?? null,
                couponId: validated.coupon?.id ?? null,
                merchantSnapshot: serializeMercadoPagoSnapshot(commercialContext.snapshot)
              },
              select: {
                id: true,
                ticketType: {
                  select: {
                    event: {
                      select: {
                        slug: true
                      }
                    }
                  }
                }
              }
            });

            return {
              orderId: order.id,
              eventSlug: order.ticketType.event.slug
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
        break;
      } catch (error) {
        if (attempt < SERIALIZABLE_RETRY_ATTEMPTS && isSerializationConflict(error)) {
          continue;
        }
        throw error;
      }
    }

    if (!transactionResult) {
      throw new Error("No se pudo crear el registro gratuito");
    }

    const freePaymentId = `FREE-${randomUUID().slice(0, 8).toUpperCase()}`;
    await generateTicketsForPaidOrder(transactionResult.orderId, freePaymentId);

    let emailSent = false;
    try {
      await sendOrderTicketsEmail(transactionResult.orderId, { trigger: "FREE_REGISTRATION" });
      emailSent = true;
    } catch (error) {
      console.error(`[free-orders] email failed for order ${transactionResult.orderId}`, error);
    }

    return NextResponse.json({
      orderId: transactionResult.orderId,
      emailSent,
      successUrl: `${resolveAppUrl()}/success?event=${encodeURIComponent(transactionResult.eventSlug)}&order=${encodeURIComponent(transactionResult.orderId)}`
    });
  } catch (error) {
    if (isSerializationConflict(error)) {
      return NextResponse.json({ error: "Conflicto de concurrencia. Reintenta el registro." }, { status: 409 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo completar el registro gratuito"
      },
      { status: 400 }
    );
  }
}
