"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { type TicketLayout, type TicketTemplate, ticketTemplatePresets } from "@/lib/ticket-template";

type Props = {
  eventId: string;
  eventName: string;
  venue: string;
  startsAt: string;
  ticketTypeName: string;
  initialTemplate: TicketTemplate;
};

type CropFieldProps = {
  title: string;
  hint: string;
  imageDataUrl: string | null;
  zoom: number;
  offsetX: number;
  offsetY: number;
  aspectRatio: number;
  onUpload: (file: File | null) => Promise<void>;
  onChange: (patch: { zoom?: number; offsetX?: number; offsetY?: number }) => void;
  onReset: () => void;
  onClear: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

function toCssBackgroundPositionX(offsetX: number) {
  return `${(offsetX + 100) / 2}%`;
}

function toCssBackgroundPositionY(offsetY: number) {
  return `${(offsetY + 100) / 2}%`;
}

function getLayoutDimensions(layout: TicketLayout): [number, number] {
  if (layout === "VERTICAL") return [430, 760];
  if (layout === "VERTICAL_COMPACT") return [390, 620];
  return [842, 420];
}

function ImageCropField(props: CropFieldProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!props.imageDataUrl) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: props.offsetX,
      startOffsetY: props.offsetY
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    const frame = frameRef.current;
    if (!frame) return;

    const deltaX = event.clientX - dragRef.current.startX;
    const deltaY = event.clientY - dragRef.current.startY;

    props.onChange({
      offsetX: clamp(dragRef.current.startOffsetX + (deltaX / frame.clientWidth) * 220, -100, 100),
      offsetY: clamp(dragRef.current.startOffsetY - (deltaY / frame.clientHeight) * 220, -100, 100)
    });
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <h4 className="text-sm font-semibold text-slate-900">{props.title}</h4>
      <p className="mt-1 text-xs text-slate-500">{props.hint}</p>

      <label className="mt-3 block">
        <span className="label">Subir imagen</span>
        <input className="field" type="file" accept="image/*" onChange={(event) => void props.onUpload(event.target.files?.[0] ?? null)} />
      </label>

      <div
        ref={frameRef}
        className={`mt-3 relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 ${
          props.imageDataUrl ? "cursor-grab active:cursor-grabbing" : ""
        } touch-none select-none`}
        style={{ aspectRatio: props.aspectRatio }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {props.imageDataUrl ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${props.imageDataUrl})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${props.zoom * 100}%`,
              backgroundPosition: `${toCssBackgroundPositionX(props.offsetX)} ${toCssBackgroundPositionY(props.offsetY)}`
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">Sin imagen cargada</div>
        )}

        <div className="pointer-events-none absolute inset-0 border border-white/60" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/45" />
        <div className="pointer-events-none absolute top-1/2 h-px w-full -translate-y-1/2 bg-white/45" />
      </div>

      <div className="mt-3 space-y-2">
        <label className="block">
          <span className="label">Zoom</span>
          <input
            type="range"
            min={100}
            max={300}
            step={1}
            className="w-full"
            value={Math.round(props.zoom * 100)}
            onChange={(event) => props.onChange({ zoom: Number(event.target.value) / 100 })}
          />
        </label>

        <div className="grid gap-2 md:grid-cols-2">
          <label className="block">
            <span className="label">Mover X</span>
            <input
              type="range"
              min={-100}
              max={100}
              step={1}
              className="w-full"
              value={props.offsetX}
              onChange={(event) => props.onChange({ offsetX: Number(event.target.value) })}
            />
          </label>
          <label className="block">
            <span className="label">Mover Y</span>
            <input
              type="range"
              min={-100}
              max={100}
              step={1}
              className="w-full"
              value={props.offsetY}
              onChange={(event) => props.onChange({ offsetY: Number(event.target.value) })}
            />
          </label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={props.onReset}>
          Recentrar
        </button>
        <button type="button" className="btn-secondary" onClick={props.onClear}>
          Quitar imagen
        </button>
      </div>
    </section>
  );
}

export function TemplateEditor(props: Props) {
  const [formData, setFormData] = useState<TicketTemplate>(props.initialTemplate);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const previewUrlRef = useRef<string | null>(null);
  const previewTimerRef = useRef<number | null>(null);

  const isHorizontal = formData.layout === "HORIZONTAL";
  const isCompact = formData.layout === "VERTICAL_COMPACT";
  const overlayOpacity = formData.backgroundOverlayOpacity ?? 0.82;
  const backgroundZoom = formData.backgroundImageZoom ?? 1;
  const backgroundOffsetX = formData.backgroundImageOffsetX ?? 0;
  const backgroundOffsetY = formData.backgroundImageOffsetY ?? 0;
  const logoZoom = formData.logoImageZoom ?? 1;
  const logoOffsetX = formData.logoImageOffsetX ?? 0;
  const logoOffsetY = formData.logoImageOffsetY ?? 0;

  const previewHeightClass = useMemo(() => {
    if (formData.layout === "HORIZONTAL") return "h-[460px]";
    if (formData.layout === "VERTICAL_COMPACT") return "h-[720px]";
    return "h-[860px]";
  }, [formData.layout]);

  const [layoutWidth, layoutHeight] = getLayoutDimensions(formData.layout);
  const backgroundAspect = layoutWidth / layoutHeight;

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      if (previewTimerRef.current) {
        window.clearTimeout(previewTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
    }

    previewTimerRef.current = window.setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const res = await fetch("/api/admin/events/template/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventName: props.eventName,
            venue: props.venue,
            startsAt: props.startsAt,
            ticketTypeName: props.ticketTypeName,
            template: formData
          }),
          signal: controller.signal
        });

        if (!res.ok) {
          const errorBody = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errorBody.error ?? "No se pudo actualizar la vista previa");
        }

        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
        }
        previewUrlRef.current = objectUrl;
        setPreviewPdfUrl(objectUrl);
      } catch (error) {
        if (!controller.signal.aborted) {
          setPreviewError(error instanceof Error ? error.message : "No se pudo cargar el preview PDF");
        }
      } finally {
        if (!controller.signal.aborted) {
          setPreviewLoading(false);
        }
      }
    }, 350);

    return () => {
      controller.abort();
      if (previewTimerRef.current) {
        window.clearTimeout(previewTimerRef.current);
      }
    };
  }, [formData, props.eventName, props.venue, props.startsAt, props.ticketTypeName]);

  async function onUploadImage(type: "backgroundImageDataUrl" | "logoImageDataUrl", file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Selecciona un archivo de imagen valido");
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setFormData((current) => {
        if (type === "backgroundImageDataUrl") {
          return {
            ...current,
            backgroundImageDataUrl: dataUrl,
            backgroundImageZoom: 1,
            backgroundImageOffsetX: 0,
            backgroundImageOffsetY: 0
          };
        }

        return {
          ...current,
          logoImageDataUrl: dataUrl,
          logoImageZoom: 1,
          logoImageOffsetX: 0,
          logoImageOffsetY: 0
        };
      });
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
    <div className="grid gap-6 xl:grid-cols-[460px_1fr]">
      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Editor de diseno de tickets</h2>
            <p className="muted mt-1">Ajustes visuales del PDF final con preview exacta.</p>
          </div>
          <span className="badge">{isHorizontal ? "Horizontal" : isCompact ? "Vertical compacto" : "Vertical mobile"}</span>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/events/${props.eventId}/edit`} className="btn-secondary">
                Cancelar y volver
              </Link>
              <button disabled={loading} className="btn-primary">
                {loading ? "Guardando..." : "Guardar diseno"}
              </button>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <h4 className="text-sm font-semibold text-slate-900">Formato del ticket</h4>
            <div className="mt-3 grid gap-2">
              {ticketTemplatePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`rounded-2xl border px-3 py-2 text-left transition ${
                    formData.layout === preset.id ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white hover:bg-slate-50"
                  }`}
                  onClick={() => applyPreset(preset.id)}
                >
                  <p className="text-sm font-semibold text-slate-900">{preset.name}</p>
                  <p className="text-xs text-slate-600">{preset.description}</p>
                </button>
              ))}
            </div>

            <label className="mt-3 block">
              <span className="label">Layout activo</span>
              <select
                className="field"
                value={formData.layout}
                onChange={(event) => setFormData((current) => ({ ...current, layout: event.target.value as TicketLayout }))}
              >
                <option value="HORIZONTAL">Horizontal clasico</option>
                <option value="VERTICAL">Vertical mobile</option>
                <option value="VERTICAL_COMPACT">Vertical compacto</option>
              </select>
            </label>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <h4 className="text-sm font-semibold text-slate-900">Colores y textos</h4>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="label">Color base</span>
                <input
                  className="field h-11"
                  type="color"
                  value={formData.backgroundColor}
                  onChange={(event) => setFormData((current) => ({ ...current, backgroundColor: event.target.value }))}
                />
              </label>
              <label className="block">
                <span className="label">Color acento</span>
                <input
                  className="field h-11"
                  type="color"
                  value={formData.accentColor}
                  onChange={(event) => setFormData((current) => ({ ...current, accentColor: event.target.value }))}
                />
              </label>
            </div>

            <label className="mt-3 block">
              <span className="label">Transparencia del recubrimiento</span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                  value={Math.round(overlayOpacity * 100)}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      backgroundOverlayOpacity: Number(event.target.value) / 100
                    }))
                  }
                />
                <span className="w-14 text-right text-sm font-semibold text-slate-700">{Math.round(overlayOpacity * 100)}%</span>
              </div>
            </label>

            <label className="mt-3 block">
              <span className="label">Encabezado</span>
              <input className="field" value={formData.headerText} onChange={(event) => setFormData((current) => ({ ...current, headerText: event.target.value }))} />
            </label>

            <label className="mt-3 block">
              <span className="label">Texto inferior</span>
              <textarea
                className="field min-h-20 resize-y"
                value={formData.footerText}
                onChange={(event) => setFormData((current) => ({ ...current, footerText: event.target.value }))}
              />
            </label>
          </section>

          <ImageCropField
            title="Imagen de fondo"
            hint="Tipo cropper: arrastra para reencuadrar y usa zoom."
            imageDataUrl={formData.backgroundImageDataUrl ?? null}
            zoom={backgroundZoom}
            offsetX={backgroundOffsetX}
            offsetY={backgroundOffsetY}
            aspectRatio={backgroundAspect}
            onUpload={(file) => onUploadImage("backgroundImageDataUrl", file)}
            onChange={(patch) =>
              setFormData((current) => ({
                ...current,
                backgroundImageZoom: patch.zoom ?? current.backgroundImageZoom,
                backgroundImageOffsetX: patch.offsetX ?? current.backgroundImageOffsetX,
                backgroundImageOffsetY: patch.offsetY ?? current.backgroundImageOffsetY
              }))
            }
            onReset={() =>
              setFormData((current) => ({
                ...current,
                backgroundImageZoom: 1,
                backgroundImageOffsetX: 0,
                backgroundImageOffsetY: 0
              }))
            }
            onClear={() =>
              setFormData((current) => ({
                ...current,
                backgroundImageDataUrl: null,
                backgroundImageZoom: 1,
                backgroundImageOffsetX: 0,
                backgroundImageOffsetY: 0
              }))
            }
          />

          <ImageCropField
            title="Logo"
            hint="Espacio cuadrado en cabecera. Arrastra para encuadrar."
            imageDataUrl={formData.logoImageDataUrl ?? null}
            zoom={logoZoom}
            offsetX={logoOffsetX}
            offsetY={logoOffsetY}
            aspectRatio={1}
            onUpload={(file) => onUploadImage("logoImageDataUrl", file)}
            onChange={(patch) =>
              setFormData((current) => ({
                ...current,
                logoImageZoom: patch.zoom ?? current.logoImageZoom,
                logoImageOffsetX: patch.offsetX ?? current.logoImageOffsetX,
                logoImageOffsetY: patch.offsetY ?? current.logoImageOffsetY
              }))
            }
            onReset={() =>
              setFormData((current) => ({
                ...current,
                logoImageZoom: 1,
                logoImageOffsetX: 0,
                logoImageOffsetY: 0
              }))
            }
            onClear={() =>
              setFormData((current) => ({
                ...current,
                logoImageDataUrl: null,
                logoImageZoom: 1,
                logoImageOffsetX: 0,
                logoImageOffsetY: 0
              }))
            }
          />

          {message && <p className="text-sm text-slate-600">{message}</p>}
        </form>
      </section>

      <section className="panel overflow-hidden p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Vista previa exacta</h3>
          <p className="muted">Render real del PDF final para este evento y formato.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-2">
          {previewPdfUrl ? (
            <iframe title="Preview PDF ticket" src={previewPdfUrl} className={`w-full rounded-xl bg-white ${previewHeightClass}`} />
          ) : (
            <div className={`flex w-full items-center justify-center rounded-xl bg-white ${previewHeightClass}`}>
              <p className="text-sm text-slate-500">Generando preview de ticket...</p>
            </div>
          )}
        </div>

        {previewLoading ? <p className="mt-3 text-sm text-slate-500">Actualizando preview...</p> : null}
        {previewError ? <p className="mt-3 text-sm text-rose-600">{previewError}</p> : null}
      </section>
    </div>
  );
}
