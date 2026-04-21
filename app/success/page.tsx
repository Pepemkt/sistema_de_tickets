import Link from "next/link";
import { db } from "@/lib/db";
import { VisitTracker } from "@/components/visit-tracker";
import { finalizeMercadoPagoPayment } from "@/lib/application/payments/finalize-mercadopago-payment";

/* ── CSS-only animations (server-safe — no "use client") ─────────────────── */
const PAGE_STYLES = `
@keyframes sp-fade-up {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes sp-tick-draw {
  from { stroke-dashoffset: 48; }
  to   { stroke-dashoffset: 0; }
}
@keyframes sp-stub-in {
  from { opacity: 0; transform: translateX(-10px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* Staggered entrances */
.sp-seal   { animation: sp-fade-up 0.50s var(--ease-tactile) 0.05s both; }
.sp-kicker { animation: sp-fade-up 0.45s var(--ease-tactile) 0.14s both; }
.sp-h1     { animation: sp-fade-up 0.55s var(--ease-tactile) 0.22s both; }
.sp-sub    { animation: sp-fade-up 0.50s var(--ease-tactile) 0.30s both; }
.sp-order  { animation: sp-fade-up 0.50s var(--ease-tactile) 0.38s both; }
.sp-email  { animation: sp-fade-up 0.45s var(--ease-tactile) 0.44s both; }
.sp-tickets{ animation: sp-fade-up 0.45s var(--ease-tactile) 0.50s both; }
.sp-cta    { animation: sp-fade-up 0.45s var(--ease-tactile) 0.58s both; }

/* Animated checkmark */
.sp-tick-path {
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  animation: sp-tick-draw 0.50s var(--ease-tactile) 0.30s both;
}

/* Ticket row stagger */
.sp-stub:nth-child(1) { animation: sp-stub-in 0.40s var(--ease-tactile) 0.54s both; }
.sp-stub:nth-child(2) { animation: sp-stub-in 0.40s var(--ease-tactile) 0.62s both; }
.sp-stub:nth-child(3) { animation: sp-stub-in 0.40s var(--ease-tactile) 0.70s both; }
.sp-stub:nth-child(4) { animation: sp-stub-in 0.40s var(--ease-tactile) 0.78s both; }
.sp-stub:nth-child(5) { animation: sp-stub-in 0.40s var(--ease-tactile) 0.86s both; }

/* Ticket row hover */
.sp-stub {
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.sp-stub:hover {
  border-color: rgba(236,42,138,0.35) !important;
  box-shadow: 0 2px 10px rgba(236,42,138,0.08);
}
`;

/* ── Types ─────────────────────────────────────────────────────────────────── */
type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */
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
    if (result.status === "ignored") return { confirmed: false as const };
    return { confirmed: true as const, emailSent: result.emailSent ?? false };
  } catch (error) {
    console.error(`[success] reconciliation failed for order ${orderId} payment ${paymentId}`, error);
    return { confirmed: false as const };
  }
}

