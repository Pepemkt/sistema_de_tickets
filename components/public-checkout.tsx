"use client";

import { FormEvent, useMemo, useState } from "react";
import { centsToCurrency } from "@/lib/utils";
import { CheckoutFeeItem, calculateCheckoutAmounts } from "@/lib/checkout-fees";

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
  eventName: string;
  eventDateText: string;
  ticketTypes: TicketType[];
  feeItems: CheckoutFeeItem[];
};

export function PublicCheckout({ eventId, eventName, eventDateText, ticketTypes, feeItems }: Props) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [ticketTypeId, setTicketTypeId] = useState(ticketTypes[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => ticketTypes.find((item) => item.id === ticketTypeId) ?? null, [ticketTypeId, ticketTypes]);
  const subtotal = (selected?.priceCents ?? 0) * quantity;
  const amounts = calculateCheckoutAmounts(subtotal, feeItems);

  function changeQuantity(delta: number) {
    const next = Math.max(1, quantity + delta);
    if (selected?.maxPerOrder && next > selected.maxPerOrder) return;
    setQuantity(next);
  }

  async function createOrder() {
    setError(null);
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
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Nombre completo</label>
              <input className="field" value={buyerName} onChange={(event) => setBuyerName(event.target.value)} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="field" type="email" value={buyerEmail} onChange={(event) => setBuyerEmail(event.target.value)} required />
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
                  onClick={() => setTicketTypeId(type.id)}
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
            <span className="font-semibold text-slate-900">{centsToCurrency(amounts.subtotalCents)}</span>
          </div>
          {amounts.appliedItems.map((item) => (
            <div className="flex items-center justify-between" key={item.id}>
              <span className="text-slate-500">{item.name}</span>
              <span className="font-semibold text-slate-900">{centsToCurrency(item.amountCents)}</span>
            </div>
          ))}
          <div className="pt-2">
            <label className="label">Codigo de cupon</label>
            <input className="field" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} />
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="text-xl font-semibold text-slate-900">Total</span>
            <span className="text-3xl font-semibold text-blue-700">{centsToCurrency(amounts.totalCents)}</span>
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
