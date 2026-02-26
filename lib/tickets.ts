import { randomUUID } from "crypto";
import { OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildQrPayload } from "@/lib/ticket-signature";

const SERIALIZABLE_RETRY_ATTEMPTS = 3;

function isSerializationConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

export async function generateTicketsForPaidOrder(orderId: string, paymentId: string) {
  for (let attempt = 1; attempt <= SERIALIZABLE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction(
        async (tx) => {
          const order = await tx.order.findUnique({
            where: { id: orderId },
            include: {
              event: true,
              ticketType: true,
              tickets: true
            }
          });

          if (!order) {
            throw new Error(`Order no encontrada: ${orderId}`);
          }

          if (order.status === OrderStatus.PAID && order.tickets.length > 0) {
            return order.tickets;
          }

          const sold = await tx.ticket.count({
            where: { ticketTypeId: order.ticketTypeId }
          });

          if (sold + order.quantity > order.ticketType.stock) {
            throw new Error(`Stock agotado para ${order.ticketType.name}`);
          }

          const tickets = [];
          for (let i = 0; i < order.quantity; i += 1) {
            const code = randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase();
            tickets.push({
              code,
              qrPayload: buildQrPayload(code),
              attendeeName: order.buyerName,
              attendeeEmail: order.buyerEmail,
              eventId: order.eventId,
              ticketTypeId: order.ticketTypeId,
              orderId: order.id
            });
          }

          await tx.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.PAID,
              mercadoPagoPay: paymentId
            }
          });

          await tx.ticket.createMany({
            data: tickets
          });

          return tx.ticket.findMany({
            where: { orderId: order.id },
            include: { event: true, ticketType: true }
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (attempt < SERIALIZABLE_RETRY_ATTEMPTS && isSerializationConflict(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("No se pudieron generar tickets por conflicto de concurrencia");
}

export async function getPaidOrderWithTickets(orderId: string) {
  return db.order.findUnique({
    where: { id: orderId },
    include: {
      event: true,
      ticketType: true,
      tickets: {
        include: {
          event: true,
          ticketType: true
        }
      }
    }
  });
}
