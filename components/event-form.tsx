"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@prisma/client";
import { commissionBpsToPercent, DEFAULT_PLATFORM_COMMISSION_RATE_BPS } from "@/lib/platform-commission";

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

function toLocalInputValue(date: string) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return "";
  }

  const pad = (number: number) => String(number).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function EventForm({ mode, eventId, initial, viewerRole }: EventFormProps) {
  const router = useRouter();
  const canEditCommission = viewerRole === "ADMIN";
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
    setFeatureTags((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const payload = {
      name,
      featuredTag,
      description,
      featureTags: featureTags.map((item) => item.trim()).filter(Boolean),
      heroImageUrl,
      venue,
      status,
      ...(canEditCommission ? { platformCommissionPercent } : {}),
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
          <label className="label">Etiqueta destacada del hero</label>
          <input
            className="field"
            value={featuredTag}
            onChange={(event) => setFeaturedTag(event.target.value)}
            placeholder="Ej: Evento destacado"
          />
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

        <div className="md:col-span-2">
          <label className="label">Imagen del evento</label>
          <input
            className="field"
            type="file"
            accept="image/*"
            onChange={(event) => void onImageFileChange(event.target.files?.[0] ?? null)}
          />
          <p className="mt-1 text-caption text-muted">Sube una imagen para portada publica del evento.</p>
          {heroImageUrl && (
            <button type="button" className="btn-secondary mt-2" onClick={() => setHeroImageUrl("")}>
              Quitar imagen
            </button>
          )}
        </div>

        {heroImageUrl && (
          <div className="md:col-span-2 overflow-hidden rounded-md border border-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImageUrl} alt="Preview portada del evento" className="h-56 w-full object-cover" />
          </div>
        )}

        <div className="md:col-span-2">
          <label className="label">Etiquetas inferiores (opcionales)</label>
          <div className="grid gap-2 md:grid-cols-2">
            {featureTags.map((tag, index) => (
              <input
                key={index}
                className="field"
                value={tag}
                onChange={(event) => updateFeatureTag(index, event.target.value)}
                placeholder={`Etiqueta ${index + 1}`}
              />
            ))}
          </div>
          <p className="mt-1 text-caption text-muted">Puedes dejarlas en blanco y no se mostraran en la landing publica.</p>
        </div>

        <div>
          <label className="label">Lugar</label>
          <input className="field" value={venue} onChange={(event) => setVenue(event.target.value)} required />
        </div>

        <div>
          <label className="label">Estado del evento</label>
          <select className="field" value={status} onChange={(event) => setStatus(event.target.value as "ACTIVE" | "UPCOMING" | "DRAFT")}>
            <option value="ACTIVE">Activo</option>
            <option value="UPCOMING">Proximamente</option>
            <option value="DRAFT">Borrador</option>
          </select>
        </div>

        <div>
          <label className="label">Comision plataforma (%)</label>
          <input
            className="field"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={platformCommissionPercent}
            onChange={(event) => setPlatformCommissionPercent(Number(event.target.value))}
            disabled={!canEditCommission}
          />
          <p className="mt-1 text-caption text-muted">
            {canEditCommission
              ? "Solo ADMIN puede editar esta comision. Se usa para futuras liquidaciones manuales del evento."
              : "Visible para MANAGER en modo lectura. Solo ADMIN puede editar esta comision."}
          </p>
        </div>

        <div>
          <label className="label">Fecha y hora de inicio</label>
          <input className="field" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
        </div>

        <div>
          <label className="label">Fecha y hora de cierre (opcional)</label>
          <input className="field" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
        </div>

        <div className="rounded-md border border-soft bg-sunken p-3">
          <p className="text-body-s font-medium text-secondary">Capacidad total</p>
          <p className="font-display text-title-m font-bold text-[color:var(--brand-magenta)]">{totalCapacity}</p>
        </div>
      </div>

      <section className="rounded-lg border border-soft p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-body-l font-semibold text-primary">Tipos de entrada</h3>
          <button type="button" onClick={addType} className="btn-secondary">
            Agregar tipo
          </button>
        </div>

        <div className="space-y-3">
          {ticketTypes.map((type, index) => (
            <div key={`${type.id ?? "new"}-${index}`} className="grid gap-3 rounded-md border border-soft p-3 md:grid-cols-12">
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
                {type.soldCount ? <p className="mt-1 text-caption text-muted">Vendidas: {type.soldCount}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={loading}>
          {loading ? "Guardando..." : mode === "create" ? "Crear evento" : "Guardar cambios"}
        </button>

        {message && <p className="text-body-s text-secondary">{message}</p>}
      </div>
    </form>
  );
}
