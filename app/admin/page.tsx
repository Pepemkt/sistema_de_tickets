import Link from "next/link";
import { db } from "@/lib/db";
import { getOrderKindBadgeClass, getOrderKindLabel, ORDER_KIND } from "@/lib/order-kind";
import { centsToCurrency } from "@/lib/utils";
import { requirePageRole } from "@/lib/auth";
import { getScopedEventIdsForViewer } from "@/lib/event-scope";

/* ─────────────────────────────────────────────────────────────────────────────
   CSS-ONLY ANIMATIONS — server-safe (no "use client")
───────────────────────────────────────────────────────────────────────────── */
const PAGE_STYLES = `
@keyframes db-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes db-stat-in {
  from { opacity: 0; transform: translateY(8px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes db-row-in {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes db-pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.55; transform: scale(0.85); }
}

.db-hero   { animation: db-fade-up 0.5s var(--ease-tactile) 0.02s both; }
.db-kpis   { animation: db-fade-up 0.5s var(--ease-tactile) 0.10s both; }
.db-orders { animation: db-fade-up 0.5s var(--ease-tactile) 0.18s both; }
.db-users  { animation: db-fade-up 0.5s var(--ease-tactile) 0.24s both; }

.db-kpi {
  animation: db-stat-in 0.48s var(--ease-spring) both;
  transition: box-shadow 0.18s var(--ease-tactile), border-color 0.15s ease;
}
.db-kpi:nth-child(1) { animation-delay: 0.12s; }
.db-kpi:nth-child(2) { animation-delay: 0.16s; }
.db-kpi:nth-child(3) { animation-delay: 0.20s; }
.db-kpi:nth-child(4) { animation-delay: 0.24s; }
.db-kpi:nth-child(5) { animation-delay: 0.28s; }
.db-kpi:nth-child(6) { animation-delay: 0.32s; }
.db-kpi:nth-child(7) { animation-delay: 0.36s; }

.db-kpi:hover {
  box-shadow: 0 4px 16px rgba(21,22,43,0.10);
  border-color: var(--border-strong);
}

.db-row { animation: db-row-in 0.38s var(--ease-tactile) both; }
.db-row:nth-child(1) { animation-delay: 0.22s; }
.db-row:nth-child(2) { animation-delay: 0.26s; }
.db-row:nth-child(3) { animation-delay: 0.30s; }
.db-row:nth-child(4) { animation-delay: 0.34s; }
.db-row:nth-child(5) { animation-delay: 0.38s; }
.db-row:nth-child(6) { animation-delay: 0.42s; }
.db-row:nth-child(7) { animation-delay: 0.46s; }
.db-row:nth-child(8) { animation-delay: 0.50s; }

.db-urow { animation: db-row-in 0.38s var(--ease-tactile) both; }
.db-urow:nth-child(1) { animation-delay: 0.28s; }
.db-urow:nth-child(2) { animation-delay: 0.32s; }
.db-urow:nth-child(3) { animation-delay: 0.36s; }
.db-urow:nth-child(4) { animation-delay: 0.40s; }
.db-urow:nth-child(5) { animation-delay: 0.44s; }
.db-urow:nth-child(6) { animation-delay: 0.48s; }
.db-urow:nth-child(7) { animation-delay: 0.52s; }
.db-urow:nth-child(8) { animation-delay: 0.56s; }

.db-dot-active { animation: db-pulse-dot 2s ease-in-out infinite; }

/* Revenue KPI: only this one gets the gradient text */
.db-revenue-num {
  background: var(--grad-hero);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Table row hover — bg-sunken tint */
.db-trow { transition: background-color 0.11s ease; cursor: default; }
.db-trow:hover { background-color: var(--bg-sunken); }

/* KPI top accent bars */
.kpi-accent-grad::before {
  content: '';
  display: block;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--grad-hero);
  margin: -14px -16px 10px;
}
.kpi-accent-green::before {
  content: '';
  display: block;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--clr-success-500);
  margin: -14px -16px 10px;
}
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
   ROLE + AVATAR HELPERS
───────────────────────────────────────────────────────────────────────────── */
const ROLE_LABEL: Record<string, string> = {
  ADMIN:   "Admin",
  MANAGER: "Manager",
  SELLER:  "Vendedor",
  SCANNER: "Scanner",
};

function getRolePillClass(role: string): string {
  if (role === "ADMIN")   return "bg-[rgba(109,40,217,0.07)] text-[color:var(--brand-violet)] border-[rgba(109,40,217,0.18)]";
  if (role === "MANAGER") return "bg-[rgba(59,130,246,0.08)] text-blue-700 border-blue-200";
  return "bg-sunken text-secondary border-[color:var(--border-soft)]";
}

function getAvatarGradient(index: number): string {
  const grads = [
    "from-forest-600 to-forest-400",
    "from-coral-500 to-coral-300",
    "from-forest-500 to-coral-500",
    "from-forest-700 to-forest-500",
    "from-coral-700 to-coral-400",
  ];
  return grads[index % grads.length];
}

/* ─────────────────────────────────────────────────────────────────────────────
   EMPTY STATES
───────────────────────────────────────────────────────────────────────────── */
function EmptyOrders() {
  return (
    <tr>
      <td colSpan={5} className="px-4 py-10 text-center">
        <p className="text-[13px] font-semibold text-primary">Sin órdenes todavía</p>
        <p className="mt-1 text-[11px] text-secondary">Las órdenes aparecerán aquí cuando se generen.</p>
      </td>
    </tr>
  );
}

function EmptyUsers() {
  return (
    <tr>
      <td colSpan={3} className="px-4 py-8 text-center">
        <p className="text-[13px] font-semibold text-primary">Sin usuarios</p>
        <p className="mt-1 text-[11px] text-secondary">Cuando crees usuarios aparecerán aquí.</p>
      </td>
    </tr>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────────────────────── */
export default async function AdminDashboardPage() {
  const viewer = await requirePageRole(["ADMIN", "MANAGER"]);
  const scopedEventIds = await getScopedEventIdsForViewer(viewer);
  const eventWhere = scopedEventIds ? { id: { in: scopedEventIds } } : undefined;
  const orderWhere = scopedEventIds ? { eventId: { in: scopedEventIds } } : undefined;
  const commercialOrderWhere = { ...(orderWhere ?? {}), kind: { not: ORDER_KIND.INVITATION } };

  const [
    totalEvents,
    totalOrders,
    invitationOrders,
    commercialOrders,
    paidOrders,
    totalTickets,
    attendedTickets,
    paidRevenue,
    recentOrders,
  ] = await Promise.all([
    db.event.count({ where: eventWhere }),
    db.order.count({ where: orderWhere }),
    db.order.count({ where: { ...(orderWhere ?? {}), kind: ORDER_KIND.INVITATION } }),
    db.order.count({ where: commercialOrderWhere }),
    db.order.count({ where: { ...commercialOrderWhere, status: "PAID" } }),
    db.ticket.count({ where: orderWhere ? { eventId: { in: scopedEventIds ?? [] } } : undefined }),
    db.ticket.count({ where: { ...(orderWhere ? { eventId: { in: scopedEventIds ?? [] } } : {}), NOT: { attendedAt: null } } }),
    db.order.aggregate({
      where: { ...commercialOrderWhere, status: "PAID" },
      _sum: { totalCents: true },
    }),
    db.order.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      where: orderWhere,
      include: {
        event: { select: { name: true } },
        ticketType: { select: { name: true } },
      },
    }),
  ]);

  const isAdmin = viewer.role === "ADMIN";
  const activeUsers = isAdmin ? await db.user.count({ where: { isActive: true } }) : 0;
  const recentUsers = isAdmin
    ? await db.user.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      })
    : [];

  const totalRevenueCents = paidRevenue._sum.totalCents ?? 0;
  const attendanceRate = totalTickets > 0 ? Math.round((attendedTickets / totalTickets) * 100) : 0;
  const paidRate = commercialOrders > 0 ? Math.round((paidOrders / commercialOrders) * 100) : 0;

  const viewerName = (viewer as { displayName?: string | null; username?: string }).displayName
    ?? (viewer as { username?: string }).username
    ?? "Panel";

  /* ── TIMESTAMP ── */
  const nowLabel = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const nowFormatted = nowLabel.charAt(0).toUpperCase() + nowLabel.slice(1);

  /* ── KPI DATA ── */
  type KpiAccent = "grad" | "green" | "none";
  type KpiColor  = "grad" | "green" | "magenta" | "default";

  const kpis: Array<{
    label: string;
    value: string | number;
    sub?: string;
    accent: KpiAccent;
    color: KpiColor;
  }> = [
    { label: "Eventos",       value: totalEvents,                          accent: "none",  color: "default" },
    { label: "Órdenes",       value: totalOrders,                          accent: "none",  color: "default" },
    { label: "Ventas pagadas",value: paidOrders, sub: `${paidRate}% conv.`,accent: "green", color: "green"   },
    { label: "Invitaciones",  value: invitationOrders,                     accent: "none",  color: "magenta" },
    { label: "Ingresos",      value: centsToCurrency(totalRevenueCents),   accent: "grad",  color: "grad"    },
    { label: "Tickets",       value: totalTickets,                         accent: "none",  color: "default" },
    { label: "Asistencia",    value: `${attendanceRate}%`, sub: `${attendedTickets} / ${totalTickets}`, accent: "none", color: "default" },
  ];

  return (
    <>
      <style>{PAGE_STYLES}</style>

      <div className="space-y-6">

        {/* ── PAGE HERO ────────────────────────────────────────────────────────
            Bare div with a 1px bottom border. No card/panel wrapping.
        ────────────────────────────────────────────────────────────────────── */}
        <div
          className="db-hero flex flex-wrap items-start justify-between gap-4 pb-5"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          {/* Left: eyebrow + title + sub */}
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--brand-magenta)" }}
            >
              Dashboard
            </p>
            <h1 className="mt-1 font-display text-[1.625rem] font-extrabold leading-tight tracking-tight text-primary">
              Hola, {viewerName}<span style={{ color: "var(--brand-magenta)" }}>.</span>
            </h1>
            <p className="mt-1 text-[12px] text-secondary">
              {isAdmin ? "Vista completa del sistema" : "Vista de tu ámbito de gestión"}
              {" · "}
              {nowFormatted}
            </p>
          </div>

          {/* Right: compact action buttons */}
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
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-1.5 rounded-[7px] border px-3.5 py-[5px] text-[12px] font-medium text-secondary transition-colors duration-[120ms] hover:border-[color:var(--border-strong)] hover:text-primary"
              style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-surface)" }}
            >
              Ver órdenes
            </Link>
          </div>
        </div>

        {/* ── KPI ROW — 7 compact cards ─────────────────────────────────────── */}
        <div
          className="db-kpis grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
          aria-label="Métricas del panel"
        >
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className={`db-kpi rounded-[10px] border border-[color:var(--border-soft)] px-4 pb-3.5 pt-3 shadow-[var(--shadow-xs)] ${
                kpi.accent === "grad"  ? "kpi-accent-grad"  :
                kpi.accent === "green" ? "kpi-accent-green" : ""
              }`}
              style={{ backgroundColor: "var(--bg-surface)" }}
            >
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">
                {kpi.label}
              </p>
              <p
                className={`font-display text-[1.5rem] font-extrabold leading-none tracking-tight ${
                  kpi.color === "grad"    ? "db-revenue-num"                              :
                  kpi.color === "green"  ? "text-success-700"                            :
                  kpi.color === "magenta"? ""                                             :
                  "text-primary"
                }`}
                style={kpi.color === "magenta" ? { color: "var(--brand-magenta)" } : undefined}
              >
                {kpi.value}
              </p>
              {kpi.sub && (
                <p className="mt-1 text-[11px] text-secondary">{kpi.sub}</p>
              )}
            </div>
          ))}
        </div>

        {/* ── LOWER GRID — orders + users ───────────────────────────────────── */}
        <div
          className={`grid gap-5 ${isAdmin ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}
          aria-label="Actividad reciente"
        >

          {/* ORDERS SURFACE */}
          <div
            className="db-orders overflow-hidden rounded-[10px] border border-[color:var(--border-soft)] shadow-[var(--shadow-xs)]"
            style={{ backgroundColor: "var(--bg-surface)" }}
          >
            {/* Section header */}
            <div
              className="flex items-center justify-between px-[18px] py-[13px]"
              style={{ borderBottom: "1px solid var(--border-soft)" }}
            >
              <div>
                <p className="font-display text-[14px] font-bold text-primary">Actividad de órdenes</p>
                <p className="mt-0.5 text-[11px] text-secondary">
                  Últimas {recentOrders.length} órdenes registradas
                </p>
              </div>
              <Link
                href="/admin/orders"
                className="inline-flex items-center gap-1 rounded-[6px] border px-2.5 py-1 text-[11px] font-medium text-secondary transition-colors duration-[120ms] hover:border-[color:var(--border-strong)] hover:text-primary"
                style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-surface)" }}
              >
                Ver todas
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            </div>

            {/* Dense table */}
            <div className="overflow-x-auto">
              <table className="min-w-full" style={{ fontSize: "13px", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--bg-sunken)", borderBottom: "1px solid var(--border-soft)" }}>
                    <th className="px-[14px] py-2 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-secondary whitespace-nowrap">
                      Evento
                    </th>
                    <th className="hidden px-[14px] py-2 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-secondary whitespace-nowrap sm:table-cell">
                      Canal
                    </th>
                    <th className="px-[14px] py-2 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-secondary whitespace-nowrap">
                      Estado
                    </th>
                    <th className="px-[14px] py-2 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-secondary whitespace-nowrap">
                      Total
                    </th>
                    <th className="hidden px-[14px] py-2 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-secondary whitespace-nowrap lg:table-cell">
                      Fecha
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.length === 0
                    ? <EmptyOrders />
                    : recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="db-row db-trow"
                        style={{ borderBottom: "1px solid var(--border-soft)" }}
                      >
                        {/* Evento */}
                        <td className="px-[14px] py-2 text-[13px] font-semibold text-primary">
                          <p className="max-w-[160px] truncate">{order.event.name}</p>
                        </td>
                        {/* Canal */}
                        <td className="hidden px-[14px] py-2 sm:table-cell">
                          <span className={`badge ${getOrderKindBadgeClass(order.kind)}`}>
                            {getOrderKindLabel(order.kind)}
                          </span>
                        </td>
                        {/* Estado */}
                        <td className="px-[14px] py-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${getStatusPillClass(order.status)}`}
                          >
                            {order.status === "PAID" && (
                              <span
                                className="db-dot-active h-1.5 w-1.5 rounded-full bg-success-500"
                                aria-hidden="true"
                              />
                            )}
                            {getStatusLabel(order.status)}
                          </span>
                        </td>
                        {/* Total */}
                        <td className="px-[14px] py-2 text-right">
                          <span className="font-display text-[13px] font-bold tabular-nums text-primary">
                            {centsToCurrency(order.totalCents)}
                          </span>
                        </td>
                        {/* Fecha */}
                        <td className="hidden px-[14px] py-2 text-right text-[11px] text-secondary lg:table-cell">
                          {new Intl.DateTimeFormat("es-AR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(order.createdAt)}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>

          {/* USERS SURFACE — admin only */}
          {isAdmin && (
            <div
              className="db-users overflow-hidden rounded-[10px] border border-[color:var(--border-soft)] shadow-[var(--shadow-xs)]"
              style={{ backgroundColor: "var(--bg-surface)" }}
            >
              {/* Section header */}
              <div
                className="flex items-center justify-between px-[18px] py-[13px]"
                style={{ borderBottom: "1px solid var(--border-soft)" }}
              >
                <div>
                  <p className="font-display text-[14px] font-bold text-primary">Usuarios del panel</p>
                  <p className="mt-0.5 text-[11px] text-secondary">
                    <span
                      className="mr-1 inline-flex items-center gap-1 rounded-full border bg-success-50 px-2 py-0.5 text-[10px] font-bold text-success-700 border-success-500/30"
                    >
                      <span className="db-dot-active h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
                      {activeUsers} activo{activeUsers !== 1 ? "s" : ""}
                    </span>
                    en el sistema
                  </p>
                </div>
                <Link
                  href="/admin/users"
                  className="inline-flex items-center gap-1 rounded-[6px] border px-2.5 py-1 text-[11px] font-medium text-secondary transition-colors duration-[120ms] hover:border-[color:var(--border-strong)] hover:text-primary"
                  style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-surface)" }}
                >
                  Gestionar
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              </div>

              {/* Dense user table */}
              <div className="overflow-x-auto">
                <table className="min-w-full" style={{ fontSize: "13px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "var(--bg-sunken)", borderBottom: "1px solid var(--border-soft)" }}>
                      <th className="px-[14px] py-2 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">
                        Usuario
                      </th>
                      <th className="px-[14px] py-2 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">
                        Rol
                      </th>
                      <th className="px-[14px] py-2 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsers.length === 0
                      ? <EmptyUsers />
                      : recentUsers.map((user, idx) => {
                          const name = user.displayName ?? user.username;
                          const initials = name
                            .split(" ")
                            .map((p) => p[0] ?? "")
                            .slice(0, 2)
                            .join("")
                            .toUpperCase();

                          return (
                            <tr
                              key={user.id}
                              className="db-urow db-trow"
                              style={{ borderBottom: "1px solid var(--border-soft)" }}
                            >
                              {/* Avatar + name */}
                              <td className="px-[14px] py-2">
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(idx)} text-[11px] font-extrabold text-white select-none`}
                                    aria-hidden="true"
                                  >
                                    {initials}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-[13px] font-semibold text-primary">{name}</p>
                                    <p className="truncate text-[11px] text-secondary">@{user.username}</p>
                                  </div>
                                </div>
                              </td>
                              {/* Role pill */}
                              <td className="px-[14px] py-2">
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${getRolePillClass(user.role)}`}
                                >
                                  {ROLE_LABEL[user.role] ?? user.role}
                                </span>
                              </td>
                              {/* Status pill */}
                              <td className="px-[14px] py-2">
                                {user.isActive ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border bg-success-50 px-2 py-0.5 text-[11px] font-bold text-success-700 border-success-500/30">
                                    <span className="db-dot-active h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
                                    Activo
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full border bg-warning-50 px-2 py-0.5 text-[11px] font-bold text-warning-700 border-warning-500/30">
                                    Inactivo
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
