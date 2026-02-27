import Link from "next/link";
import { db } from "@/lib/db";
import { sendOrderTicketsEmail } from "@/lib/email";
import { getPayment } from "@/lib/mercadopago";
import { generateTicketsForPaidOrder } from "@/lib/tickets";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function resolvePaymentId(params: Record<string, string | string[] | undefined>) {
  const candidates = [
    resolveValue(params.payment_id),
    resolveValue(params.collection_id),
    resolveValue(params["data.id"])
  ];

  return candidates.find((value) => /^[0-9]+$/.test(value)) ?? "";
}

async function reconcileOrderFromMercadoPagoReturn(orderId: string, paymentId: string) {
  try {
    const payment = await getPayment(paymentId);
    const normalizedPaymentId = payment.id.toString();

    if (payment.status !== "approved" || payment.external_reference !== orderId) {
      return { confirmed: false as const };
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { tickets: { select: { id: true } } }
    });

    if (!order) {
      return { confirmed: false as const };
    }

    const alreadyProcessed =
      order.status === "PAID" && order.mercadoPagoPay === normalizedPaymentId && order.tickets.length > 0;

    if (alreadyProcessed) {
      return { confirmed: true as const, emailSent: true as const };
    }

    await generateTicketsForPaidOrder(order.id, normalizedPaymentId);

    try {
      await sendOrderTicketsEmail(order.id);
      return { confirmed: true as const, emailSent: true as const };
    } catch (error) {
      console.error(`[success] email failed for order ${order.id}`, error);
      return { confirmed: true as const, emailSent: false as const };
    }
  } catch (error) {
    console.error(`[success] reconciliation failed for order ${orderId} payment ${paymentId}`, error);
    return { confirmed: false as const };
  }
}

export default async function SuccessPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const eventSlug = resolveValue(params.event);
  const orderId = resolveValue(params.order);
  const paymentId = resolvePaymentId(params);

  let reconciled = false;
  let emailSent = true;

  if (orderId && paymentId) {
    const result = await reconcileOrderFromMercadoPagoReturn(orderId, paymentId);
    reconciled = result.confirmed;
    if ("emailSent" in result && typeof result.emailSent === "boolean") {
      emailSent = result.emailSent;
    }
  }

  const order = orderId
    ? await db.order.findUnique({
        where: { id: orderId },
        select: {
          status: true,
          event: { select: { slug: true } },
          tickets: { select: { id: true } }
        }
      })
    : null;

  const isPaid = Boolean(order && order.status === "PAID" && order.tickets.length > 0);
  const finalEventSlug = eventSlug || order?.event.slug || "";
  const eventUrl = finalEventSlug ? `/e/${encodeURIComponent(finalEventSlug)}` : "/";

  return (
    <div className="min-h-screen bg-slate-200/50 px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="p-8 sm:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <span className="text-4xl text-emerald-600">✓</span>
          </div>
          <h1 className="mt-5 text-center text-5xl font-semibold text-slate-900">Pago exitoso</h1>
          <p className="mt-3 text-center text-slate-600">
            {isPaid
              ? "Pago confirmado. Tus tickets ya fueron emitidos."
              : "Recibimos tu pago. Estamos esperando confirmacion final para habilitar tus tickets."}
          </p>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Numero de orden</p>
                <p className="text-3xl font-semibold text-slate-900">{orderId || "Pendiente"}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {isPaid ? "Pagado" : "Pendiente"}
              </span>
            </div>
          </section>

          {isPaid ? (
            <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {emailSent
                ? "Tus tickets fueron emitidos y enviados por email."
                : "Tus tickets ya fueron emitidos. Hubo un problema enviando el email; puedes pedir reenvio desde soporte/admin."}
            </p>
          ) : (
            <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              Los tickets se habilitan cuando Mercado Pago confirme el cobro. Te los enviaremos por email.
              {reconciled ? " Reintenta en unos segundos para ver el estado actualizado." : ""}
            </p>
          )}

          <div className="mt-6 text-center">
            <Link href={eventUrl} className="text-sm font-semibold text-blue-700 hover:underline">
              Volver al evento
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
