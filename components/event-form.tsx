"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@prisma/client";
import { commissionBpsToPercent, DEFAULT_PLATFORM_COMMISSION_RATE_BPS } from "@/lib/platform-commission";

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES — unchanged
───────────────────────────────────────────────────────────────────────────── */
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
  viewerRole: UserRole;
  initial?: {
    name: string;
    featuredTag?: string;
    description: string;
    featureTags?: string[];
    heroImageUrl?: string;
    venue: string;
    status?: "ACTIVE" | "UPCOMING" | "DRAFT";
    platformCommissionRateBps?: number;
    startsAt: string;
    endsAt: string;
    ticketTypes: TicketTypeInput[];
  };
};

/* ─────────────────────────────────────────────────────────────────────────────
   DATE HELPER — unchanged
───────────────────────────────────────────────────────────────────────────── */
function toLocalInputValue(date: string) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return "";
  }

  const pad = (number: number) => String(number).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

// Anchors a `datetime-local` value (no timezone) to the browser's local zone
// and returns a full ISO string. Without this, the server parses naked
// "YYYY-MM-DDTHH:mm" as UTC and the hour drifts by the server's offset.
function localInputToISO(value: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

/* ─────────────────────────────────────────────────────────────────────────────
   CSS — scoped to ef- prefix
───────────────────────────────────────────────────────────────────────────── */
const FORM_STYLES = `
/* Input / select focus */
.ef-input:focus,
.ef-select:focus {
  outline: none;
  border-color: var(--clr-forest-500);
  box-shadow: 0 0 0 3px rgba(91,33,182,0.10);
}
.ef-input:disabled,
.ef-select:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* Section divider line */
.ef-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 0 14px;
  border-top: 1px solid var(--clr-arena-200);
}
.ef-divider:first-of-type {
  border-top: none;
  padding-top: 14px;
}
.ef-divider-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--clr-arena-400);
  white-space: nowrap;
  font-family: var(--font-display);
}
.ef-divider-line {
  flex: 1;
  height: 1px;
  background: var(--clr-arena-200);
}

/* Ticket table header / row */
.ef-ticket-table-head {
  display: grid;
  grid-template-columns: 1fr 110px 110px 130px 90px 90px 32px;
  gap: 10px;
  align-items: center;
  padding: 8px 14px;
  background: var(--clr-arena-100);
  border-bottom: 1px solid var(--clr-arena-200);
  border-radius: 8px 8px 0 0;
}
.ef-ticket-table-row {
  display: grid;
  grid-template-columns: 1fr 110px 110px 130px 90px 90px 32px;
  gap: 10px;
  align-items: center;
  padding: 10px 14px;
  border-top: 1px solid var(--clr-arena-200);
}
.ef-ticket-table-row:first-of-type {
  border-top: none;
}
.ef-col-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: var(--clr-arena-400);
}

/* Sticky footer bar */
.ef-sticky-footer {
  position: sticky;
  bottom: 0;
  z-index: 20;
  background: var(--clr-white);
  border-top: 1px solid var(--clr-arena-200);
  box-shadow: 0 -4px 20px rgba(21,22,43,0.06);
}

/* Ghost add button */
.ef-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--clr-forest-600);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 6px 2px;
  transition: color 0.12s;
}
.ef-add-btn:hover { color: var(--clr-forest-500); }
.ef-add-btn svg { width: 13px; height: 13px; }

/* Delete icon btn */
.ef-del-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--clr-arena-400);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  flex-shrink: 0;
}
.ef-del-btn:hover {
  background: var(--clr-danger-50);
  border-color: rgba(225,29,72,0.25);
  color: var(--clr-danger-500);
}
.ef-del-btn:disabled {
  opacity: 0.3;
  pointer-events: none;
}
.ef-del-btn svg { width: 13px; height: 13px; }
`;

/* ─────────────────────────────────────────────────────────────────────────────
   SECTION DIVIDER — uppercase label + 1px flex-1 line
───────────────────────────────────────────────────────────────────────────── */
function SectionDivider({
  label,
  aside,
  first = false,
}: {
  label: string;
  aside?: React.ReactNode;
  first?: boolean;
}) {
  return (
    <div className={`ef-divider${first ? " ef-divider-first" : ""}`} style={first ? { borderTop: "none", paddingTop: 14 } : undefined}>
      <span className="ef-divider-label">{label}</span>
      <span className="ef-divider-line" aria-hidden="true" />
      {aside}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   FORM LABEL + HELPER — compact, label above input
───────────────────────────────────────────────────────────────────────────── */
function Field({
  label,
  helper,
  error,
  children,
  className = "",
}: {
  label: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-[11px] font-semibold text-secondary" style={{ letterSpacing: "0.01em" }}>
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-[11px] font-medium" style={{ color: "var(--clr-danger-500)" }}>{error}</p>
      )}
      {!error && helper && (
        <p className="mt-1 text-[11px] leading-snug text-muted">{helper}</p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SALE MODE LABEL
───────────────────────────────────────────────────────────────────────────── */
function getSaleModeLabel(mode: TicketTypeInput["saleMode"]) {
  if (mode === "PUBLIC") return { label: "Público", color: "bg-success-50 text-success-700 border-success-500/30" };
  if (mode === "COUPON_ONLY") return { label: "Cupón", color: "border-[color:var(--brand-magenta)]/30 bg-coral-50 text-[color:var(--brand-magenta)]" };
  return { label: "Oculto", color: "bg-arena-100 text-arena-500 border-arena-300" };
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export function EventForm({ mode, eventId, initial, viewerRole }: EventFormProps) {
  const router = useRouter();
  const canEditCommission = viewerRole === "ADMIN";

  /* ── All state — preserved exactly ──────────────────────────────────────── */
  const [name, setName] = useState(initial?.name ?? "");
  const [featuredTag, setFeaturedTag] = useState(initial?.featuredTag ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [featureTags, setFeatureTags] = useState<string[]>(initial?.featureTags?.slice(0, 4) ?? ["", "", "", ""]);
  const [heroImageUrl, setHeroImageUrl] = useState(initial?.heroImageUrl ?? "");
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [status, setStatus] = useState<"ACTIVE" | "UPCOMING" | "DRAFT">(initial?.status ?? "ACTIVE");
  const [platformCommissionPercent, setPlatformCommissionPercent] = useState(
    commissionBpsToPercent(initial?.platformCommissionRateBps ?? DEFAULT_PLATFORM_COMMISSION_RATE_BPS)
  );
  const [startsAt, setStartsAt] = useState(initial?.startsAt ? toLocalInputValue(initial.startsAt) : "");
  const [endsAt, setEndsAt] = useState(initial?.endsAt ? toLocalInputValue(initial.endsAt) : "");
  const [ticketTypes, setTicketTypes] = useState<TicketTypeInput[]>(
    initial?.ticketTypes ?? [{ name: "General", price: 0, stock: 100, saleMode: "PUBLIC", maxPerOrder: null, maxPerEmail: null }]
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  /* ── Derived ─────────────────────────────────────────────────────────────── */
  const totalCapacity = useMemo(
    () => ticketTypes.reduce((sum, current) => sum + (Number(current.stock) || 0), 0),
    [ticketTypes]
  );

  /* ── Handlers — preserved exactly ───────────────────────────────────────── */
  function addType() {
    setTicketTypes((current) => [
      ...current,
      { name: "", price: 0, stock: 0, saleMode: "PUBLIC", maxPerOrder: null, maxPerEmail: null },
    ]);
  }

  function removeType(index: number) {
    setTicketTypes((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function updateType(index: number, key: keyof TicketTypeInput, value: string | number | null) {
    setTicketTypes((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        return { ...item, [key]: value };
      })
    );
  }

  async function onImageFileChange(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Selecciona un archivo de imagen valido");
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
      reader.readAsDataURL(file);
    });

    setHeroImageUrl(dataUrl);
  }

  function updateFeatureTag(index: number, value: string) {
    setFeatureTags((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item))
    );
  }

  async function submitForm(targetStatus?: "ACTIVE" | "UPCOMING" | "DRAFT") {
    setLoading(true);
    setMessage(null);

    const submitStatus = targetStatus ?? status;

    const payload = {
      name,
      featuredTag,
      description,
      featureTags: featureTags.map((item) => item.trim()).filter(Boolean),
      heroImageUrl,
      venue,
      status: submitStatus,
      ...(canEditCommission ? { platformCommissionPercent } : {}),
      startsAt: localInputToISO(startsAt),
      endsAt: endsAt ? localInputToISO(endsAt) : undefined,
      ticketTypes: ticketTypes.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        name: item.name,
        price: Number(item.price),
        stock: Number(item.stock),
        saleMode: item.saleMode,
        maxPerOrder: item.maxPerOrder,
        maxPerEmail: item.maxPerEmail,
      })),
    };

    const url = mode === "create" ? "/api/events" : `/api/events/${eventId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitForm();
  }

  /* ── STATUS CONFIG ───────────────────────────────────────────────────────── */
  const statusConfig: Record<"ACTIVE" | "UPCOMING" | "DRAFT", { label: string; pill: string }> = {
    ACTIVE:   { label: "Activo",        pill: "bg-success-50 text-success-700 border-success-500/30" },
    UPCOMING: { label: "Próximamente",  pill: "border-[color:var(--brand-magenta)]/30 bg-coral-50 text-[color:var(--brand-magenta)]" },
    DRAFT:    { label: "Borrador",      pill: "bg-arena-100 text-arena-500 border-arena-300" },
  };

  /* ── SHARED INPUT CLASSES ────────────────────────────────────────────────── */
  const inputCls =
    "ef-input w-full rounded-md border border-[color:var(--border-strong)] bg-surface px-3 py-2 text-[13px] text-primary placeholder:text-muted transition-[border-color,box-shadow] duration-150";
  const selectCls = `${inputCls} ef-select cursor-pointer`;

  /* ─────────────────────────────────────────────────────────────────────────
     RENDER
  ──────────────────────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{FORM_STYLES}</style>

      <form
        id="event-form"
        onSubmit={onSubmit}
        className="pb-24"
      >
        {/* ══ SINGLE SURFACE ═════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-[color:var(--border-soft)] bg-surface shadow-[var(--shadow-sm)]">

          {/* ── SECTION: Información básica ──────────────────────────────── */}
          <div className="px-5">
            <SectionDivider label="Información básica" first />
          </div>
          <div className="grid gap-4 px-5 pb-2 md:grid-cols-2">

            {/* Nombre */}
            <Field label="Nombre del evento *" className="md:col-span-2">
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Festival de Verano 2025"
                required
              />
            </Field>

            {/* Etiqueta destacada */}
            <Field
              label="Etiqueta destacada del hero"
              helper="Badge sobre el hero en la landing pública. Dejala vacía para ocultar el badge."
              className="md:col-span-2"
            >
              <input
                className={inputCls}
                value={featuredTag}
                onChange={(e) => setFeaturedTag(e.target.value)}
                placeholder="Ej: Evento destacado"
              />
            </Field>

            {/* Descripción */}
            <Field
              label="Descripción"
              helper="Agenda, line-up o detalles clave del evento."
              className="md:col-span-2"
            >
              <textarea
                className={`${inputCls} min-h-20 resize-y`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describí agenda, line-up o detalles clave"
              />
            </Field>

            {/* Lugar */}
            <Field label="Lugar *">
              <input
                className={inputCls}
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Ej: Teatro Gran Rex, Buenos Aires"
                required
              />
            </Field>

            {/* Estado */}
            <Field label="Estado del evento">
              <div className="relative">
                <select
                  className={selectCls}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "ACTIVE" | "UPCOMING" | "DRAFT")}
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="UPCOMING">Proximamente</option>
                  <option value="DRAFT">Borrador</option>
                </select>
                <span
                  className={`pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${statusConfig[status].pill}`}
                >
                  {statusConfig[status].label}
                </span>
              </div>
            </Field>

          </div>

          {/* ── SECTION: Imagen y presentación ───────────────────────────── */}
          <div className="px-5">
            <SectionDivider label="Imagen y presentación" />
          </div>
          <div className="grid gap-4 px-5 pb-2 md:grid-cols-2">

            {/* Hero image upload — restrained drop zone */}
            <Field
              label="Imagen de portada"
              helper="JPG, PNG o WEBP. Se usa en la landing pública."
              className="md:col-span-2"
            >
              <div className="flex flex-wrap items-start gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-[color:var(--border-strong)] bg-sunken px-4 py-2.5 text-[12px] font-medium text-secondary transition-colors duration-150 hover:border-[color:var(--brand-violet)] hover:text-primary">
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Subir imagen
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => void onImageFileChange(e.target.files?.[0] ?? null)}
                  />
                </label>

                {heroImageUrl && (
                  <div className="relative h-16 w-24 overflow-hidden rounded-md border border-[color:var(--border-soft)] shadow-[var(--shadow-xs)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={heroImageUrl}
                      alt="Preview portada"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setHeroImageUrl("")}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white transition-colors duration-150 hover:bg-black/70"
                      aria-label="Quitar imagen"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </Field>

            {/* Feature tags */}
            <Field
              label="Etiquetas inferiores (opcionales)"
              helper="Hasta 4 chips que se muestran en la landing pública."
              className="md:col-span-2"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {featureTags.map((tag, index) => (
                  <input
                    key={index}
                    className={inputCls}
                    value={tag}
                    onChange={(e) => updateFeatureTag(index, e.target.value)}
                    placeholder={`Etiqueta ${index + 1}`}
                  />
                ))}
              </div>
            </Field>

          </div>

          {/* ── SECTION: Fechas y configuración ──────────────────────────── */}
          <div className="px-5">
            <SectionDivider label="Fechas y configuración" />
          </div>
          <div className="grid gap-4 px-5 pb-2 md:grid-cols-3">

            {/* Inicio */}
            <Field label="Fecha y hora de inicio *">
              <input
                className={inputCls}
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </Field>

            {/* Cierre */}
            <Field label="Fecha y hora de cierre" helper="Opcional. Dejá en blanco si no tiene fin.">
              <input
                className={inputCls}
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </Field>

            {/* Comisión plataforma */}
            <Field
              label="Comisión plataforma (%)"
              helper={
                canEditCommission
                  ? "Solo ADMIN puede editar."
                  : "Solo ADMIN puede editar esta comisión."
              }
            >
              <input
                className={inputCls}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={platformCommissionPercent}
                onChange={(e) => setPlatformCommissionPercent(Number(e.target.value))}
                disabled={!canEditCommission}
              />
            </Field>

            {/* Capacidad total — inline display */}
            <div className="flex items-center gap-2.5 rounded-md border border-[color:var(--border-soft)] bg-sunken px-3 py-2 md:col-span-3">
              <span className="text-[11px] font-semibold text-secondary">Capacidad total</span>
              <span
                className="font-display text-[1.25rem] font-extrabold leading-none tracking-tight"
                style={{ background: "var(--grad-hero)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
              >
                {totalCapacity}
              </span>
              <span className="text-[11px] text-muted">entradas</span>
            </div>

          </div>

          {/* ── SECTION: Tipos de ticket ──────────────────────────────────── */}
          <div className="px-5">
            <SectionDivider
              label="Tipos de ticket"
              aside={
                <button
                  type="button"
                  className="ef-add-btn"
                  onClick={addType}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Agregar tipo
                </button>
              }
            />
          </div>

          {/* Ticket types — inline table rows */}
          <div className="px-5 pb-4">
            <div className="overflow-hidden rounded-lg border border-[color:var(--border-soft)]">

              {/* Column headers */}
              <div className="ef-ticket-table-head">
                <span className="ef-col-label">Nombre</span>
                <span className="ef-col-label">Precio ARS</span>
                <span className="ef-col-label">Stock</span>
                <span className="ef-col-label">Modo venta</span>
                <span className="ef-col-label">Máx/orden</span>
                <span className="ef-col-label">Máx/email</span>
                <span></span>
              </div>

              {/* One row per ticket type */}
              {ticketTypes.map((type, index) => {
                const saleCfg = getSaleModeLabel(type.saleMode);
                return (
                  <div
                    key={`${type.id ?? "new"}-${index}`}
                    className="ef-ticket-table-row"
                  >
                    {/* Nombre */}
                    <div>
                      <input
                        className={inputCls}
                        value={type.name}
                        onChange={(e) => updateType(index, "name", e.target.value)}
                        placeholder="Ej: General"
                        required
                        aria-label="Nombre del tipo de ticket"
                      />
                      {type.soldCount ? (
                        <span className="mt-1 block text-[10px] font-semibold text-success-700">
                          {type.soldCount} vendidas
                        </span>
                      ) : null}
                    </div>

                    {/* Precio */}
                    <input
                      className={inputCls}
                      type="number"
                      min={0}
                      value={type.price}
                      onChange={(e) => updateType(index, "price", Number(e.target.value))}
                      required
                      aria-label="Precio"
                    />

                    {/* Stock */}
                    <input
                      className={inputCls}
                      type="number"
                      min={1}
                      value={type.stock}
                      onChange={(e) => updateType(index, "stock", Number(e.target.value))}
                      required
                      aria-label="Stock"
                    />

                    {/* Modo venta */}
                    <div>
                      <select
                        className={selectCls}
                        value={type.saleMode}
                        onChange={(e) =>
                          updateType(index, "saleMode", e.target.value as "PUBLIC" | "COUPON_ONLY" | "HIDDEN")
                        }
                        aria-label="Modo de venta"
                      >
                        <option value="PUBLIC">Público</option>
                        <option value="COUPON_ONLY">Solo cupón</option>
                        <option value="HIDDEN">Oculto</option>
                      </select>
                      <span
                        className={`mt-1 inline-flex items-center rounded-full border px-2 py-px text-[9px] font-bold uppercase tracking-[0.08em] ${saleCfg.color}`}
                      >
                        {saleCfg.label}
                      </span>
                    </div>

                    {/* Max por orden */}
                    <input
                      className={inputCls}
                      type="number"
                      min={1}
                      placeholder="∞"
                      value={type.maxPerOrder ?? ""}
                      onChange={(e) =>
                        updateType(index, "maxPerOrder", e.target.value ? Number(e.target.value) : null)
                      }
                      aria-label="Máximo por orden"
                    />

                    {/* Max por email */}
                    <input
                      className={inputCls}
                      type="number"
                      min={1}
                      placeholder="∞"
                      value={type.maxPerEmail ?? ""}
                      onChange={(e) =>
                        updateType(index, "maxPerEmail", e.target.value ? Number(e.target.value) : null)
                      }
                      aria-label="Máximo por email"
                    />

                    {/* Delete */}
                    <button
                      type="button"
                      className="ef-del-btn"
                      onClick={() => removeType(index)}
                      disabled={ticketTypes.length <= 1}
                      aria-label="Eliminar tipo de ticket"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                );
              })}

            </div>
          </div>

        </div>{/* /single surface */}

        {/* ══ STICKY FOOTER ══════════════════════════════════════════════════ */}
        <div className="ef-sticky-footer mt-0 px-5 py-3">
          <div className="flex items-center justify-end gap-3">

            {/* Feedback message */}
            {message && (
              <p
                className={`mr-auto text-[12px] font-semibold ${
                  message.toLowerCase().includes("error") || message.toLowerCase().includes("no se pudo")
                    ? "text-danger-600"
                    : "text-success-700"
                }`}
              >
                {message}
              </p>
            )}

            {/* Cancelar */}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] bg-surface px-5 py-2 text-[13px] font-medium text-secondary transition-colors duration-150 hover:text-primary hover:border-[color:var(--border-focus)]"
              onClick={() => router.back()}
            >
              Cancelar
            </button>

            {/* Guardar borrador */}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] bg-surface px-5 py-2 text-[13px] font-medium text-[color:var(--brand-violet)] transition-colors duration-150 hover:border-[color:var(--brand-violet)] hover:text-[color:var(--brand-violet-deep)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
              onClick={() => void submitForm("DRAFT")}
            >
              {loading ? "Guardando…" : "Guardar borrador"}
            </button>

            {/* Publicar evento */}
            <button
              type="submit"
              form="event-form"
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-bold text-white shadow-[var(--shadow-sm)] transition-all duration-150 hover:opacity-90 hover:shadow-[0_4px_16px_rgba(109,40,217,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "var(--grad-hero)" }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Guardando…
                </>
              ) : (
                mode === "create" ? "Publicar evento" : "Guardar cambios"
              )}
            </button>

          </div>
        </div>

      </form>
    </>
  );
}
