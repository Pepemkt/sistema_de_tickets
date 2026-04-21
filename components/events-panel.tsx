"use client";

import Link from "next/link";
import { useState } from "react";
import { centsToCurrency } from "@/lib/utils";

type ViewerRole = "ADMIN" | "MANAGER" | "SELLER" | "SCANNER";

type EventItem = {
  id: string;
  slug: string;
  name: string;
  status: "ACTIVE" | "UPCOMING" | "DRAFT";
  description: string | null;
  venue: string | null;
  startsAt: Date;
  startsAtLabel: string;
  ticketTypes: Array<{
    id: string;
    name: string;
    priceCents: number;
    saleMode: "PUBLIC" | "COUPON_ONLY" | "HIDDEN";
  }>;
};

type Props = {
  viewerRole: ViewerRole;
  appUrl: string;
  events: EventItem[];
};

type ViewMode = "cards" | "list";

function eventPublicUrl(appUrl: string, slug: string) {
  const base = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
  return `${base}/e/${slug}`;
}

function getStatusLabel(status: EventItem["status"]) {
  if (status === "ACTIVE") return "Activo";
  if (status === "UPCOMING") return "Proximamente";
  return "Borrador";
}

function EventActions({ viewerRole, eventId, publicUrl }: { viewerRole: ViewerRole; eventId: string; publicUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  async function onDeleteEvent() {
    if (!confirm("Vas a eliminar el evento y todos sus datos asociados. Esta accion no se puede deshacer. Continuar?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = typeof data.error === "string" ? data.error : "No se pudo eliminar el evento";
        alert(message);
        setDeleting(false);
        return;
      }
      window.location.reload();
    } catch {
      alert("No se pudo eliminar el evento");
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/events/${eventId}`} className="btn-primary">
        Abrir compra
      </Link>
      <button type="button" className="btn-secondary" onClick={() => void onCopy()}>
        {copied ? "Copiado" : "Copiar link"}
      </button>
      {(viewerRole === "ADMIN" || viewerRole === "MANAGER") && (
        <Link href={`/admin/events/${eventId}/edit`} className="btn-secondary">
          Editar
        </Link>
      )}
      {(viewerRole === "ADMIN" || viewerRole === "MANAGER") && (
        <button type="button" className="btn-secondary" onClick={() => void onDeleteEvent()} disabled={deleting}>
          {deleting ? "Eliminando..." : "Eliminar"}
        </button>
      )}
    </div>
  );
}

export function EventsPanel({ viewerRole, appUrl, events }: Props) {
  const [mode, setMode] = useState<ViewMode>("cards");

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-title-xl font-bold text-primary">Panel de eventos</h1>
            <p className="mt-1 text-body-s text-secondary">Administra, comparte y accede rapido a cada evento.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-soft bg-surface p-1">
              <button
                type="button"
                onClick={() => setMode("cards")}
                className={`rounded-full px-3 py-1.5 text-body-s ${mode === "cards" ? "bg-[color:var(--brand-violet)] text-white" : "text-secondary hover:bg-sunken"}`}
              >
                Tarjetas
              </button>
              <button
                type="button"
                onClick={() => setMode("list")}
                className={`rounded-full px-3 py-1.5 text-body-s ${mode === "list" ? "bg-[color:var(--brand-violet)] text-white" : "text-secondary hover:bg-sunken"}`}
              >
                Lista
              </button>
            </div>

            {(viewerRole === "ADMIN" || viewerRole === "MANAGER") && (
              <Link href="/admin/events/new" className="btn-primary">
                Nuevo evento
              </Link>
            )}
          </div>
        </div>
      </section>

      {events.length === 0 ? (
        <section className="panel p-8">
          <p className="text-secondary">Aun no hay eventos publicados.</p>
          {(viewerRole === "ADMIN" || viewerRole === "MANAGER") && (
            <Link href="/admin/events/new" className="btn-primary mt-4 inline-flex">
              Crear primer evento
            </Link>
          )}
        </section>
      ) : mode === "cards" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {events.map((event) => {
            const listedTypes = event.ticketTypes.filter((type) => type.saleMode !== "HIDDEN");
            const fromType = listedTypes[0] ?? null;
            const publicUrl = eventPublicUrl(appUrl, event.slug);

            return (
              <article key={event.id} className="panel p-6">
                <p className="text-overline font-semibold uppercase tracking-[0.1em] text-[color:var(--brand-magenta)]">{event.startsAtLabel}</p>
                <h2 className="mt-1 font-display text-title-l font-bold text-primary">{event.name}</h2>
                <p className="mt-1 text-overline font-semibold uppercase tracking-wide text-muted">Estado: {getStatusLabel(event.status)}</p>
                <p className="mt-1 text-body-s text-secondary">{event.venue ?? "Lugar por confirmar"}</p>
                <p className="mt-3 line-clamp-2 text-body-s text-secondary">{event.description ?? "Sin descripcion"}</p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-overline uppercase text-muted">Desde</p>
                    <p className="font-display text-title-l font-bold text-[color:var(--brand-magenta)]">
                      {fromType ? centsToCurrency(fromType.priceCents) : "Solo emision interna"}
                    </p>
                  </div>
                  <EventActions viewerRole={viewerRole} eventId={event.id} publicUrl={publicUrl} />
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="panel p-2">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-soft text-left text-muted">
                  <th className="px-3 py-2">Evento</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Lugar</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Precio base</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const listedTypes = event.ticketTypes.filter((type) => type.saleMode !== "HIDDEN");
                  const fromType = listedTypes[0] ?? null;
                  const publicUrl = eventPublicUrl(appUrl, event.slug);

                  return (
                    <tr key={event.id} className="border-b border-soft">
                      <td className="px-3 py-3">
                        <p className="font-medium text-primary">{event.name}</p>
                        <p className="text-caption text-muted">/{event.slug}</p>
                      </td>
                      <td className="px-3 py-3 text-secondary">{event.startsAtLabel}</td>
                      <td className="px-3 py-3 text-secondary">{event.venue ?? "-"}</td>
                      <td className="px-3 py-3 text-secondary">{getStatusLabel(event.status)}</td>
                      <td className="px-3 py-3 font-medium text-primary">
                        {fromType ? centsToCurrency(fromType.priceCents) : "Interno"}
                      </td>
                      <td className="px-3 py-3">
                        <EventActions viewerRole={viewerRole} eventId={event.id} publicUrl={publicUrl} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
