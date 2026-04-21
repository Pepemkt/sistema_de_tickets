"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { centsToCurrency } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────────── */
type TicketType = {
  id: string;
  name: string;
  priceCents: number;
  saleMode: "PUBLIC" | "COUPON_ONLY" | "HIDDEN";
  maxPerOrder: number | null;
  maxPerEmail: number | null;
};

type Props = {
  eventId: string;
  eventName: string;
  ticketTypes: TicketType[];
  allowDevSimulation?: boolean;
};

/* ─────────────────────────────────────────────────────────────────────────────
   CSS — injected into shadow DOM of the component via <style>
   We use a data attr selector so the styles are scoped without CSS modules.
───────────────────────────────────────────────────────────────────────────── */
const CARD_STYLES = `
@keyframes cc-field-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes cc-toast-in {
  from { opacity: 0; transform: translateX(100%) scale(0.95); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes cc-total-flash {
  0%   { transform: scale(1); }
  30%  { transform: scale(1.06); filter: brightness(1.2); }
  100% { transform: scale(1); filter: brightness(1); }
}
@keyframes cc-dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.35; transform: scale(0.65); }
}
@keyframes cc-spin {
  to { transform: rotate(360deg); }
}
@keyframes cc-quote-slide {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

[data-cc="root"] .cc-field { animation: cc-field-in 0.4s var(--ease-tactile) both; }
[data-cc="root"] .cc-field:nth-child(1) { animation-delay: 0.06s; }
[data-cc="root"] .cc-field:nth-child(2) { animation-delay: 0.11s; }
[data-cc="root"] .cc-field:nth-child(3) { animation-delay: 0.16s; }
[data-cc="root"] .cc-field:nth-child(4) { animation-delay: 0.21s; }
[data-cc="root"] .cc-field:nth-child(5) { animation-delay: 0.26s; }
[data-cc="root"] .cc-field:nth-child(6) { animation-delay: 0.31s; }

.cc-toast { animation: cc-toast-in 0.35s var(--ease-spring) both; }
.cc-total-flash { animation: cc-total-flash 0.4s var(--ease-spring) both; }
.cc-dot-active { animation: cc-dot-pulse 1.8s ease-in-out infinite; }
.cc-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: cc-spin 0.7s linear infinite;
  display: inline-block;
  flex-shrink: 0;
}
.cc-quote-row { animation: cc-quote-slide 0.3s var(--ease-tactile) both; }

/* Glass card surface */
.cc-glass {
  background: linear-gradient(
    160deg,
    rgba(255,255,255,0.98) 0%,
    rgba(247,247,251,0.96) 100%
  );
  border: 1px solid var(--border-soft);
  box-shadow:
    0 2px 6px rgba(21,22,43,0.06),
    0 16px 40px rgba(21,22,43,0.09),
    inset 0 1px 0 rgba(255,255,255,0.9);
}

/* Monospace coupon input */
.cc-coupon-input {
  font-family: var(--font-mono);
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

/* Stepper button */
.cc-stepper-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1.5px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color 0.14s ease, background 0.14s ease, transform 0.1s ease;
  user-select: none;
  flex-shrink: 0;
}
.cc-stepper-btn:hover:not(:disabled) {
  border-color: var(--brand-magenta);
  color: var(--brand-magenta);
  background: rgba(255,232,242,0.4);
  transform: scale(1.08);
}
.cc-stepper-btn:active:not(:disabled) {
  transform: scale(0.96);
}
.cc-stepper-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

/* Input focus override */
.cc-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1.5px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.cc-input:focus {
  border-color: var(--border-focus);
  box-shadow: var(--shadow-focus);
}
.cc-input::placeholder { color: var(--text-muted); }
.cc-input:disabled { opacity: 0.5; cursor: not-allowed; }

/* Select */
.cc-select {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1.5px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234B4F6B' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.cc-select:focus {
  border-color: var(--border-focus);
  box-shadow: var(--shadow-focus);
}

/* Label micro-style */
.cc-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 5px;
}

/* Section divider */
.cc-divider {
  height: 1px;
  background: var(--border-soft);
  margin: 0 -20px;
}

/* Primary CTA */
.cc-cta-primary {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px 24px;
  border-radius: 9999px;
  background: linear-gradient(135deg, #EC2A8A 0%, #DB1E7A 100%);
  color: #fff;
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.01em;
  border: none;
  cursor: pointer;
  box-shadow:
    0 0 0 1px rgba(236,42,138,0.28),
    0 8px 24px rgba(236,42,138,0.35);
  transition: transform 0.18s var(--ease-tactile), box-shadow 0.18s ease, opacity 0.15s ease;
}
.cc-cta-primary:hover:not(:disabled) {
  transform: translateY(-1.5px);
  box-shadow:
    0 0 0 1px rgba(236,42,138,0.35),
    0 12px 32px rgba(236,42,138,0.45);
}
.cc-cta-primary:active:not(:disabled) {
  transform: translateY(0);
}
.cc-cta-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

/* Dev simulation button */
.cc-cta-dev {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 10px 20px;
  border-radius: 12px;
  border: 1.5px dashed var(--border-strong);
  background: var(--bg-sunken);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}
.cc-cta-dev:hover:not(:disabled) {
  border-color: var(--brand-violet);
  color: var(--brand-violet);
  background: rgba(244,242,253,0.6);
}
.cc-cta-dev:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Quote readout */
.cc-quote-panel {
  border-radius: 14px;
  background: linear-gradient(160deg, rgba(12,13,28,0.96) 0%, rgba(30,11,74,0.94) 100%);
  padding: 16px 18px;
  border: 1px solid rgba(255,255,255,0.07);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
}
`;

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export function CheckoutCard({ eventId, eventName, ticketTypes, allowDevSimulation = true }: Props) {
  /* ── State ── */
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [ticketTypeId, setTicketTypeId] = useState(ticketTypes[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [couponCode, setCouponCode] = useState("");
  const [quote, setQuote] = useState<{ subtotalCents: number; discountCents: number; totalCents: number } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [totalKey, setTotalKey] = useState(0); // triggers flash animation

  const simulationsEnabled = allowDevSimulation && process.env.NEXT_PUBLIC_ENABLE_DEV_SIMULATIONS === "true";

  /* ── Derived values ── */
  const selected = useMemo(() => ticketTypes.find((item) => item.id === ticketTypeId), [ticketTypeId, ticketTypes]);
  const total = (selected?.priceCents ?? 0) * quantity;
  const previewTotal = quote?.totalCents ?? total;
  const previewSubtotal = quote?.subtotalCents ?? total;
  const previewDiscount = quote?.discountCents ?? 0;

  /* ── Effects ── */

  // Clamp quantity to maxPerOrder
  useEffect(() => {
    if (!selected) return;
    if (selected.maxPerOrder && quantity > selected.maxPerOrder) {
      setQuantity(selected.maxPerOrder);
    }
    if (quantity < 1) {
      setQuantity(1);
    }
  }, [selected, quantity]);

  // Quote fetch with debounce + abort
  useEffect(() => {
    if (!selected) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    const normalizedEmail = buyerEmail.trim().toLowerCase();
    const buyerEmailForQuote = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ? normalizedEmail : undefined;
    const normalizedCoupon = couponCode.trim();
    if (!normalizedCoupon && selected.saleMode === "COUPON_ONLY") {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/orders/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            ticketTypeId,
            quantity,
            buyerEmail: buyerEmailForQuote,
            couponCode: normalizedCoupon || undefined
          }),
          signal: controller.signal
        });
        const data = await res.json();
        if (!res.ok) {
          setQuote(null);
          setQuoteError(typeof data.error === "string" ? data.error : "No se pudo validar el cupón");
          return;
        }

        setQuote({
          subtotalCents: typeof data.subtotalCents === "number" ? data.subtotalCents : total,
          discountCents: typeof data.discountCents === "number" ? data.discountCents : 0,
          totalCents: typeof data.totalCents === "number" ? data.totalCents : total
        });
        setQuoteError(null);
        setTotalKey((k) => k + 1); // trigger flash
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setQuote(null);
        setQuoteError("No se pudo validar el cupón en este momento");
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [buyerEmail, couponCode, eventId, quantity, selected, ticketTypeId, total]);

  /* ── Handlers ── */

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          ticketTypeId,
          quantity,
          buyerName,
          buyerEmail,
          buyerPhone: buyerPhone.trim() || undefined,
          couponCode: couponCode.trim() || undefined
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "No se pudo crear la compra");
        return;
      }

      if (data.initPoint) {
        window.location.href = data.initPoint;
      }
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  async function onSimulatePurchase() {
    setError(null);
    setSuccess(null);
    setSimLoading(true);

    const res = await fetch("/api/dev/simulate-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        ticketTypeId,
        quantity,
        buyerName,
        buyerEmail,
        buyerPhone: buyerPhone.trim() || undefined,
        couponCode: couponCode.trim() || undefined,
        sendEmail: true
      })
    });

    const data = await res.json();
    setSimLoading(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo simular la compra");
      return;
    }

    if (data.emailSent) {
      setSuccess(`Compra simulada OK. Email enviado. Preview: ${data.previewPath}`);
    } else {
      setSuccess(`Compra simulada OK. Preview: ${data.previewPath}. Email pendiente/error: ${data.emailError ?? "SMTP no configurado"}`);
    }
  }

  /* ── Coupon status dot ── */
  const couponStatus: "idle" | "active" | "error" =
    quoteError ? "error"
    : quote && couponCode.trim() && previewDiscount > 0 ? "active"
    : "idle";

  const couponDotColor =
    couponStatus === "active" ? "#1FAE4A"
    : couponStatus === "error" ? "#E11D48"
    : "var(--text-muted)";

  return (
    <>
      <style>{CARD_STYLES}</style>

      {/* Toast — floating top-right fixed, scoped to nearest positioned ancestor */}
      {(error || success) && (
        <div
          className="cc-toast pointer-events-none fixed right-4 top-4 z-50 max-w-sm"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div
            className="rounded-xl px-4 py-3 shadow-lg"
            style={
              error
                ? {
                    background: "#FEE8EC",
                    border: "1px solid rgba(225,29,72,0.25)",
                    color: "#9F1239"
                  }
                : {
                    background: "#E9F9EE",
                    border: "1px solid rgba(31,174,74,0.25)",
                    color: "#117A30"
                  }
            }
          >
            <div className="flex items-start gap-2.5">
              {error ? (
                <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              ) : (
                <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              )}
              <p className="text-[12px] font-semibold leading-snug">
                {error ?? success}
              </p>
            </div>
          </div>
        </div>
      )}

      <aside data-cc="root" className="cc-glass rounded-2xl overflow-hidden">

        {/* ── CARD HEADER ─────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden px-5 py-5"
          style={{
            background: "linear-gradient(135deg, var(--clr-arena-800) 0%, var(--clr-forest-800) 100%)"
          }}
        >
          {/* Ambient glow */}
          <div
            className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full"
            style={{ background: "rgba(236,42,138,0.18)", filter: "blur(48px)" }}
            aria-hidden="true"
          />

          {/* Staff badge */}
          <div className="mb-3 flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5"
              style={{
                background: "rgba(236,42,138,0.15)",
                border: "1px solid rgba(236,42,138,0.30)"
              }}
            >
              <span
                className="cc-dot-active h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--brand-magenta)" }}
              />
              <span
                className="font-display text-[9px] font-extrabold uppercase tracking-[0.15em]"
                style={{ color: "var(--brand-magenta)" }}
              >
                Caja staff
              </span>
            </span>
          </div>

          <h2
            className="font-display font-extrabold leading-tight tracking-tight text-white"
            style={{ fontSize: "clamp(1.1rem, 3vw, 1.3rem)" }}
          >
            Emisión de entradas
          </h2>
          <p className="mt-1 truncate text-[12px] text-white/50">{eventName}</p>

          {/* Perforation row */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0"
            aria-hidden="true"
          >
            <div
              style={{
                height: "1px",
                background: "rgba(255,255,255,0.08)"
              }}
            />
          </div>
        </div>

        {/* ── FORM BODY ───────────────────────────────────────────── */}
        {ticketTypes.length === 0 ? (
          <div className="px-5 py-6">
            <div
              className="rounded-xl border px-4 py-4 text-[13px] font-semibold"
              style={{
                borderColor: "rgba(245,158,11,0.30)",
                background: "rgba(255,244,224,0.6)",
                color: "#9B5F17"
              }}
            >
              Este evento no tiene entradas habilitadas para compra online.
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="px-5 py-5 space-y-0">

            {/* ── SECTION: COMPRADOR ── */}
            <div className="mb-1 flex items-center gap-2">
              <p
                className="text-[10px] font-extrabold uppercase tracking-[0.15em]"
                style={{ color: "var(--brand-violet)" }}
              >
                Datos del comprador
              </p>
              <div className="h-px flex-1" style={{ background: "var(--border-soft)" }} />
            </div>

            <div className="space-y-3 pb-4">
              <div className="cc-field">
                <label className="cc-label" htmlFor="cc-name">Nombre completo</label>
                <input
                  id="cc-name"
                  className="cc-input"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  required
                  placeholder="Ej: María González"
                  autoComplete="name"
                />
              </div>

              <div className="cc-field">
                <label className="cc-label" htmlFor="cc-email">Email</label>
                <input
                  id="cc-email"
                  type="email"
                  className="cc-input"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  required
                  placeholder="correo@ejemplo.com"
                  autoComplete="email"
                />
              </div>

              <div className="cc-field">
                <label className="cc-label" htmlFor="cc-phone">Teléfono <span style={{ color: "var(--text-muted)", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(opcional)</span></label>
                <input
                  id="cc-phone"
                  className="cc-input"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="+54 11 5555 5555"
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* ── SECTION: ENTRADA ── */}
            <div className="cc-divider" />
            <div className="my-4 flex items-center gap-2">
              <p
                className="text-[10px] font-extrabold uppercase tracking-[0.15em]"
                style={{ color: "var(--brand-magenta)" }}
              >
                Selección de entrada
              </p>
              <div className="h-px flex-1" style={{ background: "var(--border-soft)" }} />
            </div>

            <div className="space-y-3 pb-4">
              {/* Ticket type picker */}
              <div className="cc-field">
                <label className="cc-label" htmlFor="cc-ticket-type">Tipo de entrada</label>
                <select
                  id="cc-ticket-type"
                  className="cc-select"
                  value={ticketTypeId}
                  onChange={(e) => setTicketTypeId(e.target.value)}
                >
                  {ticketTypes.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name} — {centsToCurrency(item.priceCents)}
                      {item.saleMode === "COUPON_ONLY" ? " (requiere cupón)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity stepper */}
              <div className="cc-field">
                <label className="cc-label" htmlFor="cc-qty">Cantidad</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="cc-stepper-btn"
                    aria-label="Restar"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>

                  <input
                    id="cc-qty"
                    type="number"
                    min={1}
                    max={selected?.maxPerOrder ?? 100}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="cc-input text-center tabular-nums font-bold"
                    style={{ width: "72px", flexShrink: 0 }}
                  />

                  <button
                    type="button"
                    className="cc-stepper-btn"
                    aria-label="Sumar"
                    disabled={!!selected?.maxPerOrder && quantity >= selected.maxPerOrder}
                    onClick={() => setQuantity((q) => Math.min(selected?.maxPerOrder ?? 100, q + 1))}
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>

                  <div className="flex-1 space-y-0.5">
                    {selected?.maxPerOrder ? (
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        Máx. {selected.maxPerOrder} por compra
                      </p>
                    ) : null}
                    {selected?.maxPerEmail ? (
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        Máx. {selected.maxPerEmail} por email
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Coupon code */}
              <div className="cc-field">
                <label className="cc-label" htmlFor="cc-coupon">
                  Cupón
                  {selected?.saleMode === "COUPON_ONLY" && (
                    <span
                      className="ml-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                      style={{
                        background: "rgba(245,158,11,0.15)",
                        color: "#9B5F17",
                        border: "1px solid rgba(245,158,11,0.30)"
                      }}
                    >
                      Obligatorio
                    </span>
                  )}
                </label>
                <div className="relative flex items-center gap-0">
                  {/* Pulse dot */}
                  <span
                    className={`absolute left-3 h-2 w-2 rounded-full ${couponStatus === "active" || couponStatus === "error" ? "cc-dot-active" : ""}`}
                    style={{ background: couponDotColor }}
                    aria-hidden="true"
                  />
                  <input
                    id="cc-coupon"
                    className="cc-input cc-coupon-input"
                    style={{ paddingLeft: "28px" }}
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder={selected?.saleMode === "COUPON_ONLY" ? "CODIGO REQUERIDO" : "EJ: EXPOSITOR2026"}
                    required={selected?.saleMode === "COUPON_ONLY"}
                  />
                </div>
                {quoteError && (
                  <p
                    className="mt-1.5 text-[11px] font-semibold"
                    style={{ color: "var(--clr-danger-700)" }}
                  >
                    {quoteError}
                  </p>
                )}
              </div>
            </div>

            {/* ── QUOTE READOUT ── */}
            <div className="cc-divider" />
            <div className="py-4">
              <div className="cc-quote-panel">
                {/* Subtotal row */}
                <div className="cc-quote-row flex items-center justify-between gap-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: "rgba(255,255,255,0.40)" }}
                  >
                    Subtotal
                  </span>
                  <span
                    className="tabular-nums text-[13px] font-semibold"
                    style={{
                      color: previewDiscount > 0 ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.80)",
                      textDecoration: previewDiscount > 0 ? "line-through" : "none"
                    }}
                  >
                    {centsToCurrency(previewSubtotal)}
                  </span>
                </div>

                {/* Discount row — only when active */}
                {previewDiscount > 0 && (
                  <div className="cc-quote-row mt-2 flex items-center justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em]"
                      style={{ color: "rgba(31,174,74,0.85)" }}
                    >
                      <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                      </svg>
                      Descuento
                    </span>
                    <span
                      className="tabular-nums text-[13px] font-bold"
                      style={{ color: "#1FAE4A" }}
                    >
                      -{centsToCurrency(previewDiscount)}
                    </span>
                  </div>
                )}

                {/* Divider */}
                <div
                  className="my-3 h-px"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                />

                {/* Total */}
                <div className="flex items-end justify-between gap-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: "rgba(255,255,255,0.40)" }}
                  >
                    Total a pagar
                  </span>
                  <span
                    key={totalKey}
                    className="cc-total-flash tabular-nums font-display font-extrabold leading-none tracking-tight"
                    style={{
                      fontSize: "clamp(1.5rem, 4vw, 1.875rem)",
                      background: "linear-gradient(90deg, #EC2A8A 0%, #C41A6E 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text"
                    }}
                  >
                    {centsToCurrency(previewTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* ── CTA ROW ── */}
            <div className="space-y-3 pb-1">

              {/* Primary: Ir a pagar */}
              <button
                type="submit"
                className="cc-cta-primary"
                disabled={loading || !selected}
              >
                {loading ? (
                  <>
                    <span className="cc-spinner" aria-hidden="true" />
                    Conectando con Mercado Pago…
                  </>
                ) : (
                  <>
                    Ir a pagar
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>

              {/* Dev simulation — only when enabled */}
              {simulationsEnabled && (
                <div>
                  <div
                    className="mb-2 flex items-center gap-1.5"
                    aria-hidden="true"
                  >
                    <div className="h-px flex-1" style={{ background: "var(--border-soft)" }} />
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
                      style={{
                        background: "var(--bg-sunken)",
                        border: "1px solid var(--border-strong)",
                        color: "var(--text-muted)"
                      }}
                    >
                      DEV
                    </span>
                    <div className="h-px flex-1" style={{ background: "var(--border-soft)" }} />
                  </div>
                  <button
                    type="button"
                    className="cc-cta-dev"
                    disabled={simLoading || !selected}
                    onClick={onSimulatePurchase}
                  >
                    {simLoading ? (
                      <>
                        <span
                          className="cc-spinner"
                          style={{
                            borderColor: "rgba(91,33,182,0.30)",
                            borderTopColor: "var(--brand-violet)"
                          }}
                          aria-hidden="true"
                        />
                        Simulando…
                      </>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        Simular pago aprobado
                      </>
                    )}
                  </button>
                </div>
              )}

            </div>

          </form>
        )}

      </aside>
    </>
  );
}
