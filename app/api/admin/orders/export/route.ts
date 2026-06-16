import { NextResponse } from "next/server";
import { checkApiRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { requireViewerEventAccess } from "@/lib/event-scope";
import { normalizeRegistrationAnswers, normalizeRegistrationFieldDefinitions } from "@/lib/registration-fields";

export const runtime = "nodejs";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function centsToArs(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toFixed(2);
}

export async function GET(request: Request) {
  const auth = await checkApiRole(["ADMIN", "MANAGER"]);
  if (auth.response) return auth.response;
  const viewer = auth.viewer!;

  try {
    const url = new URL(request.url);
    const eventId = url.searchParams.get("eventId")?.trim() ?? "";
    if (!eventId) {
      return NextResponse.json({ error: "Debes seleccionar un evento" }, { status: 400 });
    }

    const event = await db.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        name: true,
        registrationFieldsJson: true
      }
    });

    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    await requireViewerEventAccess(viewer, event.id);

    const orders = await db.order.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "desc" },
      include: {
        ticketType: { select: { name: true } },
        tickets: {
          select: {
            id: true,
            attendedAt: true
          }
        },
        emailDeliveries: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            recipientEmail: true,
            status: true
          }
        }
      }
    });

    const currentDefinitions = normalizeRegistrationFieldDefinitions(event.registrationFieldsJson);
    const currentLabels = currentDefinitions.map((field) => field.label);
    const historicLabels = new Set<string>();
    for (const order of orders) {
      for (const answer of normalizeRegistrationAnswers(order.registrationAnswersJson)) {
        if (answer.label && !currentLabels.includes(answer.label)) {
          historicLabels.add(answer.label);
        }
      }
    }
    const dynamicHeaders = [...currentLabels, ...Array.from(historicLabels).sort((a, b) => a.localeCompare(b, "es"))];

    const headers = [
      "order_id",
      "created_at",
      "status",
      "kind",
      "event_name",
      "ticket_type",
      "buyer_name",
      "buyer_email",
      "buyer_phone",
      "quantity",
      "tickets_issued",
      "tickets_attended",
      "subtotal_ars",
      "discount_ars",
      "total_ars",
      "mercadopago_ref",
      "mercadopago_payment",
      "last_email_status",
      "last_email_recipient",
      ...dynamicHeaders
    ];

    const rows = orders.map((order) => {
      const answers = normalizeRegistrationAnswers(order.registrationAnswersJson);
      const answerMap = new Map(answers.map((answer) => [answer.label, answer.value]));
      const attendedTickets = order.tickets.filter((ticket) => ticket.attendedAt !== null).length;
      const lastDelivery = order.emailDeliveries[0] ?? null;

      return [
        order.id,
        order.createdAt.toISOString(),
        order.status,
        order.kind,
        event.name,
        order.ticketType.name,
        order.buyerName,
        order.buyerEmail,
        order.buyerPhone ?? "",
        order.quantity,
        order.tickets.length,
        attendedTickets,
        centsToArs(order.subtotalCents),
        centsToArs(order.discountCents),
        centsToArs(order.totalCents),
        order.mercadoPagoRef ?? "",
        order.mercadoPagoPay ?? "",
        lastDelivery?.status ?? "",
        lastDelivery?.recipientEmail ?? "",
        ...dynamicHeaders.map((label) => answerMap.get(label) ?? "")
      ];
    });

    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const fileName = `ordenes-${event.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo exportar órdenes" },
      { status: 400 }
    );
  }
}
