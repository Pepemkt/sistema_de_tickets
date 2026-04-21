"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { centsToCurrency } from "@/lib/utils";

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

export function CheckoutCard({ eventId, eventName, ticketTypes, allowDevSimulation = true }: Props) {
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
  const simulationsEnabled = allowDevSimulation && process.env.NEXT_PUBLIC_ENABLE_DEV_SIMULATIONS === "true";

  const selected = useMemo(() => ticketTypes.find((item) => item.id === ticketTypeId), [ticketTypeId, ticketTypes]);
  const total = (selected?.priceCents ?? 0) * quantity;
  const previewTotal = quote?.totalCents ?? total;
  const previewSubtotal = quote?.subtotalCents ?? total;
  const previewDiscount = quote?.discountCents ?? 0;

  useEffect(() => {
    if (!selected) return;
    if (selected.maxPerOrder && quantity > selected.maxPerOrder) {
      setQuantity(selected.maxPerOrder);
    }
    if (quantity < 1) {
      setQuantity(1);
    }
  }, [selected, quantity]);

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
          subtotalCents: typeof data.subtotalCents === "number" ? data.subtotalCents : total,
          discountCents: typeof data.discountCents === "number" ? data.discountCents : 0,
          totalCents: typeof data.totalCents === "number" ? data.totalCents : total
        });
        setQuoteError(null);
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setQuote(null);
        setQuoteError("No se pudo validar el cupon en este momento");
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [buyerEmail, couponCode, eventId, quantity, selected, ticketTypeId, total]);

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

  return (
    <aside className="panel h-fit overflow-hidden p-0">
      <div className="border-b border-soft bg-sunken px-5 py-4">
        <h2 className="font-display text-title-l font-bold text-primary">Seleccion de entradas</h2>
        <p className="mt-1 text-body-s text-muted">{eventName}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 p-5">
        {ticketTypes.length === 0 && (
          <p className="rounded-md border border-warning-500/40 bg-warning-50 p-3 text-body-s text-warning-700">
            Este evento no tiene entradas habilitadas para compra online.
          </p>
        )}

        <div>
          <label className="label">Nombre completo</label>
          <input value={buyerName} onChange={(event) => setBuyerName(event.target.value)} required className="field" />
        </div>

        <div>
          <label className="label">Email</label>
          <input type="email" value={buyerEmail} onChange={(event) => setBuyerEmail(event.target.value)} required className="field" />
        </div>

        <div>
          <label className="label">Telefono</label>
          <input value={buyerPhone} onChange={(event) => setBuyerPhone(event.target.value)} className="field" placeholder="+54 11 5555 5555" />
        </div>

        <div>
          <label className="label">Tipo de entrada</label>
          <select value={ticketTypeId} onChange={(event) => setTicketTypeId(event.target.value)} className="field">
            {ticketTypes.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name} ({centsToCurrency(item.priceCents)}){item.saleMode === "COUPON_ONLY" ? " - Requiere cupon" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Cantidad</label>
          <input
            type="number"
            min={1}
            max={selected?.maxPerOrder ?? 100}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
            className="field"
          />
          {selected?.maxPerOrder ? <p className="mt-1 text-caption text-muted">Maximo por operacion: {selected.maxPerOrder}</p> : null}
          {selected?.maxPerEmail ? <p className="mt-1 text-caption text-muted">Maximo por email: {selected.maxPerEmail}</p> : null}
        </div>

        <div>
          <label className="label">Cupon (opcional)</label>
          <input
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
            className="field"
            placeholder={selected?.saleMode === "COUPON_ONLY" ? "Obligatorio para este ticket" : "Ej: EXPOSITOR2026"}
            required={selected?.saleMode === "COUPON_ONLY"}
          />
        </div>

        <div className="rounded-md border border-soft bg-sunken px-3 py-3 text-body-s">
          <p className="text-overline uppercase tracking-wide text-muted">Subtotal</p>
          <p className="text-body-l font-semibold text-primary">{centsToCurrency(previewSubtotal)}</p>
          {previewDiscount > 0 && <p className="mt-1 text-body-s font-semibold text-success-700">Descuento: -{centsToCurrency(previewDiscount)}</p>}
          <p className="mt-2 text-overline uppercase tracking-wide text-muted">Total final</p>
          <p className="font-display text-title-l font-bold text-[color:var(--brand-magenta)]">{centsToCurrency(previewTotal)}</p>
        </div>

        <button disabled={loading || !selected} className="btn-primary w-full">
          {loading ? "Conectando con Mercado Pago..." : "Pagar con Mercado Pago"}
        </button>

        {simulationsEnabled && (
          <button type="button" disabled={simLoading || !selected} className="btn-secondary w-full" onClick={onSimulatePurchase}>
            {simLoading ? "Simulando compra..." : "Simular compra aprobada (dev)"}
          </button>
        )}

        {error && <p className="text-body-s text-danger-500">{error}</p>}
        {quoteError && <p className="text-body-s text-danger-500">{quoteError}</p>}
        {success && <p className="text-body-s text-success-700">{success}</p>}
      </form>
    </aside>
  );
}
