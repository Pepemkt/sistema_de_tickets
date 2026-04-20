import { db } from "@/lib/db";
import { normalizePlatformCommissionRateBps } from "@/lib/platform-commission";

export type LiquidationDraftItem = {
  orderId: string;
  paymentId: string | null;
  grossCents: number;
  commissionCents: number;
  netCents: number;
};

export type LiquidationDraft = {
  clientId: string;
  eventId: string;
  merchantAccountId: string | null;
  grossCents: number;
  commissionCents: number;
  netCents: number;
  commissionRateBpsSnapshot: number;
  items: LiquidationDraftItem[];
};

function calculateCommissionCents(amountCents: number, commissionRateBps: number) {
  return Math.round((amountCents * commissionRateBps) / 10_000);
}

export async function buildLiquidationForEvent(eventId: string): Promise<LiquidationDraft> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      clientId: true,
      platformCommissionRateBps: true,
      orders: {
        where: {
          status: "PAID",
          commercialModel: "DELEGATED"
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          totalCents: true,
          merchantAccountId: true,
          payments: {
            where: { status: "approved" },
            orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: { id: true }
          }
        }
      },
      liquidations: {
        // CANCELLED liquidations are intentionally excluded: cancelling a liquidation
        // releases its orders so they can be included in a new one.
        where: { status: { in: ["DRAFT", "FINALIZED", "SETTLED"] } },
        select: {
          items: {
            select: { orderId: true }
          }
        }
      }
    }
  });

  if (!event) {
    throw new Error("Evento no encontrado");
  }

  if (!event.clientId) {
    throw new Error("El evento no tiene cliente delegado asociado");
  }

  const existingOrderIds = new Set(event.liquidations.flatMap((liquidation) => liquidation.items.map((item) => item.orderId)));
  // Event-level commission always wins over MerchantAccount.commissionRateBps.
  const commissionRateBps = normalizePlatformCommissionRateBps(event.platformCommissionRateBps);

  const items = event.orders
    .filter((order) => !existingOrderIds.has(order.id))
    .map((order) => {
      const grossCents = order.totalCents;
      const commissionCents = calculateCommissionCents(grossCents, commissionRateBps);

      return {
        orderId: order.id,
        paymentId: order.payments[0]?.id ?? null,
        grossCents,
        commissionCents,
        netCents: grossCents - commissionCents,
        merchantAccountId: order.merchantAccountId
      };
    });

  const grossCents = items.reduce((sum, item) => sum + item.grossCents, 0);
  const commissionCents = items.reduce((sum, item) => sum + item.commissionCents, 0);
  const merchantAccountIds = Array.from(new Set(items.map((item) => item.merchantAccountId).filter((value): value is string => Boolean(value))));

  return {
    clientId: event.clientId,
    eventId: event.id,
    merchantAccountId: merchantAccountIds.length === 1 ? merchantAccountIds[0] : null,
    grossCents,
    commissionCents,
    netCents: grossCents - commissionCents,
    commissionRateBpsSnapshot: commissionRateBps,
    items: items.map((item) => ({
      orderId: item.orderId,
      paymentId: item.paymentId,
      grossCents: item.grossCents,
      commissionCents: item.commissionCents,
      netCents: item.netCents
    }))
  };
}
