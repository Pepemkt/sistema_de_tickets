import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkApiRole } from "@/lib/api-auth";
import { generateTicketPdf } from "@/lib/pdf";
import { normalizeTicketTemplate } from "@/lib/ticket-template";

type Params = {
  params: Promise<{ id: string; ticketId: string }>;
};

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: Params) {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const { id, ticketId } = await params;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      event: true,
      ticketType: true,
      tickets: {
        where: { id: ticketId },
        include: { event: true, ticketType: true }
      }
    }
  });

  if (!order || order.tickets.length === 0) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  const ticket = order.tickets[0];
  const template = normalizeTicketTemplate(order.event.templateJson);

  const pdf = await generateTicketPdf({
    eventName: ticket.event.name,
    venue: ticket.event.venue,
    startsAt: ticket.event.startsAt,
    ticketType: ticket.ticketType.name,
    attendeeName: ticket.attendeeName,
    attendeeEmail: ticket.attendeeEmail,
    code: ticket.code,
    qrPayload: ticket.qrPayload,
    orderCode: order.id,
    quantity: order.quantity,
    purchaseDate: order.createdAt,
    template
  });

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=entrada-${ticket.code}.pdf`
    }
  });
}
