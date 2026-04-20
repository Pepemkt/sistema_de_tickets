import { NextResponse } from "next/server";
import { verifyMercadoPagoWebhook } from "@/lib/guards";
import { db } from "@/lib/db";
import { finalizeMercadoPagoPayment } from "@/lib/application/payments/finalize-mercadopago-payment";

export const runtime = "nodejs";

function extractPaymentId(searchParams: URLSearchParams, body: unknown) {
  const parsedBody =
    typeof body === "object" && body !== null
      ? (body as {
          type?: string;
          data?: { id?: string | number };
          id?: string | number;
        })
      : {};

  const type = searchParams.get("type") ?? searchParams.get("topic") ?? parsedBody.type;
  if (type && type !== "payment") {
    return null;
  }

  return (
    searchParams.get("data.id") ??
    searchParams.get("id") ??
    parsedBody.data?.id?.toString() ??
    parsedBody.id?.toString() ??
    null
  );
}

function parseWebhookBody(rawBody: string) {
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const rawBody = await request.text();
    const body = parseWebhookBody(rawBody);

    const allowed = await verifyMercadoPagoWebhook({ request, rawBody, body });
    if (!allowed) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const paymentId = extractPaymentId(url.searchParams, body);
    if (!paymentId) {
      return NextResponse.json({ ok: true });
    }

    // MP re-delivers webhooks; on replays we already have the order linked
    // to this providerPaymentId, so the hint picks the right merchant on the first try.
    const knownPayment = await db.payment.findUnique({
      where: { providerPaymentId: paymentId },
      select: { orderId: true }
    });

    const result = await finalizeMercadoPagoPayment({
      paymentId,
      orderIdHint: knownPayment?.orderId,
      source: "WEBHOOK",
      rawPayload: body
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Webhook error"
      },
      { status: 500 }
    );
  }
}
