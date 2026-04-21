import Link from "next/link";
import { db } from "@/lib/db";
import { VisitTracker } from "@/components/visit-tracker";
import { finalizeMercadoPagoPayment } from "@/lib/application/payments/finalize-mercadopago-payment";

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
    const result = await finalizeMercadoPagoPayment({
      paymentId,
      source: "SUCCESS",
      orderIdHint: orderId
    });

    if (result.status === "ignored") {
      return { confirmed: false as const };
    }

    return {
      confirmed: true as const,
      emailSent: result.emailSent ?? false
    };
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
          id: true,
          buyerEmail: true,
          status: true,
          event: { select: { slug: true } },
          tickets: {
            select: {
              id: true,
              code: true
            }
          }
        }
      })
    : null;

  const isPaid = Boolean(order && order.status === "PAID" && order.tickets.length > 0);
  const finalEventSlug = eventSlug || order?.event.slug || "";
  const eventUrl = finalEventSlug ? `/e/${encodeURIComponent(finalEventSlug)}` : "/";

  return (
    <div className="min-h-screen bg-page px-4 py-12 sm:px-6">
      <VisitTracker step="success" eventSlug={finalEventSlug} />
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-soft bg-surface shadow-lg">
        <div className="px-6 py-10 sm:px-12 sm:py-12">
          <div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-onaccent shadow-[0_12px_24px_rgba(16,185,129,0.3)]"
            style={{ background: "linear-gradient(135deg,#1FAE4A,#10B981)" }}
            aria-hidden
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path d="M4 12l5 5L20 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 className="mt-6 text-center font-display text-title-xl font-extrabold tracking-tight text-primary sm:text-[44px] sm:leading-[1.1]">
            {isPaid ? "Pago exitoso" : "Pago recibido"}
          </h1>
          <p className="mt-3 text-center text-body text-secondary">
            {isPaid
              ? "Pago confirmado. Tus tickets ya fueron emitidos."
              : "Recibimos tu pago. Estamos esperando confirmacion final para habilitar tus tickets."}
          </p>

          <section className="mt-8 flex items-center justify-between gap-4 rounded-md bg-sunken px-6 py-5">
            <div>
              <p className="font-display text-overline font-semibold uppercase tracking-[0.1em] text-muted">Numero de orden</p>
              <p className="mt-1 break-all font-display text-title-m font-bold text-primary">{orderId || "Pendiente"}</p>
            </div>
            <span
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-caption font-semibold ${
                isPaid ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"
              }`}
            >
              {isPaid ? "Pagado" : "Pendiente"}
            </span>
          </section>

          {isPaid ? (
            <>
              <p
                className="mt-5 rounded-md border px-5 py-3.5 text-body-s"
                style={{
                  background: "linear-gradient(90deg,#FDF2F8,#F5F3FF)",
                  borderColor: "#F5D0E8",
                  color: "var(--brand-violet-deep)"
                }}
              >
                {emailSent
                  ? "Tus tickets fueron emitidos y enviados por email."
                  : "Tus tickets ya fueron emitidos. Hubo un problema enviando el email; puedes descargarlos desde aqui."}
              </p>

              {order && order.tickets.length > 0 ? (
                <section className="mt-5 rounded-md border border-soft bg-surface p-5">
                  <p className="font-display text-body-s font-semibold text-primary">Descargar tickets</p>
                  <div className="mt-4 grid gap-2">
                    {order.tickets.map((ticket, index) => (
                      <a
                        key={ticket.id}
                        href={`/api/public/orders/${encodeURIComponent(order.id)}/ticket/${encodeURIComponent(ticket.id)}/pdf?email=${encodeURIComponent(order.buyerEmail)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-between rounded-sm border border-soft bg-surface px-4 py-3 text-body-s text-primary transition-colors hover:bg-sunken"
                      >
                        <span>
                          Ticket #{index + 1} <code className="ml-1 font-mono text-caption text-muted">({ticket.code})</code>
                        </span>
                        <span className="font-semibold text-[color:var(--brand-violet)]">Descargar PDF</span>
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <p className="mt-5 rounded-md border border-warning-500/40 bg-warning-50 px-5 py-3.5 text-body-s text-warning-700">
              Los tickets se habilitan cuando Mercado Pago confirme el cobro. Te los enviaremos por email.
              {reconciled ? " Reintenta en unos segundos para ver el estado actualizado." : ""}
            </p>
          )}

          <div className="mt-8 flex justify-center">
            <Link href={eventUrl} className="btn-primary">
              Volver al evento
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
