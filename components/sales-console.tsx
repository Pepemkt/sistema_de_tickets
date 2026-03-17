"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
  discountType: "FIXED_PRICE" | "FIXED_DISCOUNT" | "PERCENT" | null;
  discountValue: number | null;
  createdAt: string;
  event: { name: string };
  ticketType: { name: string } | null;
};

type InvitationTicketItem = {
  id: string;
  code: string;
  attendeeName: string;
  attendeeEmail: string;
  downloadUrl: string;
  emailStatus: "SENT" | "FAILED" | null;
  emailError: string | null;
  emailedAt: string | null;
};

type InvitationOrderItem = {
  orderId: string;
  issuedBy: string;
  createdAt: string;
  quantity: number;
  eventName: string;
  ticketTypeName: string;
  tickets: InvitationTicketItem[];
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
  const [savingInvitation, setSavingInvitation] = useState(false);
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationOrderItem[]>([]);

  const [eventId, setEventId] = useState("");
  const [ticketTypeId, setTicketTypeId] = useState("");
  const [attendeesText, setAttendeesText] = useState("");

  const [inviteEventId, setInviteEventId] = useState("");
  const [inviteTicketTypeId, setInviteTicketTypeId] = useState("");
  const [inviteesText, setInviteesText] = useState("");
  const [latestInvitationOrderId, setLatestInvitationOrderId] = useState<string | null>(null);

  const [couponCode, setCouponCode] = useState("");
  const [couponEventId, setCouponEventId] = useState("");
  const [couponTicketTypeId, setCouponTicketTypeId] = useState("");
  const [couponMaxUses, setCouponMaxUses] = useState(50);
  const [couponExpiresAt, setCouponExpiresAt] = useState("");
  const [couponDiscountType, setCouponDiscountType] = useState<"FIXED_PRICE" | "FIXED_DISCOUNT" | "PERCENT">("PERCENT");
  const [couponDiscountValue, setCouponDiscountValue] = useState(10);

  const selectedEvent = useMemo(() => events.find((item) => item.id === eventId) ?? null, [events, eventId]);
  const selectedInviteEvent = useMemo(() => events.find((item) => item.id === inviteEventId) ?? null, [events, inviteEventId]);
  const selectedCouponEvent = useMemo(() => events.find((item) => item.id === couponEventId) ?? null, [events, couponEventId]);
  const selectedTicketType = useMemo(
    () => selectedEvent?.ticketTypes.find((item) => item.id === ticketTypeId) ?? null,
    [selectedEvent, ticketTypeId]
  );
  const selectedInviteTicketType = useMemo(
    () => selectedInviteEvent?.ticketTypes.find((item) => item.id === inviteTicketTypeId) ?? null,
    [selectedInviteEvent, inviteTicketTypeId]
  );
  const attendeesPreview = useMemo(() => parseAttendees(attendeesText), [attendeesText]);
  const inviteesPreview = useMemo(() => parseAttendees(inviteesText), [inviteesText]);
  const previewTotalCents = (selectedTicketType?.priceCents ?? 0) * attendeesPreview.length;
  const invitationReferenceTotalCents = (selectedInviteTicketType?.priceCents ?? 0) * inviteesPreview.length;

  async function readJsonSafe(response: Response) {
    const raw = await response.text();
    if (!raw) return {};

    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { error: raw };
    }
  }

  const loadData = useCallback(async () => {
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
      const invitationsData = Array.isArray(data.invitations) ? (data.invitations as InvitationOrderItem[]) : [];

      setEvents(eventsData);
      setCoupons(couponsData);
      setInvitations(invitationsData);

      const firstEventId = eventsData[0]?.id ?? "";
      setEventId((current) => current || firstEventId);
      setInviteEventId((current) => current || firstEventId);
      setCouponEventId((current) => current || firstEventId);

      const firstTicketTypeId = eventsData[0]?.ticketTypes?.[0]?.id ?? "";
      setTicketTypeId((current) => current || firstTicketTypeId);
      setInviteTicketTypeId((current) => current || firstTicketTypeId);
    } catch {
      setLoading(false);
      setMessage("No se pudo conectar con la consola de ventas");
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  useEffect(() => {
    if (!selectedInviteEvent) {
      setInviteTicketTypeId("");
      return;
    }

    if (!selectedInviteEvent.ticketTypes.some((item) => item.id === inviteTicketTypeId)) {
      setInviteTicketTypeId(selectedInviteEvent.ticketTypes[0]?.id ?? "");
    }
  }, [selectedInviteEvent, inviteTicketTypeId]);

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

    if (couponDiscountType === "PERCENT" && (couponDiscountValue < 1 || couponDiscountValue > 100)) {
      setSavingCoupon(false);
      setMessage("El porcentaje debe estar entre 1 y 100");
      return;
    }

    if (couponDiscountType === "FIXED_DISCOUNT" && couponDiscountValue < 1) {
      setSavingCoupon(false);
      setMessage("El descuento fijo debe ser mayor a 0");
      return;
    }

    if (couponDiscountType === "FIXED_PRICE" && couponDiscountValue < 0) {
      setSavingCoupon(false);
      setMessage("El precio fijo no puede ser negativo");
      return;
    }

    const normalizedDiscountValue =
      couponDiscountType === "PERCENT" ? Math.round(couponDiscountValue) : Math.round(couponDiscountValue * 100);

    const res = await fetch("/api/sales/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: couponCode,
        eventId: couponEventId,
        ticketTypeId: couponTicketTypeId || null,
        maxUses: couponMaxUses,
        expiresAt: expiresAtDate ? expiresAtDate.toISOString() : null,
        discountType: couponDiscountType,
        discountValue: normalizedDiscountValue
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
    setCouponDiscountType("PERCENT");
    setCouponDiscountValue(10);
    const createdCouponCode =
      data.coupon && typeof data.coupon === "object" && "code" in data.coupon && typeof data.coupon.code === "string"
        ? data.coupon.code
        : couponCode;
    setMessage(`Cupon ${createdCouponCode} creado`);
    void loadData();
  }

  async function onCreateInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!inviteEventId || !inviteTicketTypeId) {
      setMessage("Selecciona evento y tipo de ticket para la invitacion");
      return;
    }

    const attendees = parseAttendees(inviteesText);
    if (attendees.length === 0) {
      setMessage("Debes cargar invitados como 'Nombre,Email' (una linea por ticket)");
      return;
    }

    setSavingInvitation(true);
    setMessage(null);

    const res = await fetch("/api/sales/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: inviteEventId,
        ticketTypeId: inviteTicketTypeId,
        attendees
      })
    });

    const data = await readJsonSafe(res);
    setSavingInvitation(false);

    if (!res.ok) {
      const errorText = typeof data.error === "string" ? data.error : "No se pudieron emitir invitaciones";
      setMessage(errorText);
      return;
    }

    const payload = data as {
      orderId?: unknown;
      created?: unknown;
      eventName?: unknown;
      emailsSent?: unknown;
      emailsFailed?: unknown;
    };
    const createdCount = typeof payload.created === "number" ? payload.created : attendees.length;
    const eventName = typeof payload.eventName === "string" ? payload.eventName : "evento";
    const orderId = typeof payload.orderId === "string" ? payload.orderId : null;
    const emailsSent = typeof payload.emailsSent === "number" ? payload.emailsSent : 0;
    const emailsFailed = typeof payload.emailsFailed === "number" ? payload.emailsFailed : 0;

    setInviteesText("");
    setLatestInvitationOrderId(orderId);
    setMessage(`Invitaciones OK: ${createdCount} tickets para ${eventName}. Emails enviados: ${emailsSent}. Fallidos: ${emailsFailed}.`);
    await loadData();
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
        <h2 className="section-title">Terminal de ventas manuales</h2>
        <p className="muted mt-1">Emite tickets pagos de forma manual con una experiencia de caja mas clara para el equipo.</p>

        {loading ? (
          <p className="mt-5 text-sm text-slate-500">Cargando datos...</p>
        ) : (
          <form onSubmit={onManualIssue} className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-900">Informacion del cliente</h3>
                <p className="mt-1 text-xs text-slate-500">Carga asistentes en formato Nombre,Email (uno por linea).</p>
                <textarea
                  className="field mt-3 min-h-44 font-mono text-xs"
                  value={attendeesText}
                  onChange={(event) => setAttendeesText(event.target.value)}
                  placeholder={"Ana Perez,ana@email.com\nJuan Gomez,juan@email.com"}
                  required
                />
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-900">Seleccionar entradas</h3>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
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
              </section>
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-base font-semibold text-slate-900">Resumen de orden</h3>
              <p className="mt-1 text-xs text-slate-500">{selectedEvent?.name ?? "Sin evento seleccionado"}</p>

              <div className="mt-4 space-y-2 border-b border-slate-200 pb-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Ticket</span>
                  <span className="font-medium text-slate-900">{selectedTicketType?.name ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Cantidad</span>
                  <span className="font-medium text-slate-900">{attendeesPreview.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Precio unitario</span>
                  <span className="font-medium text-slate-900">
                    {selectedTicketType ? centsToCurrency(selectedTicketType.priceCents) : "-"}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-slate-600">Total</p>
                <p className="text-2xl font-semibold text-blue-700">{centsToCurrency(previewTotalCents)}</p>
              </div>

              <button className="btn-primary mt-4 w-full" disabled={savingIssue || !eventId || !ticketTypeId}>
                {savingIssue ? "Emitiendo..." : "Emitir y procesar venta"}
              </button>
              <p className="mt-2 text-xs text-slate-500">Se crea una orden pagada manual y se emiten tickets para cada asistente.</p>
            </aside>
          </form>
        )}
      </section>

      <section className="panel p-6">
        <h2 className="section-title">Invitaciones</h2>
        <p className="muted mt-1">Emite tickets de invitacion con importe 0, envio por email y descarga operativa para el equipo.</p>

        {loading ? (
          <p className="mt-5 text-sm text-slate-500">Cargando datos...</p>
        ) : (
          <>
            <form onSubmit={onCreateInvitation} className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-base font-semibold text-slate-900">Invitados</h3>
                  <p className="mt-1 text-xs text-slate-500">Carga invitados en formato Nombre,Email (uno por linea).</p>
                  <textarea
                    className="field mt-3 min-h-44 font-mono text-xs"
                    value={inviteesText}
                    onChange={(event) => setInviteesText(event.target.value)}
                    placeholder={"Ana Perez,ana@email.com\nJuan Gomez,juan@email.com"}
                    required
                  />
                </section>

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-base font-semibold text-slate-900">Evento y ticket</h3>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="label">Evento</label>
                      <select className="field" value={inviteEventId} onChange={(event) => setInviteEventId(event.target.value)} required>
                        {events.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({new Date(item.startsAt).toLocaleDateString("es-AR")})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label">Tipo de ticket</label>
                      <select className="field" value={inviteTicketTypeId} onChange={(event) => setInviteTicketTypeId(event.target.value)} required>
                        {(selectedInviteEvent?.ticketTypes ?? []).map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} - {centsToCurrency(item.priceCents)} [{item.saleMode}]
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>
              </div>

              <aside className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-base font-semibold text-slate-900">Resumen de invitacion</h3>
                <p className="mt-1 text-xs text-slate-500">{selectedInviteEvent?.name ?? "Sin evento seleccionado"}</p>

                <div className="mt-4 space-y-2 border-b border-slate-200 pb-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Ticket</span>
                    <span className="font-medium text-slate-900">{selectedInviteTicketType?.name ?? "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Cantidad</span>
                    <span className="font-medium text-slate-900">{inviteesPreview.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Valor de referencia</span>
                    <span className="font-medium text-slate-900">
                      {selectedInviteTicketType ? centsToCurrency(selectedInviteTicketType.priceCents) : "-"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm text-slate-600">Total a cobrar</p>
                  <p className="text-2xl font-semibold text-fuchsia-700">{centsToCurrency(0)}</p>
                </div>
                <p className="mt-2 text-xs text-slate-500">Valor comercial de referencia: {centsToCurrency(invitationReferenceTotalCents)}</p>

                <button className="btn-primary mt-4 w-full" disabled={savingInvitation || !inviteEventId || !inviteTicketTypeId}>
                  {savingInvitation ? "Emitiendo invitaciones..." : "Emitir invitaciones"}
                </button>
                <p className="mt-2 text-xs text-slate-500">Se crea una orden tipo invitacion, con tickets validos para check-in y monto final cero.</p>
              </aside>
            </form>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Invitaciones recientes</h3>
                  <p className="mt-1 text-xs text-slate-500">Revisa descargas y estado del email sin salir de la consola.</p>
                </div>
                <p className="text-xs text-slate-500">{invitations.length} ordenes cargadas</p>
              </div>

              <div className="mt-4 space-y-4">
                {invitations.length === 0 ? (
                  <p className="text-sm text-slate-500">Todavia no hay invitaciones emitidas.</p>
                ) : (
                  invitations.map((invitation) => (
                    <article
                      key={invitation.orderId}
                      className={`rounded-2xl border p-4 ${
                        invitation.orderId === latestInvitationOrderId ? "border-fuchsia-300 bg-fuchsia-50/40" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">{invitation.eventName}</h4>
                          <p className="text-xs text-slate-500">
                            {invitation.ticketTypeName} · {invitation.quantity} tickets · {new Date(invitation.createdAt).toLocaleString("es-AR")}
                          </p>
                          <p className="text-xs text-slate-500">Orden {invitation.orderId} · {invitation.issuedBy}</p>
                        </div>
                        <span className="badge border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700">Invitacion</span>
                      </div>

                      <div className="mt-4 grid gap-3">
                        {invitation.tickets.map((ticket) => (
                          <div key={ticket.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{ticket.attendeeName}</p>
                                <p className="text-xs text-slate-500">{ticket.attendeeEmail}</p>
                                <p className="text-xs text-slate-500">Codigo {ticket.code}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {ticket.emailStatus ? (
                                  <span className={`badge ${ticket.emailStatus === "SENT" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                                    {ticket.emailStatus === "SENT" ? "Email enviado" : "Email fallido"}
                                  </span>
                                ) : (
                                  <span className="badge">Sin registro email</span>
                                )}
                                <a className="btn-secondary" href={ticket.downloadUrl} target="_blank" rel="noreferrer">
                                  Descargar PDF
                                </a>
                              </div>
                            </div>
                            {ticket.emailedAt ? (
                              <p className="mt-2 text-xs text-slate-500">Ultimo intento: {new Date(ticket.emailedAt).toLocaleString("es-AR")}</p>
                            ) : null}
                            {ticket.emailError ? <p className="mt-2 text-xs text-rose-700">Error: {ticket.emailError}</p> : null}
                          </div>
                        ))}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </>
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
                <label className="label">Tipo de descuento</label>
                <select
                  className="field"
                  value={couponDiscountType}
                  onChange={(event) => setCouponDiscountType(event.target.value as "FIXED_PRICE" | "FIXED_DISCOUNT" | "PERCENT")}
                >
                  <option value="FIXED_PRICE">Precio fijo final</option>
                  <option value="FIXED_DISCOUNT">Descuento fijo</option>
                  <option value="PERCENT">Descuento porcentaje</option>
                </select>
              </div>

              <div>
                <label className="label">
                  {couponDiscountType === "PERCENT"
                    ? "Porcentaje (%)"
                    : couponDiscountType === "FIXED_DISCOUNT"
                      ? "Descuento fijo (ARS)"
                      : "Precio fijo (ARS)"}
                </label>
                <input
                  className="field"
                  type="number"
                  min={couponDiscountType === "PERCENT" ? 1 : 0}
                  max={couponDiscountType === "PERCENT" ? 100 : undefined}
                  step={couponDiscountType === "PERCENT" ? 1 : 0.01}
                  value={couponDiscountValue}
                  onChange={(event) => setCouponDiscountValue(Number(event.target.value))}
                  required
                />
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
                    <th className="pb-2 pr-3">Descuento</th>
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
                        <td className="py-3 pr-3 text-slate-700">
                          {coupon.discountType === "PERCENT"
                            ? `${coupon.discountValue ?? 0}%`
                            : coupon.discountType === "FIXED_DISCOUNT"
                              ? `-${centsToCurrency(coupon.discountValue ?? 0)}`
                              : coupon.discountType === "FIXED_PRICE"
                                ? centsToCurrency(coupon.discountValue ?? 0)
                                : "Sin descuento"}
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
