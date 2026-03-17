"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { centsToCurrency } from "@/lib/utils";
import { CheckoutFeeItem, calculateCheckoutAmounts } from "@/lib/checkout-fees";
import { trackAnalyticsStep } from "@/lib/analytics-client";

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
  feeItems: CheckoutFeeItem[];
};

export function PublicCheckout({ eventId, eventSlug, eventName, eventDateText, ticketTypes, feeItems }: Props) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [ticketTypeId, setTicketTypeId] = useState(ticketTypes[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [couponCode, setCouponCode] = useState("");
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
        trackAnalyticsStep({ step: "checkout_error", eventSlug });
        setError(data.error ?? "No se pudo crear la compra");
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
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <form onSubmit={onSubmit} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-3xl font-semibold text-slate-900">Datos del comprador</h2>
          <p className="mt-1 text-sm text-slate-500">
            {eventName} · {eventDateText}
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
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
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-2xl font-semibold text-slate-900">Seleccion de entradas</h3>
          <div className="mt-4 space-y-3">
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
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    active ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-slate-900">{type.name}</p>
                    <p className="text-xl font-semibold text-blue-700">{centsToCurrency(type.priceCents)}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Stock: {type.stock}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button type="button" className="h-9 w-9 rounded-full border border-slate-300 text-lg" onClick={() => changeQuantity(-1)}>
              -
            </button>
            <span className="w-8 text-center text-lg font-semibold">{quantity}</span>
            <button type="button" className="h-9 w-9 rounded-full border border-slate-300 text-lg" onClick={() => changeQuantity(1)}>
              +
            </button>
          </div>
        </section>
      </form>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <h3 className="text-3xl font-semibold text-slate-900">Resumen de compra</h3>
        </div>
        <div className="space-y-3 p-6 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-semibold text-slate-900">{centsToCurrency(subtotalCents)}</span>
          </div>
          {fallbackAmounts.appliedItems.map((item) => (
            <div className="flex items-center justify-between" key={item.id}>
              <span className="text-slate-500">{item.name}</span>
              <span className="font-semibold text-slate-900">{centsToCurrency(item.amountCents)}</span>
            </div>
          ))}
          {discountCents > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Descuento cupon</span>
              <span className="font-semibold text-emerald-700">-{centsToCurrency(discountCents)}</span>
            </div>
          )}
          <div className="pt-2">
            <label className="label">Codigo de cupon</label>
            <input
              className="field"
              value={couponCode}
              onChange={(event) => {
                trackCheckoutStarted();
                setCouponCode(event.target.value.toUpperCase());
              }}
              required={selected?.saleMode === "COUPON_ONLY"}
            />
            {quoteError && <p className="mt-1 text-xs text-red-700">{quoteError}</p>}
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="text-xl font-semibold text-slate-900">Total</span>
            <span className="text-3xl font-semibold text-blue-700">{centsToCurrency(totalCents)}</span>
          </div>
          <button onClick={() => void createOrder()} disabled={loading || !selected} className="btn-primary mt-2 w-full !py-3 !text-base">
            {loading ? "Procesando..." : "Emitir y procesar pago"}
          </button>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      </aside>
    </div>
  );
}