/* ── Page ──────────────────────────────────────────────────────────────────── */
export default async function SuccessPage({ searchParams }: Props) {
  const params    = (await searchParams) ?? {};
  const eventSlug = resolveValue(params.event);
  const orderId   = resolveValue(params.order);
  const paymentId = resolvePaymentId(params);

  let reconciled = false;
  let emailSent  = true;

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
          tickets: { select: { id: true, code: true } }
        }
      })
    : null;

  const isPaid         = Boolean(order && order.status === "PAID" && order.tickets.length > 0);
  const finalEventSlug = eventSlug || order?.event.slug || "";
  const eventUrl       = finalEventSlug ? `/e/${encodeURIComponent(finalEventSlug)}` : "/";

  /* Short display ID */
  const displayOrderId = orderId
    ? orderId.length > 12 ? "…" + orderId.slice(-12) : orderId
    : "—";

  return (
    <>
      <style>{PAGE_STYLES}</style>

      <div
        className="relative flex min-h-screen flex-col items-center justify-center px-4 py-16 sm:px-6 sm:py-20"
        style={{ background: "var(--bg-page)" }}
      >
        <VisitTracker step="success" eventSlug={finalEventSlug} />

        {/* Subtle violet wash — top-right corner only */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed right-0 top-0 -z-10"
          style={{
            width: "480px",
            height: "480px",
            background: "radial-gradient(circle at top right, rgba(139,92,246,0.06) 0%, transparent 70%)",
          }}
        />

        <div className="w-full max-w-[560px]">

          {/* ── SEAL ───────────────────────────────────────────────────── */}
          <div className="sp-seal flex flex-col items-center">
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full"
              style={{
                background: isPaid ? "#1FAE4A" : "#F59E0B",
                boxShadow: isPaid
                  ? "0 0 0 12px rgba(31,174,74,0.10)"
                  : "0 0 0 12px rgba(245,158,11,0.12)",
              }}
            >
              {isPaid ? (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-label="Pago confirmado">
                  <path
                    className="sp-tick-path"
                    d="M4 12l5 5L20 7"
                    stroke="white"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-label="Pago pendiente">
                  <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2.2" />
                  <path d="M12 7v5l3 3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>

          {/* ── STATUS CHIP ────────────────────────────────────────────── */}
          <div className="sp-kicker mt-6 flex justify-center">
            {isPaid ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-semibold"
                style={{
                  background: "rgba(31,174,74,0.10)",
                  color: "var(--clr-success-500)",
                  border: "1px solid rgba(31,174,74,0.22)",
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--clr-success-500)" }}
                  aria-hidden="true"
                />
                Pago confirmado
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-semibold"
                style={{
                  background: "rgba(245,158,11,0.10)",
                  color: "var(--clr-warning-500)",
                  border: "1px solid rgba(245,158,11,0.25)",
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--clr-warning-500)" }}
                  aria-hidden="true"
                />
                Confirmación pendiente
              </span>
            )}
          </div>

          {/* ── HEADLINE ───────────────────────────────────────────────── */}
          <h1
            className="sp-h1 mt-4 text-center font-display font-extrabold tracking-tight"
            style={{
              color: "var(--text-primary)",
              fontSize: "clamp(2.25rem, 6vw, 3rem)",
              lineHeight: "1",
            }}
          >
            {isPaid ? "Pago exitoso" : "Pago en camino"}
          </h1>

          {/* ── SUBTEXT ────────────────────────────────────────────────── */}
          <p
            className="sp-sub mt-3 text-center text-[0.9375rem]"
            style={{ color: "var(--text-secondary)", lineHeight: "1.5" }}
          >
            {isPaid
              ? "Pago confirmado. Tus tickets ya fueron emitidos."
              : "Te avisamos por email cuando se confirme el cobro."}
          </p>

          {/* ── ORDER CARD ─────────────────────────────────────────────── */}
          <div
            className="sp-order mt-8 w-full rounded-2xl bg-white"
            style={{ border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-sm)" }}
          >
            <div className="flex items-center justify-between gap-4 px-6 py-5">
              <div className="min-w-0 flex-1">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Número de orden
                </p>
                <p
                  className="mt-1.5 break-all font-mono text-[13px] font-semibold"
                  style={{ color: "var(--text-primary)", letterSpacing: "0.04em" }}
                >
                  {orderId || "—"}
                </p>
              </div>
              <div className="shrink-0">
                {isPaid ? (
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold"
                    style={{
                      background: "rgba(31,174,74,0.10)",
                      color: "var(--clr-success-500)",
                      border: "1px solid rgba(31,174,74,0.22)",
                    }}
                  >
                    Pagado
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold"
                    style={{
                      background: "rgba(245,158,11,0.10)",
                      color: "var(--clr-warning-500)",
                      border: "1px solid rgba(245,158,11,0.25)",
                    }}
                  >
                    Pendiente
                  </span>
                )}
              </div>
            </div>

            {/* ── EMAIL NOTICE (paid only) ──────────────────────────── */}
            {isPaid && (
              <>
                <div style={{ borderTop: "1px solid var(--border-soft)" }} />
                <div className="sp-email px-6 py-4">
                  <div
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{
                      background: "rgba(109,40,217,0.04)",
                      border: "1px solid rgba(109,40,217,0.12)",
                    }}
                  >
                    <svg
                      className="h-[18px] w-[18px] shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--brand-violet)"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                      Tus tickets fueron emitidos y enviados por email.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* ── TICKET LIST (paid + tickets exist) ───────────────── */}
            {isPaid && order && order.tickets.length > 0 && (
              <>
                <div style={{ borderTop: "1px solid var(--border-soft)" }} />
                <div className="sp-tickets px-6 py-5">
                  <p
                    className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Descargar tickets
                  </p>
                  <div className="space-y-2">
                    {order.tickets.map((ticket, index) => (
                      <a
                        key={ticket.id}
                        href={`/api/public/orders/${encodeURIComponent(order.id)}/ticket/${encodeURIComponent(ticket.id)}/pdf?email=${encodeURIComponent(order.buyerEmail)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="sp-stub flex items-center justify-between gap-4 rounded-xl px-4 py-3"
                        style={{
                          background: "var(--bg-page)",
                          border: "1px solid var(--border-soft)",
                        }}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
                            style={{
                              background: "rgba(109,40,217,0.08)",
                              color: "var(--brand-violet)",
                            }}
                            aria-hidden="true"
                          >
                            {index + 1}
                          </span>
                          <span
                            className="min-w-0 truncate font-mono text-[12px]"
                            style={{ color: "var(--text-secondary)", letterSpacing: "0.05em" }}
                          >
                            {ticket.code}
                          </span>
                        </div>
                        <span
                          className="shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold"
                          style={{
                            borderColor: "var(--brand-magenta)",
                            color: "var(--brand-magenta)",
                          }}
                        >
                          Descargar PDF
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── CTA ──────────────────────────────────────────────── */}
            <div style={{ borderTop: "1px solid var(--border-soft)" }} />
            <div className="sp-cta px-6 py-5">
              <Link
                href={eventUrl}
                className="flex w-full items-center justify-center rounded-full py-3.5 font-display text-[15px] font-bold text-white transition-transform duration-200 hover:-translate-y-0.5"
                style={{
                  background: "var(--grad-hero)",
                  boxShadow: "var(--shadow-glow-accent)",
                }}
              >
                Volver al evento
              </Link>
            </div>
          </div>

          {/* ── FOOTER ─────────────────────────────────────────────────── */}
          <p
            className="mt-8 text-center text-[11px]"
            style={{ color: "var(--text-muted)", opacity: 0.75 }}
          >
            © {new Date().getFullYear()} Tickets · by Aiderbrand
          </p>

        </div>
      </div>
    </>
  );
}
