"use client";

import Link from "next/link";
import { useState } from "react";
import { centsToCurrency } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────────── */
type ViewerRole = "ADMIN" | "MANAGER" | "SELLER" | "SCANNER";

type EventItem = {
  id: string;
  slug: string;
  name: string;
  status: "ACTIVE" | "UPCOMING" | "DRAFT";
  description: string | null;
  venue: string | null;
  heroImageUrl: string | null;
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

type StatusFilter = "all" | "ACTIVE" | "UPCOMING" | "DRAFT";

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */
function eventPublicUrl(appUrl: string, slug: string) {
  const base = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
  return `${base}/e/${slug}`;
}

function getStatusLabel(status: EventItem["status"]) {
  if (status === "ACTIVE")   return "Publicado";
  if (status === "UPCOMING") return "Próximo";
  return "Borrador";
}

type StatusConfig = { label: string; pill: string };
function getStatusConfig(status: EventItem["status"]): StatusConfig {
  const label = getStatusLabel(status);
  if (status === "ACTIVE")
    return { label, pill: "bg-success-50 text-success-700 border-success-500/30" };
  if (status === "UPCOMING")
    return { label, pill: "bg-[rgba(109,40,217,0.07)] text-[color:var(--brand-violet)] border-[rgba(109,40,217,0.20)]" };
  return { label, pill: "bg-[color:var(--bg-sunken)] text-secondary border-[color:var(--border-soft)]" };
}

function relativeDate(date: Date): string {
  const now  = Date.now();
  const diff = now - date.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 0)   return `en ${Math.abs(days)}d`;
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30)  return `hace ${days}d`;
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(date);
}

/* ─────────────────────────────────────────────────────────────────────────────
   CSS-ONLY KEYFRAMES — injected once
───────────────────────────────────────────────────────────────────────────── */
const PANEL_STYLES = `
@keyframes ev-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ev-row-in {
  from { opacity: 0; transform: translateX(-4px); }
  to   { opacity: 1; transform: translateX(0); }
}

.ev-hero    { animation: ev-fade-up 0.48s var(--ease-tactile) 0.02s both; }
.ev-chips   { animation: ev-fade-up 0.48s var(--ease-tactile) 0.08s both; }
.ev-filters { animation: ev-fade-up 0.48s var(--ease-tactile) 0.14s both; }
.ev-table   { animation: ev-fade-up 0.48s var(--ease-tactile) 0.20s both; }

/* Staggered row fade-in — cap at 10 rows */
.ev-row { animation: ev-row-in 0.34s var(--ease-tactile) both; }
.ev-row:nth-child(1)  { animation-delay: 0.22s; }
.ev-row:nth-child(2)  { animation-delay: 0.24s; }
.ev-row:nth-child(3)  { animation-delay: 0.26s; }
.ev-row:nth-child(4)  { animation-delay: 0.28s; }
.ev-row:nth-child(5)  { animation-delay: 0.30s; }
.ev-row:nth-child(6)  { animation-delay: 0.32s; }
.ev-row:nth-child(7)  { animation-delay: 0.34s; }
.ev-row:nth-child(8)  { animation-delay: 0.36s; }
.ev-row:nth-child(9)  { animation-delay: 0.38s; }
.ev-row:nth-child(10) { animation-delay: 0.40s; }

/* Row hover */
.ev-tr { transition: background-color 0.10s ease; }
.ev-tr:hover { background-color: var(--bg-sunken); }

/* Tabular numbers */
.ev-num {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}

/* Mini progress bar */
.ev-bar-track {
  display: inline-block;
  width: 44px;
  height: 3px;
  border-radius: 2px;
  background: var(--clr-arena-200);
  overflow: hidden;
  vertical-align: middle;
}
.ev-bar-fill {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--grad-hero);
}

/* ── ICON-ACTION BUTTONS with ::after tooltip ─────────────────────────── */
.ev-action-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
  flex-shrink: 0;
  text-decoration: none;
}
.ev-action-btn:hover {
  background-color: var(--bg-sunken);
  color: var(--text-primary);
}
.ev-action-btn.ev-danger:hover {
  background-color: var(--clr-danger-50);
  color: var(--clr-danger-500);
}
.ev-action-btn::after {
  content: attr(data-tip);
  position: absolute;
  bottom: calc(100% + 5px);
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  background: var(--clr-arena-700);
  color: var(--clr-white);
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 500;
  padding: 3px 7px;
  border-radius: 5px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.14s ease;
  z-index: 10;
}
.ev-action-btn:hover::after { opacity: 1; }

/* ── KPI CHIPS ─────────────────────────────────────────────────────────── */
.ev-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 8px 14px;
  border-right: 1px solid var(--border-soft);
  min-width: 72px;
}
.ev-chip:last-child { border-right: none; }

/* ── STATUS SEGMENTED CONTROL ──────────────────────────────────────────── */
.ev-seg-btn {
  display: inline-flex;
  align-items: center;
  padding: 4px 11px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
  white-space: nowrap;
}
.ev-seg-btn:hover { color: var(--text-primary); background-color: var(--bg-sunken); }
.ev-seg-btn.active {
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(21,22,43,0.08);
}
`;

