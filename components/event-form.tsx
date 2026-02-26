"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TicketTypeInput = {
  id?: string;
  name: string;
  price: number;
  stock: number;
  saleMode: "PUBLIC" | "COUPON_ONLY" | "HIDDEN";
  maxPerOrder: number | null;
  maxPerEmail: number | null;
  soldCount?: number;
};

type EventFormProps = {
  mode: "create" | "edit";
  eventId?: string;
  initial?: {
    name: string;
    description: string;
    venue: string;
    startsAt: string;
    endsAt: string;
    ticketTypes: TicketTypeInput[];
  };
};

function toLocalInputValue(date: string) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return "";
  }

  const pad = (number: number) => String(number).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function EventForm({ mode, eventId, initial }: EventFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [startsAt, setStartsAt] = useState(initial?.startsAt ? toLocalInputValue(initial.startsAt) : "");
  const [endsAt, setEndsAt] = useState(initial?.endsAt ? toLocalInputValue(initial.endsAt) : "");
  const [ticketTypes, setTicketTypes] = useState<TicketTypeInput[]>(
    initial?.ticketTypes ?? [{ name: "General", price: 0, stock: 100, saleMode: "PUBLIC", maxPerOrder: null, maxPerEmail: null }]
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const totalCapacity = useMemo(() => ticketTypes.reduce((sum, current) => sum + (Number(current.stock) || 0), 0), [ticketTypes]);

  function addType() {
    setTicketTypes((current) => [...current, { name: "", price: 0, stock: 0, saleMode: "PUBLIC", maxPerOrder: null, maxPerEmail: null }]);
  }

  function removeType(index: number) {
    setTicketTypes((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function updateType(index: number, key: keyof TicketTypeInput, value: string | number | null) {
    setTicketTypes((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        return {
          ...item,
          [key]: value
        };
      })
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const payload = {
      name,
      description,
      venue,
      startsAt,
      endsAt: endsAt || undefined,
      ticketTypes: ticketTypes.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        name: item.name,
        price: Number(item.price),
        stock: Number(item.stock),
        saleMode: item.saleMode,
        maxPerOrder: item.maxPerOrder,
        maxPerEmail: item.maxPerEmail
      }))
    };

    const url = mode === "create" ? "/api/events" : `/api/events/${eventId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error ?? "No se pudo guardar evento");
      return;
    }

    setMessage(mode === "create" ? "Evento creado correctamente" : "Evento actualizado correctamente");

    if (mode === "create") {
      router.push(`/admin/events/${data.event.id}/edit`);
      router.refresh();
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">Nombre del evento</label>
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>

        <div className="md:col-span-2">
          <label className="label">Descripcion</label>
          <textarea
            className="field min-h-24"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe agenda, line-up o detalles clave"
          />
        </div>

        <div>
          <label className="label">Lugar</label>
          <input className="field" value={venue} onChange={(event) => setVenue(event.target.value)} required />
        </div>

        <div>
          <label className="label">Fecha y hora de inicio</label>
          <input className="field" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
        </div>

        <div>
          <label className="label">Fecha y hora de cierre (opcional)</label>
          <input className="field" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-700">Capacidad total</p>
          <p className="text-2xl font-semibold text-blue-700">{totalCapacity}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Tipos de entrada</h3>
          <button type="button" onClick={addType} className="btn-secondary">
            Agregar tipo
          </button>
        </div>

        <div className="space-y-3">
          {ticketTypes.map((type, index) => (
            <div key={`${type.id ?? "new"}-${index}`} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-12">
              <div className="md:col-span-5">
                <label className="label">Nombre</label>
                <input
                  className="field"
                  value={type.name}
                  onChange={(event) => updateType(index, "name", event.target.value)}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Precio ARS</label>
                <input
                  className="field"
                  type="number"
                  min={0}
                  value={type.price}
                  onChange={(event) => updateType(index, "price", Number(event.target.value))}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Stock</label>
                <input
                  className="field"
                  type="number"
                  min={1}
                  value={type.stock}
                  onChange={(event) => updateType(index, "stock", Number(event.target.value))}
                  required
                />
              </div>

              <div className="md:col-span-3">
                <label className="label">Modo de venta</label>
                <select
                  className="field"
                  value={type.saleMode}
                  onChange={(event) => updateType(index, "saleMode", event.target.value as "PUBLIC" | "COUPON_ONLY" | "HIDDEN")}
                >
                  <option value="PUBLIC">Publico</option>
                  <option value="COUPON_ONLY">Solo con cupon</option>
                  <option value="HIDDEN">Oculto (solo emision manual)</option>
                </select>
              </div>

              <div className="md:col-span-6">
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <label className="label">Max por operacion</label>
                    <input
                      className="field"
                      type="number"
                      min={1}
                      placeholder="Sin limite"
                      value={type.maxPerOrder ?? ""}
                      onChange={(event) => updateType(index, "maxPerOrder", event.target.value ? Number(event.target.value) : null)}
                    />
                  </div>
                  <div>
                    <label className="label">Max por email</label>
                    <input
                      className="field"
                      type="number"
                      min={1}
                      placeholder="Sin limite"
                      value={type.maxPerEmail ?? ""}
                      onChange={(event) => updateType(index, "maxPerEmail", event.target.value ? Number(event.target.value) : null)}
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-3 md:pt-6">
                <button
                  type="button"
                  onClick={() => removeType(index)}
                  className="btn-secondary w-full"
                  disabled={ticketTypes.length <= 1}
                >
                  Quitar
                </button>
                {type.soldCount ? <p className="mt-1 text-xs text-slate-500">Vendidas: {type.soldCount}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={loading}>
          {loading ? "Guardando..." : mode === "create" ? "Crear evento" : "Guardar cambios"}
        </button>

        {message && <p className="text-sm text-slate-600">{message}</p>}
      </div>
    </form>
  );
}
