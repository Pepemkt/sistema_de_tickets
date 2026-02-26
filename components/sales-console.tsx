"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { centsToCurrency } from "@/lib/utils";

type TicketTypeItem = {
  id: string;
  name: string;
  priceCents: number;
  stock: number;
  saleMode: "PUBLIC" | "COUPON_ONLY" | "HIDDEN";
  maxPerOrder: number | null;
  maxPerEmail: number | null;
};

type EventItem = {
  id: string;
  name: string;
  startsAt: string;
  venue: string | null;
  ticketTypes: TicketTypeItem[];
};

type CouponItem = {
  id: string;
  code: string;
  eventId: string;
  ticketTypeId: string | null;
  maxUses: number;
  usedCount: number;
  reservedUses?: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  event: { name: string };
  ticketType: { name: string } | null;
};

function parseAttendees(raw: string) {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const attendees: Array<{ name: string; email: string }> = [];

  for (const line of lines) {
    const chunks = line.split(",").map((part) => part.trim()).filter(Boolean);
    if (chunks.length < 2) continue;
    attendees.push({
      name: chunks[0],
      email: chunks[1]
    });
  }

  return attendees;
}

function toLocalDateTimeInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SalesConsole() {
  const [loading, setLoading] = useState(true);
  const [savingIssue, setSavingIssue] = useState(false);
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [coupons, setCoupons] = useState<CouponItem[]>([]);

  const [eventId, setEventId] = useState("");
  const [ticketTypeId, setTicketTypeId] = useState("");
  const [attendeesText, setAttendeesText] = useState("");

  const [couponCode, setCouponCode] = useState("");
  const [couponEventId, setCouponEventId] = useState("");
  const [couponTicketTypeId, setCouponTicketTypeId] = useState("");
  const [couponMaxUses, setCouponMaxUses] = useState(50);
  const [couponExpiresAt, setCouponExpiresAt] = useState("");

  const selectedEvent = useMemo(() => events.find((item) => item.id === eventId) ?? null, [events, eventId]);
  const selectedCouponEvent = useMemo(() => events.find((item) => item.id === couponEventId) ?? null, [events, couponEventId]);

  async function readJsonSafe(response: Response) {
    const raw = await response.text();
    if (!raw) return {};

    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { error: raw };
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetch("/api/sales/bootstrap");
      const data = await readJsonSafe(res);
      setLoading(false);

      if (!res.ok) {
        const errorText = typeof data.error === "string" ? data.error : "No se pudo cargar consola de ventas";
        setMessage(errorText);
        return;
      }

      const eventsData = Array.isArray(data.events) ? (data.events as EventItem[]) : [];
      const couponsData = Array.isArray(data.coupons) ? (data.coupons as CouponItem[]) : [];

      setEvents(eventsData);
      setCoupons(couponsData);

      const firstEventId = eventsData[0]?.id ?? "";
      setEventId((current) => current || firstEventId);
      setCouponEventId((current) => current || firstEventId);

      const firstTicketTypeId = eventsData[0]?.ticketTypes?.[0]?.id ?? "";
      setTicketTypeId((current) => current || firstTicketTypeId);
    } catch {
      setLoading(false);
      setMessage("No se pudo conectar con la consola de ventas");
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!selectedEvent) {
      setTicketTypeId("");
      return;
    }

    if (!selectedEvent.ticketTypes.some((item) => item.id === ticketTypeId)) {
      setTicketTypeId(selectedEvent.ticketTypes[0]?.id ?? "");
    }
  }, [selectedEvent, ticketTypeId]);

  useEffect(() => {
    if (!selectedCouponEvent) {
      setCouponTicketTypeId("");
      return;
    }

    if (couponTicketTypeId && !selectedCouponEvent.ticketTypes.some((item) => item.id === couponTicketTypeId)) {
      setCouponTicketTypeId("");
    }
  }, [selectedCouponEvent, couponTicketTypeId]);

  async function onManualIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!eventId || !ticketTypeId) {
      setMessage("Selecciona evento y tipo de ticket");
      return;
    }

    const attendees = parseAttendees(attendeesText);
    if (attendees.length === 0) {
      setMessage("Debes cargar asistentes como 'Nombre,Email' (una linea por ticket)");
      return;
    }

    setSavingIssue(true);
    setMessage(null);

    const res = await fetch("/api/sales/manual-issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        ticketTypeId,
        attendees
      })
    });

    const data = await readJsonSafe(res);
    setSavingIssue(false);

    if (!res.ok) {
      const errorText = typeof data.error === "string" ? data.error : "No se pudo emitir entradas manualmente";
      setMessage(errorText);
      return;
    }

    const payload = data as {
      created?: unknown;
      eventName?: unknown;
      orderId?: unknown;
    };
    const createdCount = typeof payload.created === "number" ? payload.created : attendees.length;
    const issuedEventName = typeof payload.eventName === "string" ? payload.eventName : "evento";
    const issuedOrderId = typeof payload.orderId === "string" ? payload.orderId : "-";

    setAttendeesText("");
    setMessage(`Emision OK: ${createdCount} tickets creados para ${issuedEventName}. Orden: ${issuedOrderId}`);
    void loadData();
  }

  async function onCreateCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!couponEventId) {
      setMessage("Selecciona un evento para el cupon");
      return;
    }
    setSavingCoupon(true);
    setMessage(null);
    const expiresAtDate = couponExpiresAt ? new Date(couponExpiresAt) : null;
    if (expiresAtDate && Number.isNaN(expiresAtDate.getTime())) {
      setSavingCoupon(false);
      setMessage("Fecha de vencimiento invalida");
      return;
    }

    const res = await fetch("/api/sales/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: couponCode,
        eventId: couponEventId,
        ticketTypeId: couponTicketTypeId || null,
        maxUses: couponMaxUses,
        expiresAt: expiresAtDate ? expiresAtDate.toISOString() : null
      })
    });

    const data = await readJsonSafe(res);
    setSavingCoupon(false);

    if (!res.ok) {
      const errorText = typeof data.error === "string" ? data.error : "No se pudo crear cupon";
      setMessage(errorText);
      return;
    }

    setCouponCode("");
    setCouponMaxUses(50);
    setCouponExpiresAt("");
    setCouponTicketTypeId("");
    const createdCouponCode =
      data.coupon && typeof data.coupon === "object" && "code" in data.coupon && typeof data.coupon.code === "string"
        ? data.coupon.code
        : couponCode;
    setMessage(`Cupon ${createdCouponCode} creado`);
    void loadData();
  }

  async function onToggleCoupon(coupon: CouponItem) {
    const res = await fetch(`/api/sales/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !coupon.isActive })
    });

    const data = await readJsonSafe(res);
    if (!res.ok) {
      const errorText = typeof data.error === "string" ? data.error : "No se pudo actualizar cupon";
      setMessage(errorText);
      return;
    }

    const updatedCouponCode =
      data.coupon && typeof data.coupon === "object" && "code" in data.coupon && typeof data.coupon.code === "string"
        ? data.coupon.code
        : coupon.code;
    setMessage(`Cupon ${updatedCouponCode} actualizado`);
    void loadData();
  }

  async function onUpdateMaxUses(coupon: CouponItem) {
    const value = prompt(`Nuevo limite de uso para ${coupon.code}`, String(coupon.maxUses));
    if (!value) return;
    const maxUses = Number(value);
    if (!Number.isInteger(maxUses) || maxUses <= 0) {
      setMessage("El limite debe ser entero positivo");
      return;
    }

    const res = await fetch(`/api/sales/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxUses })
    });

    const data = await readJsonSafe(res);
    if (!res.ok) {
      const errorText = typeof data.error === "string" ? data.error : "No se pudo actualizar maxUses";
      setMessage(errorText);
      return;
    }

    const updatedCouponCode =
      data.coupon && typeof data.coupon === "object" && "code" in data.coupon && typeof data.coupon.code === "string"
        ? data.coupon.code
        : coupon.code;
    setMessage(`Limite de ${updatedCouponCode} actualizado`);
    void loadData();
  }

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <h2 className="section-title">Emision masiva manual</h2>
        <p className="muted mt-1">Crea entradas especiales (expositor, invitado, staff) sin pasar por checkout publico.</p>

        {loading ? (
          <p className="mt-5 text-sm text-slate-500">Cargando datos...</p>
        ) : (
          <form onSubmit={onManualIssue} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Evento</label>
                <select className="field" value={eventId} onChange={(event) => setEventId(event.target.value)} required>
                  {events.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({new Date(item.startsAt).toLocaleDateString("es-AR")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Tipo de ticket</label>
                <select className="field" value={ticketTypeId} onChange={(event) => setTicketTypeId(event.target.value)} required>
                  {(selectedEvent?.ticketTypes ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} - {centsToCurrency(item.priceCents)} [{item.saleMode}]
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Asistentes (Nombre,Email por linea)</label>
              <textarea
                className="field min-h-44 font-mono text-xs"
                value={attendeesText}
                onChange={(event) => setAttendeesText(event.target.value)}
                placeholder={"Ana Perez,ana@email.com\nJuan Gomez,juan@email.com"}
                required
              />
              <p className="mt-2 text-xs text-slate-500">Cada linea genera un ticket. Se emite una orden pagada manual.</p>
            </div>

            <button className="btn-primary" disabled={savingIssue || !eventId || !ticketTypeId}>
              {savingIssue ? "Emitiendo..." : "Emitir entradas masivas"}
            </button>
          </form>
        )}
      </section>

      <section className="panel p-6">
        <h2 className="section-title">Cupones con limite de uso</h2>
        <p className="muted mt-1">Crea cupones para habilitar tickets `COUPON_ONLY` o campañas cerradas.</p>

        {loading ? (
          <p className="mt-5 text-sm text-slate-500">Cargando datos...</p>
        ) : (
          <>
            <form onSubmit={onCreateCoupon} className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Codigo</label>
                <input className="field" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} required />
              </div>

              <div>
                <label className="label">Evento</label>
                <select className="field" value={couponEventId} onChange={(event) => setCouponEventId(event.target.value)} required>
                  {events.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Tipo de ticket (opcional)</label>
                <select className="field" value={couponTicketTypeId} onChange={(event) => setCouponTicketTypeId(event.target.value)}>
                  <option value="">Todos los tipos del evento</option>
                  {(selectedCouponEvent?.ticketTypes ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Limite de usos</label>
                <input className="field" type="number" min={1} value={couponMaxUses} onChange={(event) => setCouponMaxUses(Number(event.target.value))} required />
              </div>

              <div>
                <label className="label">Vencimiento (opcional)</label>
                <input
                  className="field"
                  type="datetime-local"
                  value={couponExpiresAt}
                  onChange={(event) => setCouponExpiresAt(event.target.value)}
                  min={toLocalDateTimeInput(new Date())}
                />
              </div>

              <div className="md:col-span-2">
                <button className="btn-primary" disabled={savingCoupon || !couponEventId}>
                  {savingCoupon ? "Creando..." : "Crear cupon"}
                </button>
              </div>
            </form>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-2 pr-3">Codigo</th>
                    <th className="pb-2 pr-3">Evento / Ticket</th>
                    <th className="pb-2 pr-3">Uso</th>
                    <th className="pb-2 pr-3">Vence</th>
                    <th className="pb-2 pr-3">Estado</th>
                    <th className="pb-2 pr-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((coupon) => {
                    const used = coupon.reservedUses ?? coupon.usedCount;
                    return (
                      <tr key={coupon.id} className="border-b border-slate-100">
                        <td className="py-3 pr-3 font-semibold text-slate-800">{coupon.code}</td>
                        <td className="py-3 pr-3">
                          <p className="text-slate-700">{coupon.event.name}</p>
                          <p className="text-xs text-slate-500">{coupon.ticketType?.name ?? "Todos los tickets"}</p>
                        </td>
                        <td className="py-3 pr-3 text-slate-700">
                          {used}/{coupon.maxUses}
                        </td>
                        <td className="py-3 pr-3 text-slate-700">{coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleString("es-AR") : "Sin vencimiento"}</td>
                        <td className="py-3 pr-3">
                          <span className={`badge ${coupon.isActive ? "border-blue-200 bg-blue-50 text-blue-700" : ""}`}>{coupon.isActive ? "Activo" : "Inactivo"}</span>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" className="btn-secondary" onClick={() => void onToggleCoupon(coupon)}>
                              {coupon.isActive ? "Desactivar" : "Activar"}
                            </button>
                            <button type="button" className="btn-secondary" onClick={() => void onUpdateMaxUses(coupon)}>
                              Ajustar limite
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {message && <p className="text-sm text-slate-600">{message}</p>}
    </div>
  );
}
