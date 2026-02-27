import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { createPreference } from "@/lib/mercadopago";
import { validateOnlinePurchase } from "@/lib/order-rules";
import { resolveAppUrl, resolveCheckoutFeeItems } from "@/lib/platform-config";
import { calculateCheckoutAmounts } from "@/lib/checkout-fees";

export const runtime = "nodejs";
const SERIALIZABLE_RETRY_ATTEMPTS = 3;

const schema = z.object({
  eventId: z.string().min(1),
  ticketTypeId: z.string().min(1),
  quantity: z.number().int().min(1).max(100),
  buyerName: z.string().min(2),
  buyerEmail: z.string().email(),
  couponCode: z.string().trim().max(40).optional()
});

function isSerializationConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

export async function POST(request: Request) {
  try {
    const data = schema.parse(await request.json());

    let transactionResult:
      | {
          order: { id: string };
          buyerEmail: string;
          ticketType: { event: { name: string; slug: string }; name: string; priceCents: number };
          quantity: number;
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

            const order = await tx.order.create({
              data: {
                eventId: data.eventId,
                ticketTypeId: data.ticketTypeId,
                quantity: data.quantity,
                totalCents: 0,
                buyerName: data.buyerName,
                buyerEmail: validated.normalizedEmail,
                couponId: validated.coupon?.id ?? null
              },
              select: { id: true }
            });

            return {
              order,
              buyerEmail: validated.normalizedEmail,
              ticketType: {
                event: { name: validated.ticketType.event.name, slug: validated.ticketType.event.slug },
                name: validated.ticketType.name,
                priceCents: validated.ticketType.priceCents
              },
              quantity: data.quantity
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
      throw new Error("No se pudo crear la orden");
    }

    const { order, ticketType, buyerEmail, quantity } = transactionResult;
    const feeItems = await resolveCheckoutFeeItems();
    const amounts = calculateCheckoutAmounts(ticketType.priceCents * quantity, feeItems);

    await db.order.update({
      where: { id: order.id },
      data: { totalCents: amounts.totalCents }
    });

    const appUrl = resolveAppUrl();
    const encodedEventSlug = encodeURIComponent(ticketType.event.slug);

    const preference = await createPreference({
      title: `${ticketType.event.name} - Compra de entradas`,
      unitPrice: amounts.totalCents / 100,
      quantity: 1,
      payerEmail: buyerEmail,
      externalReference: order.id,
      successUrl: `${appUrl}/success?event=${encodedEventSlug}&order=${encodeURIComponent(order.id)}`,
      failureUrl: `${appUrl}/failure?event=${encodedEventSlug}&order=${encodeURIComponent(order.id)}`,
      pendingUrl: `${appUrl}/pending?event=${encodedEventSlug}&order=${encodeURIComponent(order.id)}`,
      webhookUrl: `${appUrl}/api/mercadopago/webhook`
    });

    await db.order.update({
      where: { id: order.id },
      data: {
        mercadoPagoRef: preference.id,
        mercadoPagoInit: preference.init_point ?? preference.sandbox_init_point
      }
    });

    return NextResponse.json({
      orderId: order.id,
      initPoint: preference.init_point ?? preference.sandbox_init_point
    });
  } catch (error) {
    if (isSerializationConflict(error)) {
      return NextResponse.json({ error: "Conflicto de concurrencia. Reintenta la compra." }, { status: 409 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo crear la orden"
      },
      { status: 400 }
    );
  }
}
