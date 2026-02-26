import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkApiRole } from "@/lib/api-auth";
import { verifyTicketPayload } from "@/lib/ticket-signature";

export const runtime = "nodejs";

const schema = z.object({
  payload: z.string().min(10)
});

export async function POST(request: Request) {
  const auth = await checkApiRole(["ADMIN", "SCANNER"]);
  if (auth.response) return auth.response;

  try {
    const { payload } = schema.parse(await request.json());
    const code = verifyTicketPayload(payload);

    if (!code) {
      return NextResponse.json({ status: "error", message: "QR invalido" }, { status: 400 });
    }

    const ticket = await db.ticket.findUnique({
      where: { code },
      include: { event: true }
    });

    if (!ticket) {
      return NextResponse.json({ status: "error", message: "Ticket no encontrado" }, { status: 404 });
    }

    if (ticket.attendedAt) {
      return NextResponse.json({
        status: "already_used",
        ticketCode: ticket.code,
        attendedAt: ticket.attendedAt,
        attendeeName: ticket.attendeeName
      });
    }

    const now = new Date();
    const updated = await db.ticket.updateMany({
      where: {
        id: ticket.id,
        attendedAt: null
      },
      data: { attendedAt: now }
    });

    if (updated.count === 0) {
      const latest = await db.ticket.findUnique({
        where: { id: ticket.id },
        select: { code: true, attendeeName: true, attendedAt: true }
      });

      return NextResponse.json({
        status: "already_used",
        ticketCode: latest?.code ?? ticket.code,
        attendedAt: latest?.attendedAt ?? now,
        attendeeName: latest?.attendeeName ?? ticket.attendeeName
      });
    }

    return NextResponse.json({
      status: "ok",
      ticketCode: ticket.code,
      attendeeName: ticket.attendeeName,
      eventName: ticket.event.name
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "No se pudo validar"
      },
      { status: 400 }
    );
  }
}
