import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMercadoPagoWebhook } from "@/lib/guards";
import { getPayment } from "@/lib/mercadopago";
import { sendOrderTicketsEmail } from "@/lib/email";
import { generateTicketsForPaidOrder } from "@/lib/tickets";

export const runtime = "nodejs";
const EMAIL_RETRY_MEMORY_TTL_MS = 1000 * 60 * 60 * 12;

const globalForWebhookEmail = globalThis as typeof globalThis & {
  aiderbrandWebhookEmailSentAt?: Map<string, number>;
};

function webhookEmailCache() {
  if (!globalForWebhookEmail.aiderbrandWebhookEmailSentAt) {
    globalForWebhookEmail.aiderbrandWebhookEmailSentAt = new Map();
  }

  return globalForWebhookEmail.aiderbrandWebhookEmailSentAt;
}

function wasEmailRecentlySent(key: string) {
  const cache = webhookEmailCache();
  const sentAt = cache.get(key);
  if (!sentAt) {
    return false;
  }

  if (Date.now() - sentAt > EMAIL_RETRY_MEMORY_TTL_MS) {
    cache.delete(key);
    return false;
  }

  return true;
}

function markEmailAsSent(key: string) {
  const cache = webhookEmailCache();
  const now = Date.now();

  for (const [cacheKey, sentAt] of cache.entries()) {
    if (now - sentAt > EMAIL_RETRY_MEMORY_TTL_MS) {
      cache.delete(cacheKey);
    }
  }

  cache.set(key, now);
}

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

    const payment = await getPayment(paymentId);
    if (payment.status !== "approved" || !payment.external_reference) {
      return NextResponse.json({ ok: true });
    }

    const order = await db.order.findUnique({
      where: { id: payment.external_reference },
      include: { tickets: { select: { id: true } } }
    });
    if (!order) {
      return NextResponse.json({ ok: true });
    }

    const normalizedPaymentId = payment.id.toString();
    const emailCacheKey = `${order.id}:${normalizedPaymentId}`;
    const alreadyProcessed =
      order.status === "PAID" && order.mercadoPagoPay === normalizedPaymentId && order.tickets.length > 0;

    if (alreadyProcessed) {
      if (wasEmailRecentlySent(emailCacheKey)) {
        return NextResponse.json({ ok: true, replay: true });
      }

      await sendOrderTicketsEmail(order.id);
      markEmailAsSent(emailCacheKey);
      return NextResponse.json({ ok: true });
    }

    await generateTicketsForPaidOrder(order.id, normalizedPaymentId);
    await sendOrderTicketsEmail(order.id);
    markEmailAsSent(emailCacheKey);

    return NextResponse.json({ ok: true });
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
