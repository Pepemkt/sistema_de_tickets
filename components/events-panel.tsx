"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { centsToCurrency } from "@/lib/utils";

type ViewerRole = "ADMIN" | "SELLER" | "SCANNER";

type EventItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  venue: string | null;
  startsAt: Date;
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

function EventActions({ viewerRole, eventId, publicUrl }: { viewerRole: ViewerRole; eventId: string; publicUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
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
      {viewerRole === "ADMIN" && (
        <Link href={`/admin/events/${eventId}/edit`} className="btn-secondary">
          Editar
        </Link>
      )}
    </div>
  );
}

export function EventsPanel({ viewerRole, appUrl, events }: Props) {
  const [mode, setMode] = useState<ViewMode>("cards");
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-AR", {
        dateStyle: "medium",
        timeStyle: "short"
      }),
    []
  );

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Panel de eventos</h1>
            <p className="mt-1 text-sm text-slate-600">Administra, comparte y accede rapido a cada evento.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
              <button
                type="button"
                onClick={() => setMode("cards")}
                className={`rounded-md px-3 py-1.5 text-sm ${mode === "cards" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Tarjetas
              </button>
              <button
                type="button"
                onClick={() => setMode("list")}
                className={`rounded-md px-3 py-1.5 text-sm ${mode === "list" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Lista
              </button>
            </div>

            {viewerRole === "ADMIN" && (
              <Link href="/admin/events/new" className="btn-primary">
                Nuevo evento
              </Link>
            )}
          </div>
        </div>
      </section>

      {events.length === 0 ? (
        <section className="panel p-8">
          <p className="text-slate-600">Aun no hay eventos publicados.</p>
          {viewerRole === "ADMIN" && (
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
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dateFormatter.format(new Date(event.startsAt))}</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">{event.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{event.venue ?? "Lugar por confirmar"}</p>
                <p className="mt-3 line-clamp-2 text-sm text-slate-600">{event.description ?? "Sin descripcion"}</p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Desde</p>
                    <p className="text-xl font-semibold text-blue-700">
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
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-3 py-2">Evento</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Lugar</th>
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
                    <tr key={event.id} className="border-b border-slate-100">
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-900">{event.name}</p>
                        <p className="text-xs text-slate-500">/{event.slug}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{dateFormatter.format(new Date(event.startsAt))}</td>
                      <td className="px-3 py-3 text-slate-700">{event.venue ?? "-"}</td>
                      <td className="px-3 py-3 font-medium text-slate-900">
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
