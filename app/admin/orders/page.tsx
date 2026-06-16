import Link from "next/link";
import { db } from "@/lib/db";
import { getOrderKindBadgeClass, getOrderKindLabel, isCommercialOrderKind, ORDER_KIND } from "@/lib/order-kind";
import { centsToCurrency } from "@/lib/utils";
import { DeleteOrderButton } from "@/components/delete-order-button";
import { requirePageRole } from "@/lib/auth";
import { getScopedEventIdsForViewer } from "@/lib/event-scope";

/* ─────────────────────────────────────────────────────────────────────────────
   CSS-ONLY — server component safe
───────────────────────────────────────────────────────────────────────────── */
const PAGE_STYLES = `
@keyframes ord-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ord-row-in {
  from { opacity: 0; transform: translateX(-4px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes ord-pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.8); }
}

.ord-hero    { animation: ord-fade-up 0.48s var(--ease-tactile) 0.02s both; }
.ord-chips   { animation: ord-fade-up 0.48s var(--ease-tactile) 0.08s both; }
.ord-filters { animation: ord-fade-up 0.48s var(--ease-tactile) 0.14s both; }
.ord-table   { animation: ord-fade-up 0.48s var(--ease-tactile) 0.20s both; }

/* Table rows staggered */
.ord-row { animation: ord-row-in 0.34s var(--ease-tactile) both; }
.ord-row:nth-child(1)  { animation-delay: 0.24s; }
.ord-row:nth-child(2)  { animation-delay: 0.27s; }
.ord-row:nth-child(3)  { animation-delay: 0.30s; }
.ord-row:nth-child(4)  { animation-delay: 0.33s; }
.ord-row:nth-child(5)  { animation-delay: 0.36s; }
.ord-row:nth-child(6)  { animation-delay: 0.39s; }
.ord-row:nth-child(7)  { animation-delay: 0.42s; }
.ord-row:nth-child(8)  { animation-delay: 0.45s; }
.ord-row:nth-child(9)  { animation-delay: 0.48s; }
.ord-row:nth-child(10) { animation-delay: 0.51s; }

/* Row hover */
.ord-tr { transition: background-color 0.10s ease; }
.ord-tr:hover { background-color: var(--bg-sunken); }

/* Pulse dot */
.ord-dot-pulse { animation: ord-pulse-dot 2s ease-in-out infinite; }

/* Order ID monospace chip */
.ord-id {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.03em;
  color: var(--text-muted);
}

/* Tabular numbers */
.ord-num {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}

/* ── ICON-ACTION BUTTONS with ::after tooltip ────────────────────────────── */
.ord-action-btn {
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
}
.ord-action-btn:hover {
  background-color: var(--bg-sunken);
  color: var(--text-primary);
}
.ord-action-btn::after {
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
.ord-action-btn:hover::after { opacity: 1; }

/* ── KPI CHIPS — tight inline strip ─────────────────────────────────────── */
.ord-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 8px 14px;
  border-right: 1px solid var(--border-soft);
  min-width: 80px;
}
.ord-chip:last-child { border-right: none; }
`;

/* ─────────────────────────────────────────────────────────────────────────────
   STATUS HELPERS
───────────────────────────────────────────────────────────────────────────── */
const STATUS_LABEL: Record<string, string> = {
  PAID:      "Pagada",
  PENDING:   "Pendiente",
  CANCELLED: "Cancelada",
  REJECTED:  "Rechazada",
  EXPIRED:   "Expirada",
};

function getStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

function getStatusPillClass(status: string): string {
  if (status === "PAID")    return "bg-success-50 text-success-700 border-success-500/30";
  if (status === "PENDING") return "bg-warning-50 text-warning-700 border-warning-500/30";
  return "bg-danger-50 text-danger-700 border-danger-500/30";
}

/* ─────────────────────────────────────────────────────────────────────────────
   RELATIVE DATE HELPER
───────────────────────────────────────────────────────────────────────────── */
function relativeDate(date: Date): string {
  const now   = Date.now();
  const diff  = now - date.getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "ahora";
  if (mins < 60)  return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 7)   return `hace ${days}d`;
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(date);
}

function fullDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────────────────────── */
export default async function AdminOrdersPage() {
  const viewer = await requirePageRole(["ADMIN", "MANAGER"]);
  const scopedEventIds = await getScopedEventIdsForViewer(viewer);
  const visibleEvents = await db.event.findMany({
    where: scopedEventIds ? { id: { in: scopedEventIds } } : undefined,
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      name: true
    }
  });

  const orders = await db.order.findMany({
    where: scopedEventIds ? { eventId: { in: scopedEventIds } } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      event: true,
      ticketType: true,
      emailDeliveries: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      tickets: {
        select: {
          id: true,
          attendedAt: true,
        },
      },
    },
    take: 200,
  });

  const paidOrders       = orders.filter((o) => o.status === "PAID" && isCommercialOrderKind(o.kind));
  const invitationOrders = orders.filter((o) => o.kind === ORDER_KIND.INVITATION);
  const pendingOrders    = orders.filter((o) => o.status === "PENDING");
  const cancelledOrders  = orders.filter((o) => o.status === "CANCELLED");
  const revenue          = paidOrders.reduce((s, o) => s + o.totalCents, 0);
  const totalTickets     = orders.reduce((s, o) => s + o.tickets.length, 0);

  /* ── KPI CHIPS DATA ── */
  const chips = [
    { label: "Total",        value: orders.length,           color: "text-primary"                },
    { label: "Pagadas",      value: paidOrders.length,       color: "text-success-700"            },
    { label: "Pendientes",   value: pendingOrders.length,    color: "text-warning-700"            },
    { label: "Invitaciones", value: invitationOrders.length, color: "text-[color:var(--brand-magenta)]" },
    { label: "Canceladas",   value: cancelledOrders.length,  color: "text-danger-700"             },
    { label: "Ingresos",     value: centsToCurrency(revenue), color: "ord-num text-primary"       },
  ];

  return (
    <>
      <style>{PAGE_STYLES}</style>

      <div className="space-y-0">

        {/* ── HERO BAR ─────────────────────────────────────────────────────────
            Bare div, no card wrapping. 1px border-bottom divider.
        ──────────────────────────────────────────────────────────────────────── */}
        <div
          className="ord-hero flex flex-wrap items-start justify-between gap-4 pb-5"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--brand-violet)" }}
            >
              ÓRDENES
            </p>
            <h1 className="mt-1 font-display text-[1.625rem] font-extrabold leading-tight tracking-tight text-primary">
              Órdenes<span style={{ color: "var(--brand-magenta)" }}>.</span>
            </h1>
            <p className="mt-1 text-[12px] text-secondary">
              {orders.length > 0 ? (
                <>
                  <span className="font-medium text-primary">{orders.length}</span>
                  {" órdenes totales · "}
                  <span className="font-medium text-primary">{centsToCurrency(revenue)}</span>
                  {" facturado"}
                  {totalTickets > 0 && <> · <span className="font-medium text-primary">{totalTickets}</span> tickets emitidos</>}
                </>
              ) : "Sin órdenes registradas aún."}
            </p>
          </div>

          {/* Right: ghost export action */}
          <div className="flex items-center gap-2 pt-0.5">
            <form action="/api/admin/orders/export" method="get" className="flex items-center gap-2">
              <select
                name="eventId"
                className="rounded-[7px] border py-[5px] px-2.5 text-[12px] text-secondary outline-none transition-[border-color] duration-[120ms] hover:border-[color:var(--border-strong)] focus:border-[color:var(--border-focus)]"
                style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-surface)", minWidth: "180px" }}
                defaultValue={visibleEvents[0]?.id ?? ""}
                aria-label="Seleccionar evento para exportar"
              >
                {visibleEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-[7px] border px-3 py-[5px] text-[12px] font-medium text-secondary transition-colors duration-[120ms] hover:border-[color:var(--border-strong)] hover:text-primary"
                style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-surface)" }}
                title="Exportar órdenes CSV"
                disabled={visibleEvents.length === 0}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
                Exportar CSV
              </button>
            </form>
            <Link
              href="/admin/events"
              className="inline-flex items-center gap-1.5 rounded-[7px] border px-3 py-[5px] text-[12px] font-medium text-secondary transition-colors duration-[120ms] hover:border-[color:var(--border-strong)] hover:text-primary"
              style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-surface)" }}
              title="Ver eventos"
            >
              {/* arrow-left icon */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Eventos
            </Link>
          </div>
        </div>

        {/* ── KPI CHIPS ROW ────────────────────────────────────────────────────
            Tight horizontal strip, no card wrapping, dividers between chips.
        ──────────────────────────────────────────────────────────────────────── */}
        <div
          className="ord-chips flex flex-wrap items-stretch"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
          aria-label="Resumen de órdenes"
        >
          {chips.map((chip) => (
            <div key={chip.label} className="ord-chip">
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

        {/* ── FILTERS ROW ──────────────────────────────────────────────────────
            Single inline row: search + dropdowns. Right: results count.
        ──────────────────────────────────────────────────────────────────────── */}
        <div
          className="ord-filters flex flex-wrap items-center gap-2 py-3"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          {/* Search input with leading icon */}
          <div className="relative flex items-center">
            <svg
              className="pointer-events-none absolute left-2.5 h-[13px] w-[13px] text-muted"
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
              placeholder="Buscar por email, orden…"
              className="rounded-[7px] border py-[5px] pl-8 pr-3 text-[12px] text-primary placeholder:text-muted outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[color:var(--border-focus)] focus:shadow-[var(--shadow-focus)]"
              style={{
                borderColor: "var(--border-soft)",
                backgroundColor: "var(--bg-surface)",
                width: "200px",
              }}
              disabled
              aria-label="Buscar órdenes"
            />
          </div>

          {/* Status filter */}
          <select
            className="rounded-[7px] border py-[5px] px-2.5 text-[12px] text-secondary outline-none transition-[border-color] duration-[120ms] hover:border-[color:var(--border-strong)] focus:border-[color:var(--border-focus)]"
            style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-surface)" }}
            aria-label="Filtrar por estado"
          >
            <option>Todos los estados</option>
            <option>Pagada</option>
            <option>Pendiente</option>
            <option>Cancelada</option>
          </select>

          {/* Canal filter */}
          <select
            className="rounded-[7px] border py-[5px] px-2.5 text-[12px] text-secondary outline-none transition-[border-color] duration-[120ms] hover:border-[color:var(--border-strong)] focus:border-[color:var(--border-focus)]"
            style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-surface)" }}
            aria-label="Filtrar por canal"
          >
            <option>Todos los canales</option>
            <option>Online</option>
            <option>Manual</option>
            <option>Invitación</option>
          </select>

          {/* Spacer + results count right-aligned */}
          <div className="ml-auto text-[11px] text-secondary">
            <span className="font-medium text-primary">{orders.length}</span> resultados
          </div>
        </div>

        {/* ── ORDERS TABLE ─────────────────────────────────────────────────────
            No wrapping panel. Sits directly on page with subtle top border.
        ──────────────────────────────────────────────────────────────────────── */}
        <div className="ord-table overflow-x-auto">
          <table className="min-w-full" style={{ fontSize: "13px", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--bg-sunken)",
                  borderBottom: "1px solid var(--border-soft)",
                }}
              >
                <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                  Orden
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                  Comprador
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                  Evento
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                  Tipo
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                  Canal
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                  Estado
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                  Total
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                  Fecha
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-8 text-center text-[13px] text-muted"
                    style={{ borderBottom: "1px solid var(--border-soft)" }}
                  >
                    No hay órdenes con estos filtros.
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const attendedTickets    = order.tickets.filter((t) => t.attendedAt !== null).length;
                  const hasAttendedTickets = attendedTickets > 0;

                  return (
                    <tr
                      key={order.id}
                      className="ord-row ord-tr"
                      style={{ borderBottom: "1px solid var(--border-soft)" }}
                    >
                      {/* ID — monospace last-8 chars */}
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className="ord-id" title={order.id}>
                          …{order.id.slice(-8)}
                        </span>
                      </td>

                      {/* Comprador — name + email */}
                      <td className="px-3 py-2">
                        <p
                          className="max-w-[140px] truncate text-[13px] font-semibold text-primary"
                          title={order.buyerName ?? undefined}
                        >
                          {order.buyerName ?? "—"}
                        </p>
                        <p
                          className="max-w-[140px] truncate text-[11px] text-muted"
                          title={order.buyerEmail ?? undefined}
                        >
                          {order.buyerEmail ?? ""}
                        </p>
                      </td>

                      {/* Evento */}
                      <td className="px-3 py-2">
                        <p
                          className="max-w-[160px] truncate text-[13px] font-medium text-primary"
                          title={order.event.name}
                        >
                          {order.event.name}
                        </p>
                      </td>

                      {/* Tipo de ticket */}
                      <td className="px-3 py-2">
                        <p
                          className="max-w-[110px] truncate text-[12px] text-secondary"
                          title={order.ticketType.name}
                        >
                          {order.ticketType.name}
                        </p>
                      </td>

                      {/* Canal — kind pill */}
                      <td className="px-3 py-2">
                        <span className={`badge ${getOrderKindBadgeClass(order.kind)}`}>
                          {getOrderKindLabel(order.kind)}
                        </span>
                      </td>

                      {/* Estado — status pill */}
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] ${getStatusPillClass(order.status)}`}
                        >
                          {order.status === "PAID" && (
                            <span
                              className="ord-dot-pulse h-1.5 w-1.5 rounded-full bg-success-500"
                              aria-hidden="true"
                            />
                          )}
                          {getStatusLabel(order.status)}
                        </span>
                      </td>

                      {/* Total — tabular-nums, right-aligned */}
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <span className="ord-num font-display text-[13px] font-bold text-primary">
                          {centsToCurrency(order.totalCents)}
                        </span>
                      </td>

                      {/* Fecha — relative with full date on hover via title */}
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <span
                          className="text-[12px] text-muted"
                          title={fullDate(order.createdAt)}
                        >
                          {relativeDate(order.createdAt)}
                        </span>
                      </td>

                      {/* Acciones — icon-only with ::after tooltips */}
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          {/* Ver preview */}
                          {order.tickets.length > 0 ? (
                            <Link
                              href={`/admin/orders/${order.id}/preview`}
                              className="ord-action-btn"
                              data-tip="Ver preview"
                              aria-label="Ver preview de orden"
                            >
                              {/* Eye icon 16px */}
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </Link>
                          ) : (
                            <span
                              className="ord-action-btn opacity-30 cursor-not-allowed"
                              aria-label="Sin tickets generados"
                              title="Sin tickets"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </span>
                          )}

                          {/* Copiar ID */}
                          <button
                            className="ord-action-btn"
                            data-tip="Copiar ID"
                            aria-label="Copiar ID de orden"
                            type="button"
                            onClick={undefined}
                          >
                            {/* Clipboard icon 16px */}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>

                          {/* Delete — preserve existing server component */}
                          <DeleteOrderButton
                            orderId={order.id}
                            hasAttendedTickets={hasAttendedTickets}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination footer */}
          {orders.length > 0 && (
            <div
              className="flex items-center justify-between px-3 py-2.5"
              style={{ borderTop: "1px solid var(--border-soft)" }}
            >
              <span className="text-[11px] text-muted">
                Mostrando <span className="font-medium text-secondary">{orders.length}</span> de {orders.length} órdenes
              </span>
              <div className="flex items-center gap-1">
                <button
                  className="rounded-[6px] border px-2.5 py-1 text-[11px] font-medium text-secondary transition-colors duration-[120ms] hover:border-[color:var(--border-strong)] hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-surface)" }}
                  disabled
                  type="button"
                >
                  ← Anterior
                </button>
                <span
                  className="rounded-[6px] border px-2.5 py-1 text-[11px] font-semibold text-primary"
                  style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-sunken)" }}
                >
                  1
                </span>
                <button
                  className="rounded-[6px] border px-2.5 py-1 text-[11px] font-medium text-secondary transition-colors duration-[120ms] hover:border-[color:var(--border-strong)] hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-surface)" }}
                  disabled
                  type="button"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
