"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { centsToCurrency } from "@/lib/utils";
import { CheckoutFeeItem, calculateCheckoutAmounts } from "@/lib/checkout-fees";
import { trackAnalyticsStep } from "@/lib/analytics-client";
import type { RegistrationFieldDefinition } from "@/lib/registration-fields";

type TicketType = {
  id: string;
  name: string;
  priceCents: number;
  stock: number;
  saleMode: "PUBLIC" | "COUPON_ONLY" | "HIDDEN";
  maxPerOrder: number | null;
};

type Props = {
  eventId: string;
  eventSlug: string;
  eventName: string;
  eventDateText: string;
  ticketTypes: TicketType[];
  registrationFields?: RegistrationFieldDefinition[];
  feeItems: CheckoutFeeItem[];
};

export function PublicCheckout({ eventId, eventSlug, eventName, eventDateText, ticketTypes, registrationFields = [], feeItems }: Props) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [ticketTypeId, setTicketTypeId] = useState(ticketTypes[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [couponCode, setCouponCode] = useState("");
  const [registrationAnswers, setRegistrationAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(registrationFields.map((field) => [field.key, ""]))
  );
  const [quote, setQuote] = useState<{
    subtotalCents: number;
    discountCents: number;
    totalCents: number;
    couponApplied: boolean;
  } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasTrackedCheckoutStarted = useRef(false);

  const selected = useMemo(() => ticketTypes.find((item) => item.id === ticketTypeId) ?? null, [ticketTypeId, ticketTypes]);
  const subtotal = (selected?.priceCents ?? 0) * quantity;
  const fallbackAmounts = calculateCheckoutAmounts(subtotal, feeItems);
  const totalCents = quote?.totalCents ?? fallbackAmounts.totalCents;
  const subtotalCents = quote?.subtotalCents ?? fallbackAmounts.subtotalCents;
  const discountCents = quote?.discountCents ?? 0;
  const isFreeCheckout = totalCents === 0;

  useEffect(() => {
    setRegistrationAnswers((current) => {
      const next: Record<string, string> = {};
      for (const field of registrationFields) {
        next[field.key] = current[field.key] ?? "";
      }
      return next;
    });
  }, [registrationFields]);

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
          setQuoteError(typeof data.error === "string" ? data.error : "No se pudo validar el cupon");
          return;
        }

        setQuote({
          subtotalCents: typeof data.subtotalCents === "number" ? data.subtotalCents : subtotal,
          discountCents: typeof data.discountCents === "number" ? data.discountCents : 0,
          totalCents: typeof data.totalCents === "number" ? data.totalCents : fallbackAmounts.totalCents,
          couponApplied: Boolean(data.couponApplied)
        });
        setQuoteError(null);
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === "AbortError") {
          return;
        }
        setQuote(null);
        setQuoteError("No se pudo validar el cupon en este momento");
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [buyerEmail, couponCode, eventId, fallbackAmounts.totalCents, quantity, selected, subtotal, ticketTypeId]);

  function changeQuantity(delta: number) {
    trackCheckoutStarted();
    const next = Math.max(1, quantity + delta);
    if (selected?.maxPerOrder && next > selected.maxPerOrder) return;
    setQuantity(next);
  }

  function trackCheckoutStarted() {
    if (hasTrackedCheckoutStarted.current) return;
    hasTrackedCheckoutStarted.current = true;
    trackAnalyticsStep({ step: "checkout_started", eventSlug });
  }

  async function createOrder() {
    setError(null);
    setLoading(true);
    trackCheckoutStarted();
    trackAnalyticsStep({ step: "checkout_submit", eventSlug, transport: "beacon" });

    try {
      const normalizedBuyerEmail = buyerEmail.trim().toLowerCase();
      const endpoint = isFreeCheckout ? "/api/orders/free" : "/api/orders";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          ticketTypeId,
          quantity,
          buyerName,
          buyerEmail: normalizedBuyerEmail,
          buyerPhone: buyerPhone.trim() || undefined,
          couponCode: couponCode.trim() || undefined,
          registrationAnswers: registrationFields.map((field) => ({ key: field.key, value: registrationAnswers[field.key] ?? "" }))
        })
      });
      const data = await res.json();
      if (!res.ok) {
        trackAnalyticsStep({ step: "checkout_error", eventSlug });
        setError(data.error ?? "No se pudo crear la compra");
        return;
      }
      if (data.successUrl) {
        trackAnalyticsStep({ step: "checkout_redirect", eventSlug, transport: "beacon" });
        window.location.href = data.successUrl;
        return;
      }
      if (data.initPoint) {
        trackAnalyticsStep({ step: "checkout_redirect", eventSlug, transport: "beacon" });
        window.location.href = data.initPoint;
      }
    } catch {
      trackAnalyticsStep({ step: "checkout_error", eventSlug });
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await createOrder();
  }

  return (
    <>
      <style>{`
        @keyframes co-slide-in {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes co-ticket-in {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .co-form   { animation: co-slide-in  0.5s var(--ease-tactile) 0.05s both; }
        .co-aside  { animation: co-slide-in  0.5s var(--ease-tactile) 0.15s both; }
        .co-step {
          display: flex;
          align-items: baseline;
          gap: 0.75rem;
          margin-bottom: 0.25rem;
        }
        .co-step-num {
          flex-shrink: 0;
          width: 1.5rem;
          height: 1.5rem;
          border-radius: 9999px;
          background: var(--clr-forest-800);
          color: #fff;
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 0.6875rem;
          display: flex;
          align-items: center;
          justify-content: center;
          letter-spacing: 0;
        }
        .ticket-opt {
          transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s var(--ease-tactile), box-shadow 0.15s ease;
        }
        .ticket-opt:hover:not(.ticket-opt-active) {
          border-color: var(--clr-arena-300);
          transform: translateX(3px);
          box-shadow: var(--shadow-sm);
        }
        .ticket-opt-active {
          border-color: var(--brand-magenta);
          background: var(--clr-coral-50);
          box-shadow: 0 0 0 1px var(--brand-magenta), var(--shadow-xs);
        }
        .qty-btn {
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 9999px;
          border: 1.5px solid var(--border-strong);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text-primary);
          background: var(--bg-surface);
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease, transform 0.12s var(--ease-spring);
        }
        .qty-btn:hover { background: var(--bg-sunken); border-color: var(--clr-arena-400); }
        .qty-btn:active { transform: scale(0.92); }
        /* Serrated ticket edge — SVG-based left/right notch */
        .ticket-stub-edge {
          position: relative;
          overflow: visible;
        }
        .ticket-stub-edge::before,
        .ticket-stub-edge::after {
          content: '';
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: var(--bg-page);
          z-index: 1;
        }
        .ticket-stub-edge::before { left: -7px; }
        .ticket-stub-edge::after  { right: -7px; }
        /* Dashed perforation line */
        .perforation {
          border: none;
          border-top: 2px dashed var(--border-soft);
          margin: 0;
        }
        /* Total price pulse on change */
        @keyframes price-flash {
          0%   { opacity: 0.5; transform: scale(0.96); }
          100% { opacity: 1;   transform: scale(1); }
        }
        .price-val { animation: price-flash 0.25s var(--ease-spring); }
      `}</style>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_420px]">

        {/* ── LEFT COLUMN: FORM ─────────────────────────────────────── */}
        <form onSubmit={onSubmit} className="co-form space-y-6">

          {/* Step 1: Buyer info */}
          <section className="overflow-hidden rounded-2xl border border-soft bg-surface shadow-md">
            <div className="border-b border-soft px-6 py-5">
              <div className="co-step">
                <span className="co-step-num">1</span>
                <div>
                  <h2 className="font-display text-title-m font-extrabold text-primary">Tus datos</h2>
                  <p className="text-caption text-muted">{eventName} · {eventDateText}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="label">Nombre completo</label>
                  <input
                    className="field"
                    value={buyerName}
                    onChange={(event) => {
                      trackCheckoutStarted();
                      setBuyerName(event.target.value);
                    }}
                    required
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    className="field"
                    type="email"
                    value={buyerEmail}
                    onChange={(event) => {
                      trackCheckoutStarted();
                      setBuyerEmail(event.target.value);
                    }}
                    required
                  />
                </div>
                <div>
                  <label className="label">Telefono</label>
                  <input
                    className="field"
                    value={buyerPhone}
                    onChange={(event) => {
                      trackCheckoutStarted();
                      setBuyerPhone(event.target.value);
                    }}
                    placeholder="+54 11 5555 5555"
                  />
                </div>
              </div>

              {registrationFields.length > 0 && (
                <div className="mt-5 space-y-4 border-t border-soft pt-4">
                  {registrationFields.map((field) => (
                    <div key={field.key}>
                      <label className="label">
                        {field.label}
                        {field.required ? " *" : ""}
                      </label>
                      <input
                        className="field"
                        value={registrationAnswers[field.key] ?? ""}
                        onChange={(event) => {
                          trackCheckoutStarted();
                          setRegistrationAnswers((current) => ({
                            ...current,
                            [field.key]: event.target.value
                          }));
                        }}
                        placeholder={field.placeholder || undefined}
                        required={field.required}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Step 2: Ticket selection */}
          <section className="overflow-hidden rounded-2xl border border-soft bg-surface shadow-md">
            <div className="border-b border-soft px-6 py-5">
              <div className="co-step">
                <span className="co-step-num">2</span>
                <div>
                  <h3 className="font-display text-title-m font-extrabold text-primary">Elegí tu entrada</h3>
                  <p className="text-caption text-muted">Seleccioná el tipo y la cantidad</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <div className="space-y-2.5">
                {ticketTypes.map((type) => {
                  const active = type.id === ticketTypeId;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        trackCheckoutStarted();
                        setTicketTypeId(type.id);
                      }}
                      className={`ticket-opt w-full rounded-xl border-[1.5px] p-4 text-left ${active ? "ticket-opt-active" : "border-soft bg-sunken"}`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Radio indicator */}
                        <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${active ? "border-[color:var(--brand-magenta)] bg-[color:var(--brand-magenta)]" : "border-[color:var(--border-strong)]"}`}>
                          {active && <span className="flex h-full w-full items-center justify-center"><span className="h-1.5 w-1.5 rounded-full bg-white" /></span>}
                        </span>
                        <div className="flex flex-1 items-center justify-between gap-2">
                          <div>
                            <p className="text-body font-bold text-primary">{type.name}</p>
                            <p className="text-caption text-muted">{type.stock} disponibles</p>
                          </div>
                          <p className="shrink-0 font-display text-title-s font-extrabold text-[color:var(--brand-magenta)]">
                            {centsToCurrency(type.priceCents)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Quantity selector */}
              <div className="mt-5 flex items-center gap-4 border-t border-soft pt-4">
                <span className="text-body-s font-semibold text-secondary">Cantidad</span>
                <div className="flex items-center gap-3">
                  <button type="button" className="qty-btn" onClick={() => changeQuantity(-1)} aria-label="Menos">−</button>
                  <span className="w-8 text-center font-display text-title-s font-extrabold text-primary">{quantity}</span>
                  <button type="button" className="qty-btn" onClick={() => changeQuantity(1)} aria-label="Mas">+</button>
                </div>
                {selected && (
                  <span className="ml-auto text-caption text-muted">
                    {selected.maxPerOrder ? `Máx. ${selected.maxPerOrder} por orden` : "Sin límite"}
                  </span>
                )}
              </div>
            </div>
          </section>
        </form>

        {/* ── RIGHT COLUMN: ORDER SUMMARY (ticket stub) ──────────────── */}
        <aside className="co-aside h-fit lg:sticky lg:top-6">
          {/* Ticket stub container */}
          <div className="overflow-hidden rounded-2xl border border-soft bg-surface shadow-xl">

            {/* Stub header — dark brand strip */}
            <div className="bg-gradient-to-br from-forest-800 via-[color:var(--brand-violet)] to-forest-700 px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">Tu orden</p>
              <p className="mt-1 font-display text-title-m font-extrabold leading-tight text-white">{eventName}</p>
              <p className="mt-1 text-caption text-white/60">{eventDateText}</p>
            </div>

            {/* Perforation line with notches */}
            <div className="ticket-stub-edge relative mx-0 overflow-hidden border-t border-b border-dashed border-soft bg-surface py-px">
              <hr className="perforation" />
            </div>

            {/* Summary rows */}
            <div className="space-y-2.5 px-6 py-5 text-body-s">

              {/* Ticket line */}
              {selected && (
                <div className="flex items-center justify-between">
                  <span className="text-secondary">
                    {selected.name} × {quantity}
                  </span>
                  <span className="font-semibold text-primary">{centsToCurrency(subtotalCents)}</span>
                </div>
              )}

              {/* Fee items */}
              {fallbackAmounts.appliedItems.map((item) => (
                <div className="flex items-center justify-between" key={item.id}>
                  <span className="text-muted">{item.name}</span>
                  <span className="font-semibold text-primary">{centsToCurrency(item.amountCents)}</span>
                </div>
              ))}

              {/* Discount */}
              {discountCents > 0 && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-success-700">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l1.5 1.5 4.5-4.5M12 3a2.25 2.25 0 00-2.25 2.25c0 .597-.237 1.169-.659 1.591l-.82.819a2.25 2.25 0 000 3.182l.82.819c.422.422.659.994.659 1.59A2.25 2.25 0 0012 15.75a2.25 2.25 0 002.25-2.25c0-.596.237-1.168.659-1.59l.82-.82a2.25 2.25 0 000-3.182l-.82-.818a2.25 2.25 0 01-.659-1.591A2.25 2.25 0 0012 3z" />
                    </svg>
                    Descuento cupón
                  </span>
                  <span className="font-bold text-success-700">-{centsToCurrency(discountCents)}</span>
                </div>
              )}

              {/* Coupon input */}
              <div className="pt-1">
                <label className="label">Código de cupón</label>
                <div className="relative">
                  <input
                    className="field pr-10 uppercase tracking-widest"
                    value={couponCode}
                    onChange={(event) => {
                      trackCheckoutStarted();
                      setCouponCode(event.target.value.toUpperCase());
                    }}
                    placeholder="PROMO2025"
                    required={selected?.saleMode === "COUPON_ONLY"}
                  />
                  {couponCode && !quoteError && quote?.couponApplied && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-success-500">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </span>
                  )}
                </div>
                {quoteError && (
                  <p className="mt-1.5 flex items-center gap-1 text-caption text-danger-500">
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    {quoteError}
                  </p>
                )}
              </div>
            </div>

            {/* Second perforation before total */}
            <div className="ticket-stub-edge relative overflow-hidden border-t border-b border-dashed border-soft bg-surface py-px mx-0">
              <hr className="perforation" />
            </div>

            {/* Total + CTA */}
            <div className="px-6 py-5">
              <div className="flex items-center justify-between">
                <span className="font-display text-body-l font-bold text-primary">Total</span>
                <span key={totalCents} className="price-val font-display text-display-m font-extrabold text-[color:var(--brand-magenta)]">
                  {centsToCurrency(totalCents)}
                </span>
              </div>

              <button
                onClick={() => void createOrder()}
                disabled={loading || !selected}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--brand-magenta)] py-3.5 font-display text-[15px] font-bold text-white shadow-[var(--shadow-glow-accent)] transition-all duration-base hover:-translate-y-0.5 hover:bg-[color:var(--brand-magenta-dark)] hover:shadow-[0_12px_32px_rgba(236,42,138,0.5)] disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {isFreeCheckout ? "Registrando..." : "Procesando..."}
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                    </svg>
                    {isFreeCheckout ? "Registrarme gratis" : "Emitir y procesar pago"}
                  </>
                )}
              </button>

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-danger-500/30 bg-danger-50 px-4 py-3 text-body-s text-danger-500">
                  <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="mt-4 flex items-center justify-center gap-1.5 text-caption text-muted">
                {isFreeCheckout ? (
                  <>
                    <svg className="h-3.5 w-3.5 text-success-500" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 2a10 10 0 100 20 10 10 0 000-20zm4.28 7.22a.75.75 0 10-1.06-1.06L10.5 12.88 8.78 11.16a.75.75 0 10-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l5.25-5.25z" clipRule="evenodd" />
                    </svg>
                    Registro gratuito con envío de ticket por email
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5 text-success-500" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                    </svg>
                    Pago 100% seguro vía Mercado Pago
                  </>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
