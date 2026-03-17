import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { checkApiRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { sendInvitationTicketEmails } from "@/lib/email";
import { requireViewerEventAccess } from "@/lib/event-scope";
import { ORDER_KIND } from "@/lib/order-kind";
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
  const auth = await checkApiRole(["ADMIN", "MANAGER", "SELLER"]);
  if (auth.response) return auth.response;
  const actor = auth.viewer!;

  try {
    const data = schema.parse(await request.json());
    await requireViewerEventAccess(actor, data.eventId);

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
          kind: ORDER_KIND.INVITATION,
          quantity: attendees.length,
          totalCents: 0,
          subtotalCents: 0,
          discountCents: 0,
          buyerName: `Invitaciones (${actor.username})`,
          buyerEmail: `${actor.username}@invitation.local`,
          status: OrderStatus.PAID,
          mercadoPagoPay: `INV-${randomUUID().slice(0, 8).toUpperCase()}`
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

      const createdTickets = await tx.ticket.findMany({
        where: { orderId: order.id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          code: true,
          attendeeName: true,
          attendeeEmail: true
        }
      });

      return {
        orderId: order.id,
        eventName: ticketType.event.name,
        ticketTypeName: ticketType.name,
        created: createdTickets.length,
        tickets: createdTickets
      };
    });

    const emailResults = await sendInvitationTicketEmails(result.orderId, { trigger: "INVITATION_CONSOLE" });
    const emailMap = new Map(emailResults.map((item) => [item.ticketId, item]));

    return NextResponse.json({
      ok: true,
      orderId: result.orderId,
      eventName: result.eventName,
      ticketTypeName: result.ticketTypeName,
      created: result.created,
      emailsSent: emailResults.filter((item) => item.status === "SENT").length,
      emailsFailed: emailResults.filter((item) => item.status === "FAILED").length,
      tickets: result.tickets.map((ticket) => {
        const emailResult = emailMap.get(ticket.id);
        return {
          ...ticket,
          downloadUrl: `/api/admin/orders/${encodeURIComponent(result.orderId)}/ticket/${encodeURIComponent(ticket.id)}/pdf`,
          emailStatus: emailResult?.status ?? "FAILED",
          emailError: emailResult?.errorMessage ?? null
        };
      })
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudieron emitir invitaciones"
      },
      { status: 400 }
    );
  }
}
