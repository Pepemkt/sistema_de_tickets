import Link from "next/link";
import { requirePageRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getScopedEventIdsForViewer } from "@/lib/event-scope";

/* ─────────────────────────────────────────────────────────────────────────────
   CSS — server-safe (no "use client")
───────────────────────────────────────────────────────────────────────────── */
const PAGE_STYLES = `
@keyframes cl-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes cl-row-in {
  from { opacity: 0; transform: translateX(-4px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes cl-pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.55; transform: scale(0.8); }
}

.cl-hero    { animation: cl-fade-up 0.48s var(--ease-tactile) 0.02s both; }
.cl-chips   { animation: cl-fade-up 0.48s var(--ease-tactile) 0.08s both; }
.cl-filters { animation: cl-fade-up 0.48s var(--ease-tactile) 0.12s both; }
.cl-table   { animation: cl-fade-up 0.48s var(--ease-tactile) 0.18s both; }

/* Table row */
.cl-tr { transition: background-color 0.10s ease; cursor: default; }
.cl-tr:hover { background-color: var(--bg-sunken); }

/* Row stagger */
.cl-row { animation: cl-row-in 0.34s var(--ease-tactile) both; }
.cl-row:nth-child(1)  { animation-delay: 0.22s; }
.cl-row:nth-child(2)  { animation-delay: 0.25s; }
.cl-row:nth-child(3)  { animation-delay: 0.28s; }
.cl-row:nth-child(4)  { animation-delay: 0.31s; }
.cl-row:nth-child(5)  { animation-delay: 0.34s; }
.cl-row:nth-child(6)  { animation-delay: 0.37s; }
.cl-row:nth-child(7)  { animation-delay: 0.40s; }
.cl-row:nth-child(8)  { animation-delay: 0.43s; }

/* Pulse dot */
.cl-dot-active { animation: cl-pulse-dot 2s ease-in-out infinite; }

/* Monogram avatar */
.cl-monogram {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 800;
  font-family: var(--font-display);
  color: #fff;
  letter-spacing: -0.01em;
  user-select: none;
}

/* KPI chip strip */
.cl-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 8px 14px;
  border-right: 1px solid var(--border-soft);
  min-width: 80px;
}
.cl-chip:last-child { border-right: none; }

/* Icon-only action buttons with ::after tooltip */
.cl-action-btn {
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
  text-decoration: none;
  transition: background-color 0.12s ease, color 0.12s ease;
  flex-shrink: 0;
}
.cl-action-btn:hover {
  background-color: var(--bg-sunken);
  color: var(--text-primary);
}
.cl-action-btn::after {
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
.cl-action-btn:hover::after { opacity: 1; }
`;

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function getAvatarGradient(index: number): string {
  const grads = [
    "from-[#5B21B6] to-[#7C3AED]",
    "from-[#DB1E7A] to-[#EC4899]",
    "from-[#4C1D95] to-[#EC2A8A]",
    "from-[#1E40AF] to-[#3B82F6]",
    "from-[#065F46] to-[#10B981]",
  ];
  return grads[index % grads.length];
}

function getMpStatusPill(status: "ACTIVE" | "DISABLED" | null) {
  if (status === "ACTIVE")
    return "bg-success-50 text-success-700 border-success-500/30";
  if (status === "DISABLED")
    return "bg-warning-50 text-warning-700 border-warning-500/30";
  return "bg-[color:var(--bg-sunken)] text-secondary border-[color:var(--border-soft)]";
}

