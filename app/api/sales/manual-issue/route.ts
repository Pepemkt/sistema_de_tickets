import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { OrderStatus } from "@prisma/client";
import { checkApiRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { buildQrPayload } from "@/lib/ticket-signature";

export const runtime = "nodejs";

const attendeeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email()
});

const schema = z.object({
  eventId: z.string().min(1),
  ticketTypeId: z.string().min(1),
  attendees: z.array(attendeeSchema).min(1).max(500)
});

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  const auth = await checkApiRole(["ADMIN", "SELLER"]);
  if (auth.response) return auth.response;
  const actor = auth.viewer!;

  try {
    const data = schema.parse(await request.json());
    const attendees = data.attendees.map((item) => ({
      name: item.name.trim(),
      email: normalizeEmail(item.email)
    }));

    const result = await db.$transaction(async (tx) => {
      const ticketType = await tx.ticketType.findUnique({
        where: { id: data.ticketTypeId },
        include: {
          event: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      if (!ticketType || ticketType.eventId !== data.eventId) {
        throw new Error("Tipo de entrada invalido para el evento");
      }

      const sold = await tx.ticket.count({
        where: { ticketTypeId: ticketType.id }
      });

      const pendingReservation = await tx.order.aggregate({
        _sum: { quantity: true },
        where: {
          ticketTypeId: ticketType.id,
          status: OrderStatus.PENDING
        }
      });

      const reservedPending = pendingReservation._sum.quantity ?? 0;

      if (sold + reservedPending + attendees.length > ticketType.stock) {
        throw new Error("No hay stock suficiente para emitir esa cantidad");
      }

      const order = await tx.order.create({
        data: {
          eventId: data.eventId,
          ticketTypeId: data.ticketTypeId,
          quantity: attendees.length,
          totalCents: ticketType.priceCents * attendees.length,
          buyerName: `Emision manual (${actor.username})`,
          buyerEmail: attendees[0]?.email ?? `${actor.username}@manual.local`,
          status: OrderStatus.PAID,
          mercadoPagoPay: `MANUAL-${randomUUID().slice(0, 8).toUpperCase()}`
        }
      });

      const tickets = attendees.map((attendee) => {
        const code = randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase();
        return {
          code,
          qrPayload: buildQrPayload(code),
          attendeeName: attendee.name,
          attendeeEmail: attendee.email,
          eventId: data.eventId,
          ticketTypeId: data.ticketTypeId,
          orderId: order.id
        };
      });

      await tx.ticket.createMany({
        data: tickets
      });

      return {
        orderId: order.id,
        eventName: ticketType.event.name,
        ticketTypeName: ticketType.name,
        created: tickets.length
      };
    });

    return NextResponse.json({
      ok: true,
      ...result
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo emitir entradas manualmente"
      },
      { status: 400 }
    );
  }
}
