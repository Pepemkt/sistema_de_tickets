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
  const [ticketTypeId, setTicketTypeId] = useState(ticketTypes[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const simulationsEnabled = allowDevSimulation && process.env.NEXT_PUBLIC_ENABLE_DEV_SIMULATIONS === "true";

  const selected = useMemo(() => ticketTypes.find((item) => item.id === ticketTypeId), [ticketTypeId, ticketTypes]);
  const total = (selected?.priceCents ?? 0) * quantity;

  useEffect(() => {
    if (!selected) return;
    if (selected.maxPerOrder && quantity > selected.maxPerOrder) {
      setQuantity(selected.maxPerOrder);
    }
    if (quantity < 1) {
      setQuantity(1);
    }
  }, [selected, quantity]);

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
    <aside className="panel h-fit p-6">
      <h2 className="text-xl font-semibold text-slate-900">Comprar entrada</h2>
      <p className="muted mt-1">{eventName}</p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        {ticketTypes.length === 0 && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
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
          {selected?.maxPerOrder ? <p className="mt-1 text-xs text-slate-500">Maximo por operacion: {selected.maxPerOrder}</p> : null}
          {selected?.maxPerEmail ? <p className="mt-1 text-xs text-slate-500">Maximo por email: {selected.maxPerEmail}</p> : null}
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

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
          Total: <span className="font-semibold text-blue-700">{centsToCurrency(total)}</span>
        </div>

        <button disabled={loading || !selected} className="btn-primary w-full">
          {loading ? "Conectando con Mercado Pago..." : "Pagar con Mercado Pago"}
        </button>

        {simulationsEnabled && (
          <button type="button" disabled={simLoading || !selected} className="btn-secondary w-full" onClick={onSimulatePurchase}>
            {simLoading ? "Simulando compra..." : "Simular compra aprobada (dev)"}
          </button>
        )}

        {error && <p className="text-sm text-red-700">{error}</p>}
        {success && <p className="text-sm text-emerald-700">{success}</p>}
      </form>
    </aside>
  );
}
