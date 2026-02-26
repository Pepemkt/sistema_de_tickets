"use client";

import { FormEvent, useState } from "react";
import { type TicketLayout, type TicketTemplate, ticketTemplatePresets } from "@/lib/ticket-template";

type Props = {
  eventId: string;
  eventName: string;
  venue: string;
  startsAt: string;
  ticketTypeName: string;
  initialTemplate: TicketTemplate;
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

export function TemplateEditor(props: Props) {
  const [formData, setFormData] = useState<TicketTemplate>(props.initialTemplate);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isHorizontal = formData.layout === "HORIZONTAL";
  const isCompact = formData.layout === "VERTICAL_COMPACT";

  async function onUploadImage(type: "backgroundImageDataUrl" | "logoImageDataUrl", file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Selecciona un archivo de imagen valido");
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setFormData((current) => ({
        ...current,
        [type]: dataUrl
      }));
    } catch {
      setMessage("No se pudo cargar la imagen");
    }
  }

  function applyPreset(layout: TicketLayout) {
    const preset = ticketTemplatePresets.find((item) => item.id === layout);
    if (!preset) return;

    setFormData((current) => ({
      ...current,
      ...preset.template
    }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch(`/api/admin/events/${props.eventId}/template`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error ?? "No se pudo guardar la plantilla");
      return;
    }

    setMessage("Plantilla actualizada correctamente");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[440px_1fr]">
      <section className="panel p-5">
        <h2 className="text-lg font-semibold text-slate-900">Editor de ticket por evento</h2>
        <p className="muted mt-1">Elige formato (horizontal/vertical), ajusta textos, colores e imagenes para este evento.</p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <label className="label">Formato del ticket</label>
            <div className="grid gap-2">
              {ticketTemplatePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    formData.layout === preset.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-300 bg-white hover:bg-slate-50"
                  }`}
                  onClick={() => applyPreset(preset.id)}
                >
                  <p className="text-sm font-semibold text-slate-900">{preset.name}</p>
                  <p className="text-xs text-slate-600">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Layout activo</label>
            <select
              className="field"
              value={formData.layout}
              onChange={(event) => setFormData((current) => ({ ...current, layout: event.target.value as TicketLayout }))}
            >
              <option value="HORIZONTAL">Horizontal clasico</option>
              <option value="VERTICAL">Vertical mobile</option>
              <option value="VERTICAL_COMPACT">Vertical compacto</option>
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">Color base</label>
              <input
                className="field h-11"
                type="color"
                value={formData.backgroundColor}
                onChange={(event) => setFormData((current) => ({ ...current, backgroundColor: event.target.value }))}
              />
            </div>
            <div>
              <label className="label">Color acento</label>
              <input
                className="field h-11"
                type="color"
                value={formData.accentColor}
                onChange={(event) => setFormData((current) => ({ ...current, accentColor: event.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label">Encabezado</label>
            <input
              className="field"
              value={formData.headerText}
              onChange={(event) => setFormData((current) => ({ ...current, headerText: event.target.value }))}
            />
          </div>

          <div>
            <label className="label">Pie</label>
            <input
              className="field"
              value={formData.footerText}
              onChange={(event) => setFormData((current) => ({ ...current, footerText: event.target.value }))}
            />
          </div>

          <div>
            <label className="label">Imagen de fondo</label>
            <input
              className="field"
              type="file"
              accept="image/*"
              onChange={(event) => void onUploadImage("backgroundImageDataUrl", event.target.files?.[0] ?? null)}
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setFormData((current) => ({ ...current, backgroundImageDataUrl: null }))}
              >
                Quitar fondo
              </button>
              <span className="muted self-center">{formData.backgroundImageDataUrl ? "Imagen cargada" : "Sin imagen"}</span>
            </div>
          </div>

          <div>
            <label className="label">Logo</label>
            <input
              className="field"
              type="file"
              accept="image/*"
              onChange={(event) => void onUploadImage("logoImageDataUrl", event.target.files?.[0] ?? null)}
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setFormData((current) => ({ ...current, logoImageDataUrl: null }))}
              >
                Quitar logo
              </button>
              <span className="muted self-center">{formData.logoImageDataUrl ? "Logo cargado" : "Sin logo"}</span>
            </div>
          </div>

          <button disabled={loading} className="btn-primary">
            {loading ? "Guardando..." : "Guardar diseno"}
          </button>

          {message && <p className="text-sm text-slate-600">{message}</p>}
        </form>
      </section>

      <section className="panel overflow-hidden p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Preview final</h3>
            <p className="muted">Vista aproximada del PDF para este evento y formato.</p>
          </div>
          <span className="badge">{formData.layout === "HORIZONTAL" ? "Formato Horizontal" : "Formato Vertical"}</span>
        </div>

        <article
          className={`relative overflow-hidden rounded-2xl border border-slate-200 ${
            isHorizontal ? "min-h-[380px]" : isCompact ? "mx-auto min-h-[560px] max-w-[360px]" : "mx-auto min-h-[690px] max-w-[430px]"
          }`}
          style={{
            backgroundColor: formData.backgroundColor,
            backgroundImage: formData.backgroundImageDataUrl ? `url(${formData.backgroundImageDataUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}
        >
          <div className="absolute inset-0 bg-white/75" />

          <div className="relative p-5">
            <header className="rounded-xl px-4 py-3 text-white" style={{ backgroundColor: formData.accentColor }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-wide text-white/80">Entrada oficial</p>
                  <h4 className="text-xl font-semibold">{formData.headerText}</h4>
                </div>
                {formData.logoImageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={formData.logoImageDataUrl} alt="Logo" className="h-12 w-24 rounded object-cover" />
                ) : null}
              </div>
            </header>

            <div className={`mt-4 grid gap-4 ${isHorizontal ? "lg:grid-cols-[1fr_220px]" : "grid-cols-1"}`}>
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white/95 p-4">
                <p className="text-lg font-semibold text-slate-900">{props.eventName}</p>
                <div className={`grid gap-2 text-sm text-slate-700 ${isHorizontal ? "md:grid-cols-2" : "grid-cols-1"}`}>
                  <p><span className="font-semibold">Titular:</span> Ana Perez</p>
                  <p><span className="font-semibold">Tipo:</span> {props.ticketTypeName}</p>
                  <p><span className="font-semibold">Fecha:</span> {new Date(props.startsAt).toLocaleString("es-AR")}</p>
                  <p><span className="font-semibold">Lugar:</span> {props.venue}</p>
                  <p><span className="font-semibold">Orden:</span> ORD-9F8A27</p>
                  <p><span className="font-semibold">Codigo:</span> TK-AB12CD34EF</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <div className={`mx-auto rounded border border-slate-300 bg-[linear-gradient(45deg,#dbeafe_25%,#fff_25%,#fff_50%,#dbeafe_50%,#dbeafe_75%,#fff_75%,#fff_100%)] bg-[length:20px_20px] ${
                  isHorizontal ? "h-36 w-36" : isCompact ? "h-44 w-44" : "h-56 w-56"
                }`} />
                <p className="mt-2 text-xs font-medium tracking-wide text-slate-500">QR DE VALIDACION</p>
              </div>
            </div>

            <footer className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              {formData.footerText}
            </footer>
          </div>
        </article>
      </section>
    </div>
  );
}

