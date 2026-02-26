import { OrderStatus, Prisma, TicketSaleMode } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

type ValidateOnlinePurchaseInput = {
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  buyerEmail: string;
  couponCode?: string | null;
};

export function normalizeBuyerEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeCouponCode(code: string | null | undefined) {
  if (!code) return null;
  const value = code.trim().toUpperCase();
  return value || null;
}

export async function validateOnlinePurchase(tx: TxClient, input: ValidateOnlinePurchaseInput) {
  const normalizedEmail = normalizeBuyerEmail(input.buyerEmail);
  const normalizedCouponCode = normalizeCouponCode(input.couponCode);

  const ticketType = await tx.ticketType.findUnique({
    where: { id: input.ticketTypeId },
    include: { event: { select: { name: true, slug: true } } }
  });

  if (!ticketType || ticketType.eventId !== input.eventId) {
    throw new Error("Tipo de entrada invalido");
  }

  if (ticketType.saleMode === TicketSaleMode.HIDDEN) {
    throw new Error("Esta entrada no esta disponible para compra online");
  }

  let coupon: { id: string; maxUses: number } | null = null;

  if (normalizedCouponCode) {
    const couponRecord = await tx.coupon.findUnique({
      where: { code: normalizedCouponCode }
    });

    if (!couponRecord || !couponRecord.isActive) {
      throw new Error("Cupon invalido o inactivo");
    }

    if (couponRecord.eventId !== input.eventId) {
      throw new Error("El cupon no aplica a este evento");
    }

    if (couponRecord.ticketTypeId && couponRecord.ticketTypeId !== input.ticketTypeId) {
      throw new Error("El cupon no aplica al tipo de entrada seleccionado");
    }

    if (couponRecord.expiresAt && couponRecord.expiresAt < new Date()) {
      throw new Error("El cupon esta vencido");
    }

    const reservedUses = await tx.order.count({
      where: {
        couponId: couponRecord.id,
        status: { in: [OrderStatus.PENDING, OrderStatus.PAID] }
      }
    });

    if (reservedUses >= couponRecord.maxUses) {
      throw new Error("El cupon alcanzo su limite de uso");
    }

    coupon = {
      id: couponRecord.id,
      maxUses: couponRecord.maxUses
    };
  }

  if (ticketType.saleMode === TicketSaleMode.COUPON_ONLY && !coupon) {
    throw new Error("Esta entrada requiere cupon");
  }

  if (ticketType.maxPerOrder && input.quantity > ticketType.maxPerOrder) {
    throw new Error(`Este ticket permite hasta ${ticketType.maxPerOrder} por operacion`);
  }

  if (ticketType.maxPerEmail) {
    const existingByEmail = await tx.order.aggregate({
      _sum: { quantity: true },
      where: {
        ticketTypeId: input.ticketTypeId,
        buyerEmail: normalizedEmail,
        status: { in: [OrderStatus.PENDING, OrderStatus.PAID] }
      }
    });

    const reservedByEmail = existingByEmail._sum.quantity ?? 0;
    if (reservedByEmail + input.quantity > ticketType.maxPerEmail) {
      throw new Error(`Este ticket permite hasta ${ticketType.maxPerEmail} por email`);
    }
  }

  const sold = await tx.ticket.count({
    where: { ticketTypeId: input.ticketTypeId }
  });

  const pendingReservation = await tx.order.aggregate({
    _sum: { quantity: true },
    where: {
      ticketTypeId: input.ticketTypeId,
      status: OrderStatus.PENDING
    }
  });

  const reservedPending = pendingReservation._sum.quantity ?? 0;
  if (sold + reservedPending + input.quantity > ticketType.stock) {
    throw new Error("No hay stock suficiente");
  }

  return {
    ticketType,
    normalizedEmail,
    coupon
  };
}
