import { sendOrderTicketsEmail } from "@/lib/email";
import { db } from "@/lib/db";
import { getPayment, MercadoPagoApiError } from "@/lib/mercadopago";
import { generateTicketsForPaidOrder } from "@/lib/tickets";
import {
  listMercadoPagoContextCandidates,
  serializeMercadoPagoSnapshot,
  type MercadoPagoContext
} from "@/lib/application/payments/resolve-mercadopago-context";

export type FinalizePaymentInput = {
  paymentId: string;
  source: "WEBHOOK" | "SUCCESS";
  orderIdHint?: string;
  rawPayload?: unknown;
};

export type FinalizePaymentResult = {
  status: "ignored" | "processed" | "replayed";
  orderId?: string;
  emailSent?: boolean;
};

type MercadoPagoPayment = Awaited<ReturnType<typeof getPayment>>;

function mapEmailTrigger(source: FinalizePaymentInput["source"]) {
  return source === "WEBHOOK" ? "WEBHOOK" : "SUCCESS_PAGE";
}

function isLookupRetryable(error: unknown) {
  return error instanceof MercadoPagoApiError && [400, 401, 403, 404].includes(error.status);
}

async function fetchPaymentWithCandidates(paymentId: string, orderIdHint?: string) {
  const candidates = await listMercadoPagoContextCandidates(orderIdHint);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const payment = await getPayment(paymentId, { accessToken: candidate.accessToken });
      return { payment, context: candidate };
    } catch (error) {
      if (isLookupRetryable(error)) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(`No se pudo resolver el pago ${paymentId} en Mercado Pago`);
}

async function persistPayment(input: {
  orderId: string;
  payment: MercadoPagoPayment;
  context: MercadoPagoContext;
  source: FinalizePaymentInput["source"];
  rawPayload?: unknown;
}) {
  const normalizedPaymentId = input.payment.id.toString();
  const approvedAt = input.payment.status === "approved" ? new Date() : null;

  return db.payment.upsert({
    where: { providerPaymentId: normalizedPaymentId },
    create: {
      orderId: input.orderId,
      provider: "MERCADOPAGO",
      providerPaymentId: normalizedPaymentId,
      status: input.payment.status,
      source: input.source,
      approvedAt,
      merchantSnapshot: serializeMercadoPagoSnapshot(input.context.snapshot),
      rawPayload: input.rawPayload ? { notification: input.rawPayload, payment: input.payment } : input.payment
    },
    update: {
      orderId: input.orderId,
      status: input.payment.status,
      source: input.source,
      approvedAt: approvedAt ?? undefined,
      merchantSnapshot: serializeMercadoPagoSnapshot(input.context.snapshot),
      rawPayload: input.rawPayload ? { notification: input.rawPayload, payment: input.payment } : input.payment
    }
  });
}

export async function finalizeMercadoPagoPayment(input: FinalizePaymentInput): Promise<FinalizePaymentResult> {
  const { payment, context } = await fetchPaymentWithCandidates(input.paymentId, input.orderIdHint);
  const externalReference = payment.external_reference?.trim() || input.orderIdHint?.trim() || "";

  if (!externalReference) {
    return { status: "ignored" };
  }

  const order = await db.order.findUnique({
    where: { id: externalReference },
    select: {
      id: true,
      status: true,
      tickets: { select: { id: true } }
    }
  });

  if (!order) {
    return { status: "ignored" };
  }

  const paymentRecord = await persistPayment({
    orderId: order.id,
    payment,
    context,
    source: input.source,
    rawPayload: input.rawPayload
  });

  if (payment.status !== "approved") {
    return { status: "ignored", orderId: order.id };
  }

  const normalizedPaymentId = payment.id.toString();
  const alreadyPaid = order.status === "PAID" && order.tickets.length > 0;
  if (!alreadyPaid) {
    await generateTicketsForPaidOrder(order.id, normalizedPaymentId);
  }

  if (paymentRecord.ticketEmailSentAt) {
    return { status: "replayed", orderId: order.id, emailSent: true };
  }

  const claimedAt = new Date();
  const claimedEmail = await db.payment.updateMany({
    where: {
      id: paymentRecord.id,
      ticketEmailSentAt: null
    },
    data: {
      ticketEmailSentAt: claimedAt
    }
  });

  if (claimedEmail.count === 0) {
    return { status: "replayed", orderId: order.id, emailSent: true };
  }

  try {
    await sendOrderTicketsEmail(order.id, { trigger: mapEmailTrigger(input.source) });

    return {
      status: alreadyPaid ? "replayed" : "processed",
      orderId: order.id,
      emailSent: true
    };
  } catch (error) {
    await db.payment.updateMany({
      where: {
        id: paymentRecord.id,
        ticketEmailSentAt: claimedAt
      },
      data: {
        ticketEmailSentAt: null
      }
    });

    console.error(`[payments] email failed for order ${order.id}`, error);
    return {
      status: alreadyPaid ? "replayed" : "processed",
      orderId: order.id,
      emailSent: false
    };
  }
}
