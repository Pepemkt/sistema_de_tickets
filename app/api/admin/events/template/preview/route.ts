import { NextResponse } from "next/server";
import { z } from "zod";
import { checkApiRole } from "@/lib/api-auth";
import { generateTicketPdf } from "@/lib/pdf";
import { ticketTemplateSchema } from "@/lib/ticket-template";

export const runtime = "nodejs";

const previewTemplateSchema = z.object({
  eventName: z.string().min(2).max(140),
  venue: z.string().min(2).max(180),
  startsAt: z.string().min(1),
  ticketTypeName: z.string().min(2).max(80),
  template: ticketTemplateSchema
});

export async function POST(request: Request) {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const data = previewTemplateSchema.parse(await request.json());
    const startsAt = new Date(data.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new Error("Fecha de evento invalida");
    }

    const pdfBuffer = await generateTicketPdf({
      eventName: data.eventName,
      venue: data.venue,
      startsAt,
      ticketType: data.ticketTypeName,
      attendeeName: "Ana Perez",
      attendeeEmail: "ana.perez@email.com",
      code: "TK-AB12CD34EF",
      qrPayload: "ticket-preview:admin",
      orderCode: "ORD-9F8A27",
      quantity: 1,
      purchaseDate: new Date(),
      template: data.template
    });

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": "inline; filename=ticket-preview.pdf"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo generar el preview del ticket"
      },
      { status: 400 }
    );
  }
}