/* ─────────────────────────────────────────────────────────────────────────────
   STATUS PILL
───────────────────────────────────────────────────────────────────────────── */
function StatusPill({ status }: { status: EventItem["status"] }) {
  const cfg = getStatusConfig(status);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${cfg.pill}`}
    >
      {cfg.label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ROW ACTIONS — icon-only, 28×28, with ::after tooltips
   Preserves all role-based visibility from original.
───────────────────────────────────────────────────────────────────────────── */
function RowActions({
  viewerRole,
  eventId,
  slug,
  appUrl,
}: {
  viewerRole: ViewerRole;
  eventId: string;
  slug: string;
  appUrl: string;
}) {
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const publicUrl = eventPublicUrl(appUrl, slug);

  const canEdit   = viewerRole === "ADMIN" || viewerRole === "MANAGER";
  const canDelete = viewerRole === "ADMIN" || viewerRole === "MANAGER";

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
    if (
      !confirm(
        "Vas a eliminar el evento y todos sus datos asociados. Esta accion no se puede deshacer. Continuar?"
      )
    )
      return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message =
          typeof data.error === "string"
            ? data.error
            : "No se pudo eliminar el evento";
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
    <div className="flex items-center justify-end gap-0.5">
      {/* Ver evento público — eye icon */}
      <Link
        href={publicUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="ev-action-btn"
        data-tip={copied ? "¡Copiado!" : "Ver evento"}
        aria-label="Ver evento público"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </Link>

      {/* Copiar link — clipboard icon */}
      <button
        type="button"
        className="ev-action-btn"
        data-tip={copied ? "¡Copiado!" : "Copiar link"}
        aria-label="Copiar link público"
        onClick={() => void onCopy()}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>

      {/* Editar — pencil icon (ADMIN/MANAGER only) */}
      {canEdit && (
        <Link
          href={`/admin/events/${eventId}/edit`}
          className="ev-action-btn"
          data-tip="Editar"
          aria-label="Editar evento"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </Link>
      )}

      {/* Liquidación — dollar/chart icon (ADMIN/MANAGER only) */}
      {canEdit && (
        <Link
          href={`/admin/events/${eventId}/liquidation`}
          className="ev-action-btn"
          data-tip="Liquidación"
          aria-label="Ver liquidación del evento"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </Link>
      )}

      {/* Eliminar — trash icon (ADMIN/MANAGER only) */}
      {canDelete && (
        <button
          type="button"
          className="ev-action-btn ev-danger"
          data-tip={deleting ? "Eliminando…" : "Eliminar"}
          aria-label="Eliminar evento"
          onClick={() => void onDeleteEvent()}
          disabled={deleting}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN PANEL
───────────────────────────────────────────────────────────────────────────── */
export function EventsPanel({ viewerRole, appUrl, events }: Props) {
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  /* ── Stats ── */
  const totalActive   = events.filter((e) => e.status === "ACTIVE").length;
  const totalUpcoming = events.filter((e) => e.status === "UPCOMING").length;
  const totalDraft    = events.filter((e) => e.status === "DRAFT").length;

  const canCreate = viewerRole === "ADMIN" || viewerRole === "MANAGER";

  /* ── Filtered list ── */
  const filtered = events.filter((e) => {
    const matchStatus =
      statusFilter === "all" || e.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      e.name.toLowerCase().includes(q) ||
      (e.venue ?? "").toLowerCase().includes(q) ||
      e.slug.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const kpiChips = [
    { label: "Total",      value: events.length,   color: "text-primary" },
    { label: "Publicados", value: totalActive,      color: "text-success-700" },
    { label: "Próximos",   value: totalUpcoming,    color: "text-[color:var(--brand-violet)]" },
    { label: "Borradores", value: totalDraft,       color: "text-secondary" },
  ];

  const segFilters: { key: StatusFilter; label: string }[] = [
    { key: "all",      label: "Todos"       },
    { key: "ACTIVE",   label: "Publicados"  },
    { key: "UPCOMING", label: "Próximos"    },
    { key: "DRAFT",    label: "Borradores"  },
  ];

  return (
    <>
      {/* Inject keyframes once */}
      <style>{PANEL_STYLES}</style>

      <div className="space-y-0">

        {/* ── HERO BAR ────────────────────────────────────────────────────────
            Bare div, no card wrapping. 1px border-bottom divider.
        ──────────────────────────────────────────────────────────────────────── */}
        <div
          className="ev-hero flex flex-wrap items-start justify-between gap-4 pb-5"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--brand-violet)" }}
            >
              EVENTOS
            </p>
            <h1 className="mt-1 font-display text-[1.625rem] font-extrabold leading-tight tracking-tight text-primary">
              Eventos<span style={{ color: "var(--brand-magenta)" }}>.</span>
            </h1>
            <p className="mt-1 text-[12px] text-secondary">
              <span className="font-medium text-primary">{events.length}</span>
              {" eventos · "}
              <span className="font-medium text-primary">{totalActive}</span>
              {" publicados · "}
              <span className="font-medium text-primary">{totalDraft}</span>
              {" borradores"}
            </p>
          </div>

          {/* Right: primary CTA */}
          {canCreate && (
            <div className="flex items-center gap-2 pt-0.5">
              <Link
                href="/admin/events/new"
                className="inline-flex items-center gap-1.5 rounded-[7px] px-3.5 py-[6px] text-[12px] font-semibold text-white transition-opacity duration-[120ms] hover:opacity-90"
                style={{ background: "var(--grad-hero)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Nuevo evento
              </Link>
            </div>
          )}
        </div>

        {/* ── KPI CHIPS ROW ────────────────────────────────────────────────────
            Tight horizontal strip, no card wrapping, dividers between chips.
        ──────────────────────────────────────────────────────────────────────── */}
        <div
          className="ev-chips flex flex-wrap items-stretch"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
          aria-label="Resumen de eventos"
        >
          {kpiChips.map((chip) => (
            <div key={chip.label} className="ev-chip">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">
                {chip.label}
              </span>
              <span
                className={`ev-num mt-0.5 font-display text-[1.25rem] font-extrabold leading-none tracking-tight ${chip.color}`}
              >
                {chip.value}
              </span>
            </div>
          ))}
        </div>

        {/* ── FILTERS ROW ──────────────────────────────────────────────────────
            Segmented control + search + results count.
        ──────────────────────────────────────────────────────────────────────── */}
        <div
          className="ev-filters flex flex-wrap items-center gap-2 py-3"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          {/* Segmented control */}
          <div
            className="flex items-center gap-0.5 rounded-[8px] p-0.5"
            style={{ backgroundColor: "var(--bg-sunken)", border: "1px solid var(--border-soft)" }}
            role="group"
            aria-label="Filtrar por estado"
          >
            {segFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`ev-seg-btn${statusFilter === f.key ? " active" : ""}`}
                onClick={() => setStatusFilter(f.key)}
                aria-pressed={statusFilter === f.key}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search input with leading icon */}
          <div className="relative flex items-center">
            <svg
              className="pointer-events-none absolute left-2.5 text-muted"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar evento, lugar…"
              className="rounded-[7px] border py-[5px] pl-8 pr-3 text-[12px] text-primary placeholder:text-muted outline-none transition-[border-color,box-shadow] duration-[120ms] focus:shadow-[var(--shadow-focus)]"
              style={{
                borderColor: "var(--border-soft)",
                backgroundColor: "var(--bg-surface)",
                width: "200px",
              }}
              aria-label="Buscar eventos"
            />
          </div>

          {/* Spacer + results count right-aligned */}
          <div className="ml-auto text-[11px] text-secondary">
            <span className="font-medium text-primary">{filtered.length}</span> resultados
          </div>
        </div>

        {/* ── EVENTS TABLE ─────────────────────────────────────────────────────
            Dense, no card wrap. Matches orders/dashboard voice.
        ──────────────────────────────────────────────────────────────────────── */}
        <div className="ev-table overflow-x-auto">
          <table className="min-w-full" style={{ fontSize: "13px", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--bg-sunken)",
                  borderBottom: "1px solid var(--border-soft)",
                }}
              >
                <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                  Evento
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                  Fecha
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                  Tipos
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                  Estado
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-[13px] text-muted"
                    style={{ borderBottom: "1px solid var(--border-soft)" }}
                  >
                    {events.length === 0
                      ? "No hay eventos creados aún."
                      : "Ningún evento coincide con los filtros."}
                  </td>
                </tr>
              ) : (
                filtered.map((event) => {
                  const listedTypes = event.ticketTypes.filter(
                    (t) => t.saleMode !== "HIDDEN"
                  );

                  return (
                    <tr
                      key={event.id}
                      className="ev-row ev-tr"
                      style={{ borderBottom: "1px solid var(--border-soft)" }}
                    >
                      {/* Evento — name + venue small line */}
                      <td className="px-3 py-2">
                        <p className="max-w-[200px] truncate text-[13px] font-semibold text-primary">
                          {event.name}
                        </p>
                        {event.venue && (
                          <p className="mt-0.5 max-w-[200px] truncate text-[11px] text-muted">
                            {event.venue}
                          </p>
                        )}
                      </td>

                      {/* Fecha — label + relative */}
                      <td className="whitespace-nowrap px-3 py-2">
                        <p className="text-[13px] text-secondary">
                          {event.startsAtLabel}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {relativeDate(event.startsAt)}
                        </p>
                      </td>

                      {/* Tipos — chip count */}
                      <td className="whitespace-nowrap px-3 py-2">
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold"
                          style={{
                            borderColor: "var(--border-soft)",
                            color: "var(--text-secondary)",
                            backgroundColor: "var(--bg-sunken)",
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" />
                          </svg>
                          {listedTypes.length}
                        </span>
                      </td>

                      {/* Estado — flat pill */}
                      <td className="whitespace-nowrap px-3 py-2">
                        <StatusPill status={event.status} />
                      </td>

                      {/* Acciones — icon-only */}
                      <td className="whitespace-nowrap px-3 py-2">
                        <RowActions
                          viewerRole={viewerRole}
                          eventId={event.id}
                          slug={event.slug}
                          appUrl={appUrl}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>
    </>
  );
}