function getMpStatusLabel(status: "ACTIVE" | "DISABLED" | null) {
  if (status === "ACTIVE") return "Conectado";
  if (status === "DISABLED") return "Deshabilitado";
  return "Sin MP";
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────────────────────── */
export default async function AdminClientsPage() {
  const viewer = await requirePageRole(["ADMIN", "MANAGER"]);
  const scopedEventIds = await getScopedEventIdsForViewer(viewer);

  const clientReader = db as unknown as {
    client: {
      findMany(args: {
        where?: { events: { some: { id: { in: string[] } } } };
        orderBy: { name: "asc" };
        select: {
          id: true;
          name: true;
          merchantAccounts: {
            where: { provider: "MERCADOPAGO" };
            take: 1;
            select: { id: true; status: true; updatedAt: true };
          };
          events: {
            where?: { id: { in: string[] } };
            orderBy: { startsAt: "asc" };
            select: { id: true; name: true; startsAt: true };
          };
        };
      }): Promise<
        Array<{
          id: string;
          name: string;
          merchantAccounts: Array<{ id: string; status: "ACTIVE" | "DISABLED"; updatedAt: Date }>;
          events: Array<{ id: string; name: string; startsAt: Date }>;
        }>
      >;
    };
  };

  const clients = await clientReader.client.findMany({
    where: scopedEventIds
      ? { events: { some: { id: { in: scopedEventIds } } } }
      : undefined,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      merchantAccounts: {
        where: { provider: "MERCADOPAGO" },
        take: 1,
        select: { id: true, status: true, updatedAt: true },
      },
      events: {
        where: scopedEventIds ? { id: { in: scopedEventIds } } : undefined,
        orderBy: { startsAt: "asc" },
        select: { id: true, name: true, startsAt: true },
      },
    },
  });

  /* ── Derived stats ── */
  const totalConnected = clients.filter((c) => c.merchantAccounts[0]?.status === "ACTIVE").length;
  const totalWithEvents = clients.filter((c) => c.events.length > 0).length;
  const totalPending = clients.filter((c) => !c.merchantAccounts[0]).length;

  const chips = [
    { label: "Total",         value: clients.length,    color: "text-primary" },
    { label: "MP conectado",  value: totalConnected,     color: "text-success-700" },
    { label: "Con eventos",   value: totalWithEvents,    color: "text-[color:var(--brand-violet)]" },
    { label: "Sin merchant",  value: totalPending,       color: "text-warning-700" },
  ];

  return (
    <>
      <style>{PAGE_STYLES}</style>

      <div className="space-y-0">

        {/* ── HERO BAR ── bare div, 1px border-bottom, no wrapping panel ── */}
        <div
          className="cl-hero flex flex-wrap items-start justify-between gap-4 pb-5"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--brand-violet)" }}
            >
              MERCHANTS
            </p>
            <h1 className="mt-1 font-display text-[1.625rem] font-extrabold leading-tight tracking-tight text-primary">
              Clientes / Merchants<span style={{ color: "var(--brand-magenta)" }}>.</span>
            </h1>
            <p className="mt-1 text-[12px] text-secondary">
              <span className="font-medium text-primary">{clients.length}</span> clientes
              {" · "}
              <span className="font-medium text-primary">{totalConnected}</span> con MP conectado
            </p>
          </div>

          {viewer.role === "ADMIN" && (
            <div className="flex items-center gap-2 pt-0.5">
              <Link
                href="/admin/clients/new"
                className="inline-flex items-center gap-1.5 rounded-[7px] px-3.5 py-[6px] text-[12px] font-semibold text-white transition-opacity duration-[120ms] hover:opacity-90"
                style={{ background: "var(--grad-hero)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Nuevo cliente
              </Link>
            </div>
          )}
        </div>

        {/* ── KPI CHIP STRIP ── */}
        <div
          className="cl-chips flex flex-wrap items-stretch"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
          aria-label="Resumen de clientes"
        >
          {chips.map((chip) => (
            <div key={chip.label} className="cl-chip">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">
                {chip.label}
              </span>
              <span
                className={`mt-0.5 font-display text-[1.25rem] font-extrabold leading-none tracking-tight ${chip.color}`}
              >
                {chip.value}
              </span>
            </div>
          ))}
        </div>

        {/* ── FILTERS ROW ── */}
        <div
          className="cl-filters flex flex-wrap items-center gap-2 py-3"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div className="relative flex items-center">
            <svg
              className="pointer-events-none absolute left-2.5 h-[13px] w-[13px] text-muted"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Buscar cliente…"
              className="rounded-[7px] border py-[5px] pl-8 pr-3 text-[12px] text-primary placeholder:text-muted outline-none transition-[border-color] duration-[120ms] focus:border-[color:var(--border-focus)]"
              style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-surface)", width: "200px" }}
              disabled
              aria-label="Buscar clientes"
            />
          </div>
          <div className="ml-auto text-[11px] text-secondary">
            <span className="font-medium text-primary">{clients.length}</span> resultados
          </div>
        </div>

        {/* ── TABLE ── */}
        {clients.length === 0 ? (
          <div className="cl-table flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[13px] font-semibold text-primary">Sin clientes todavía</p>
            <p className="mt-1 text-[11px] text-secondary max-w-xs">
              No hay clientes visibles. Una vez creados, aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="cl-table overflow-x-auto">
            <table className="min-w-full" style={{ fontSize: "13px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--bg-sunken)", borderBottom: "1px solid var(--border-soft)" }}>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                    Nombre
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                    MP Estado
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                    Eventos activos
                  </th>
                  <th className="whitespace-nowrap hidden px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.11em] text-secondary sm:table-cell">
                    Última actualización
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client, idx) => {
                  const merchant = client.merchantAccounts[0] ?? null;
                  const mpStatus = merchant?.status ?? null;
                  const initials = getInitials(client.name);

                  return (
                    <tr
                      key={client.id}
                      className="cl-row cl-tr"
                      style={{ borderBottom: "1px solid var(--border-soft)" }}
                    >
                      {/* Nombre — monogram + name */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`cl-monogram bg-gradient-to-br ${getAvatarGradient(idx)}`}
                            aria-hidden="true"
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-primary max-w-[180px]">
                              {client.name}
                            </p>
                            <p className="text-[11px] text-muted">
                              {client.id.slice(0, 8)}…
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* MP Estado */}
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${getMpStatusPill(mpStatus)}`}
                        >
                          {mpStatus === "ACTIVE" && (
                            <span className="cl-dot-active h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
                          )}
                          {getMpStatusLabel(mpStatus)}
                        </span>
                      </td>

                      {/* Eventos */}
                      <td className="px-3 py-2 text-right">
                        <span className="font-display text-[13px] font-bold tabular-nums text-primary">
                          {client.events.length}
                        </span>
                      </td>

                      {/* Última actualización */}
                      <td className="hidden px-3 py-2 text-right text-[11px] text-muted sm:table-cell">
                        {merchant?.updatedAt
                          ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(merchant.updatedAt)
                          : "—"}
                      </td>

                      {/* Acciones — icon-only */}
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          {/* Ver / perfil */}
                          <Link
                            href={`/admin/clients/${client.id}/merchant`}
                            className="cl-action-btn"
                            data-tip="Ver merchant"
                            aria-label="Ver merchant"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </Link>

                          {/* Editar merchant */}
                          <Link
                            href={`/admin/clients/${client.id}/merchant`}
                            className="cl-action-btn"
                            data-tip="Editar merchant"
                            aria-label="Editar merchant"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="2" y="5" width="20" height="14" rx="2" />
                              <line x1="2" y1="10" x2="22" y2="10" />
                            </svg>
                          </Link>

                          {/* Ver liquidaciones */}
                          <Link
                            href={`/admin/clients/${client.id}/liquidations`}
                            className="cl-action-btn"
                            data-tip="Ver liquidaciones"
                            aria-label="Ver liquidaciones"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <path d="M3 9h18M9 21V9" />
                            </svg>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Footer count */}
            {clients.length > 0 && (
              <div
                className="flex items-center px-3 py-2.5"
                style={{ borderTop: "1px solid var(--border-soft)" }}
              >
                <span className="text-[11px] text-muted">
                  <span className="font-medium text-secondary">{clients.length}</span> clientes
                </span>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
}
