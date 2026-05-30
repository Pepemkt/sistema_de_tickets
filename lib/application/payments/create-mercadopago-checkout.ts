import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createPreference } from "@/lib/mercadopago";
import { validateOnlinePurchase } from "@/lib/order-rules";
import { ORDER_KIND } from "@/lib/order-kind";
import { calculateCheckoutAmounts } from "@/lib/checkout-fees";
import { resolveAppUrl, resolveCheckoutFeeItems } from "@/lib/platform-config";
import {
  resolveMercadoPagoContextForEvent,
  serializeMercadoPagoSnapshot
} from "@/lib/application/payments/resolve-mercadopago-context";

const SERIALIZABLE_RETRY_ATTEMPTS = 3;

function isSerializationConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

export type CreateMercadoPagoCheckoutInput = {
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  couponCode?: string;
};

export async function createMercadoPagoCheckout(input: CreateMercadoPagoCheckoutInput) {
  const commercialContext = await resolveMercadoPagoContextForEvent(input.eventId);
  if (!commercialContext.configured || !commercialContext.accessToken) {
    throw new Error("Credenciales de Mercado Pago no configuradas para este evento");
  }

  let transactionResult:
    | {
        order: { id: string };
        buyerEmail: string;
        ticketType: { event: { name: string; slug: string }; name: string; priceCents: number };
        discountedSubtotalCents: number;
      }
    | null = null;

  for (let attempt = 1; attempt <= SERIALIZABLE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      transactionResult = await db.$transaction(
        async (tx) => {
          const validated = await validateOnlinePurchase(tx, {
            eventId: input.eventId,
            ticketTypeId: input.ticketTypeId,
            quantity: input.quantity,
            buyerEmail: input.buyerEmail,
            couponCode: input.couponCode
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
              eventId: input.eventId,
              ticketTypeId: input.ticketTypeId,
              clientId: commercialContext.snapshot.clientId,
              merchantAccountId: commercialContext.snapshot.merchantAccountId,
              kind: ORDER_KIND.ONLINE,
              commercialModel: commercialContext.snapshot.mode,
              platformCommissionRateBps: commercialContext.commissionRateBps,
              quantity: input.quantity,
              totalCents: 0,
              subtotalCents: validated.baseSubtotalCents,
              discountCents: validated.discountCents,
              buyerName: input.buyerName,
              buyerEmail: validated.normalizedEmail,
              buyerPhone: input.buyerPhone ?? null,
              couponId: validated.coupon?.id ?? null,
              merchantSnapshot: serializeMercadoPagoSnapshot(commercialContext.snapshot)
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
            discountedSubtotalCents: validated.discountedSubtotalCents
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

  const { order, ticketType, buyerEmail, discountedSubtotalCents } = transactionResult;
  const feeItems = await resolveCheckoutFeeItems();
  const amounts = calculateCheckoutAmounts(discountedSubtotalCents, feeItems);
  if (amounts.totalCents <= 0) {
    throw new Error("Este registro no requiere pago. Usa el flujo gratuito.");
  }
  const appUrl = resolveAppUrl();
  const encodedEventSlug = encodeURIComponent(ticketType.event.slug);

  const preference = await createPreference(
    {
      title: `${ticketType.event.name} - Compra de entradas`,
      unitPrice: amounts.totalCents / 100,
      quantity: 1,
      payerEmail: buyerEmail,
      externalReference: order.id,
      successUrl: `${appUrl}/success?event=${encodedEventSlug}&order=${encodeURIComponent(order.id)}`,
      failureUrl: `${appUrl}/failure?event=${encodedEventSlug}&order=${encodeURIComponent(order.id)}`,
      pendingUrl: `${appUrl}/pending?event=${encodedEventSlug}&order=${encodeURIComponent(order.id)}`,
      webhookUrl: `${appUrl}/api/mercadopago/webhook`
    },
    { accessToken: commercialContext.accessToken }
  );

  await db.order.update({
    where: { id: order.id },
    data: {
      totalCents: amounts.totalCents,
      mercadoPagoRef: preference.id,
      mercadoPagoInit: preference.init_point ?? preference.sandbox_init_point
    }
  });

  return {
    orderId: order.id,
    initPoint: preference.init_point ?? preference.sandbox_init_point,
    mode: commercialContext.mode
  };
}

export { isSerializationConflict };
