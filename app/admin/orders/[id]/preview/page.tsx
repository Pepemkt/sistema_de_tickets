import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { getOrderKindBadgeClass, getOrderKindLabel } from "@/lib/order-kind";
import { normalizeRegistrationAnswers } from "@/lib/registration-fields";
import { centsToCurrency } from "@/lib/utils";
import { requireViewerEventAccess } from "@/lib/event-scope";

/* ─────────────────────────────────────────────────────────────────────────────
   CSS — server component safe (no "use client")
───────────────────────────────────────────────────────────────────────────── */
const PAGE_STYLES = `
@keyframes op-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes op-row-in {
  from { opacity: 0; transform: translateX(-4px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes op-stub-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes op-dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.78); }
}
@keyframes op-timeline-entry-in {
  from { opacity: 0; transform: translateX(-4px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* Hero */
.op-hero { animation: op-fade-up 0.48s var(--ease-tactile) 0.02s both; }

/* KPI strip */
.op-chips { animation: op-fade-up 0.48s var(--ease-tactile) 0.08s both; }

/* Main content */
.op-detail { animation: op-fade-up 0.48s var(--ease-tactile) 0.14s both; }

/* Staggered ticket stubs */
.op-stub { animation: op-stub-in 0.36s var(--ease-tactile) both; }
.op-stub:nth-child(1) { animation-delay: 0.24s; }
.op-stub:nth-child(2) { animation-delay: 0.28s; }
.op-stub:nth-child(3) { animation-delay: 0.32s; }
.op-stub:nth-child(4) { animation-delay: 0.36s; }
.op-stub:nth-child(5) { animation-delay: 0.40s; }
.op-stub:nth-child(6) { animation-delay: 0.44s; }

/* Timeline entries */
.op-timeline-entry { animation: op-timeline-entry-in 0.34s var(--ease-tactile) both; }
.op-timeline-entry:nth-child(1) { animation-delay: 0.26s; }
.op-timeline-entry:nth-child(2) { animation-delay: 0.30s; }
.op-timeline-entry:nth-child(3) { animation-delay: 0.34s; }
.op-timeline-entry:nth-child(4) { animation-delay: 0.38s; }
.op-timeline-entry:nth-child(5) { animation-delay: 0.42s; }
.op-timeline-entry:nth-child(6) { animation-delay: 0.46s; }

/* Pulse dot for PAID */
.op-dot-paid { animation: op-dot-pulse 2s ease-in-out infinite; }

/* Row hover */
.op-tr { transition: background-color 0.10s ease; }
.op-tr:hover { background-color: var(--bg-sunken); }

/* KPI chip strip */
.op-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 8px 14px;
  border-right: 1px solid var(--border-soft);
  min-width: 80px;
}
.op-chip:last-child { border-right: none; }

/* Section divider */
.op-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 0 14px;
  border-top: 1px solid var(--border-soft);
}
.op-divider:first-of-type {
  border-top: none;
  padding-top: 14px;
}
.op-divider-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--clr-arena-400);
  white-space: nowrap;
  font-family: var(--font-display);
}
.op-divider-line {
  flex: 1;
  height: 1px;
  background: var(--border-soft);
}

/* Mono chip */
.op-mono-chip {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.05em;
  background: var(--bg-sunken);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  padding: 2px 7px;
  color: var(--text-muted);
  display: inline-block;
}

/* QR chip */
.op-qr-chip {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.04em;
  background: var(--bg-sunken);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  padding: 3px 8px;
  color: var(--text-secondary);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* Perforation line with notch punches */
.op-perf {
  position: relative;
  overflow: visible;
}
.op-perf::before,
.op-perf::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  background: var(--bg-page);
  z-index: 2;
  border: 1px solid var(--border-soft);
}
.op-perf::before { left: -7px; }
.op-perf::after  { right: -7px; }

/* Revenue gradient text */
.op-revenue {
  background: var(--grad-hero);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Monogram avatar */
.op-monogram {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
  font-weight: 800;
  font-family: var(--font-display);
  color: #fff;
  letter-spacing: -0.01em;
  user-select: none;
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
   AVATAR COLOR
───────────────────────────────────────────────────────────────────────────── */
function getAvatarGradient(name: string): string {
  const code = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const opts = [
    "from-[#5B21B6] to-[#7C3AED]",
    "from-[#DB1E7A] to-[#EC4899]",
    "from-[#4C1D95] to-[#EC2A8A]",
    "from-[#1E40AF] to-[#3B82F6]",
    "from-[#065F46] to-[#10B981]",
  ];
  return opts[code % opts.length];
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────────────────────── */
type Props = {
  params: Promise<{ id: string }>;
};

export default async function OrderPreviewPage({ params }: Props) {
  const viewer = await requirePageRole(["ADMIN", "MANAGER"]);
  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      event: true,
      ticketType: true,
      emailDeliveries: {
        orderBy: { createdAt: "desc" },
        take: 20
      },
      tickets: true
    }
  });

  if (!order) notFound();
  await requireViewerEventAccess(viewer, order.eventId);

  /* ── Derived display values ── */
  const buyerInitials = (order.buyerName ?? "?")
    .split(" ")
    .map((p) => p[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const shortId = order.id.length > 12 ? "…" + order.id.slice(-12) : order.id;

  const sentDeliveries   = order.emailDeliveries.filter((d) => d.status === "SENT").length;
  const failedDeliveries = order.emailDeliveries.filter((d) => d.status !== "SENT").length;
  const registrationAnswers = normalizeRegistrationAnswers(order.registrationAnswersJson);

  /* ── KPI chips ── */
  const chips = [
    { label: "Total",    value: centsToCurrency(order.totalCents), color: "op-revenue" },
    { label: "Tipo",     value: order.ticketType.name,             color: "text-primary" },
    { label: "Cantidad", value: String(order.quantity),            color: "text-primary" },
    { label: "Emails",   value: `${sentDeliveries}/${order.emailDeliveries.length}`, color: sentDeliveries > 0 ? "text-success-700" : "text-muted" },
  ];

  return (
    <>
      <style>{PAGE_STYLES}</style>

      <div className="space-y-0">

        {/* ── HERO BAR — bare div, 1px border-bottom, no wrapping panel ── */}
        <div
          className="op-hero flex flex-wrap items-start justify-between gap-4 pb-5"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div>
            {/* Back link */}
            <Link
              href="/admin/orders"
              className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-secondary transition-colors duration-150 hover:text-primary"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Órdenes
            </Link>

            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--brand-violet)" }}
            >
              Orden
            </p>
            <h1 className="mt-1 font-display text-[1.625rem] font-extrabold leading-tight tracking-tight text-primary">
              {order.event.name}<span style={{ color: "var(--brand-magenta)" }}>.</span>
            </h1>
            <p className="mt-1 text-[12px] text-secondary flex flex-wrap items-center gap-2">
              <span className="op-mono-chip">{shortId}</span>
              {/* Status chip */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getStatusPillClass(order.status)}`}
              >
                {order.status === "PAID" && (
                  <span className="op-dot-paid h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
                )}
                {getStatusLabel(order.status)}
              </span>
              {/* Canal badge */}
              <span className={`badge ${getOrderKindBadgeClass(order.kind)}`}>
                {getOrderKindLabel(order.kind)}
              </span>
            </p>
          </div>

          {/* Right: total */}
          <div className="text-right pt-0.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-secondary">Total</p>
            <p className="mt-0.5 font-display text-[1.75rem] font-extrabold leading-none tracking-tight op-revenue">
              {centsToCurrency(order.totalCents)}
            </p>
          </div>
        </div>

        {/* ── KPI CHIP STRIP ── */}
        <div
          className="op-chips flex flex-wrap items-stretch"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
          aria-label="Resumen de orden"
        >
          {chips.map((chip) => (
            <div key={chip.label} className="op-chip">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">
                {chip.label}
              </span>
              <span className={`mt-0.5 font-display text-[1.1rem] font-extrabold leading-none tracking-tight ${chip.color}`}>
                {chip.value}
              </span>
            </div>
          ))}
        </div>

        {/* ── DETAIL SURFACE ── */}
        <div
          className="op-detail rounded-xl border border-[color:var(--border-soft)] bg-surface"
          style={{ padding: "0 20px" }}
        >

          {/* ── SECCIÓN: Cliente ── */}
          <div className="op-divider" style={{ borderTop: "none", paddingTop: 16 }}>
            <span className="op-divider-label">Cliente</span>
            <span className="op-divider-line" aria-hidden="true" />
          </div>

          <div className="grid gap-4 pb-4 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Nombre</p>
              <div className="mt-1.5 flex items-center gap-2">
                <div
                  className={`op-monogram bg-gradient-to-br text-[11px] ${getAvatarGradient(order.buyerName ?? "?")} h-8 w-8`}
                  aria-hidden="true"
                >
                  {buyerInitials}
                </div>
                <p className="text-[13px] font-semibold text-primary">{order.buyerName ?? "—"}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Email</p>
              <p
                className="mt-1 text-[12px] font-medium text-primary break-all"
                style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.02em" }}
              >
                {order.buyerEmail ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Teléfono</p>
              <p
                className="mt-1 text-[12px] font-medium text-primary"
                style={order.buyerPhone ? { fontFamily: "var(--font-mono)", letterSpacing: "0.03em" } : undefined}
              >
                {order.buyerPhone ?? "Sin teléfono"}
              </p>
            </div>
          </div>

          {registrationAnswers.length > 0 && (
            <>
              <div className="op-divider">
                <span className="op-divider-label">Campos de registro</span>
                <span className="op-divider-line" aria-hidden="true" />
              </div>

              <div className="grid gap-4 pb-4 sm:grid-cols-2 md:grid-cols-3">
                {registrationAnswers.map((answer) => (
                  <div key={answer.key}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">{answer.label}</p>
                    <p className="mt-1 text-[12px] font-medium text-primary">{answer.value || "—"}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── SECCIÓN: Compra ── */}
          <div className="op-divider">
            <span className="op-divider-label">Compra</span>
            <span className="op-divider-line" aria-hidden="true" />
          </div>

          <div className="grid gap-4 pb-4 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Evento</p>
              <p className="mt-1 truncate text-[12px] font-semibold text-primary">{order.event.name}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Tipo de entrada</p>
              <p className="mt-1 truncate text-[12px] font-semibold text-primary">{order.ticketType.name}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Cantidad</p>
              <p className="mt-1 font-display text-[1.1rem] font-extrabold text-primary">{order.quantity}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Canal</p>
              <div className="mt-1">
                <span className={`badge ${getOrderKindBadgeClass(order.kind)}`}>
                  {getOrderKindLabel(order.kind)}
                </span>
              </div>
            </div>
          </div>

          {/* ── SECCIÓN: Timeline de emails ── */}
          <div className="op-divider">
            <span className="op-divider-label">Envíos de email</span>
            <span className="op-divider-line" aria-hidden="true" />
            {order.emailDeliveries.length > 0 && (
              <span className="rounded-full border border-[color:var(--border-soft)] bg-sunken px-2.5 py-0.5 text-[10px] font-semibold text-secondary">
                {order.emailDeliveries.length}
              </span>
            )}
          </div>

          {order.emailDeliveries.length === 0 ? (
            <div className="flex items-center gap-2 pb-4 text-[12px] text-muted">
              <svg className="h-3.5 w-3.5 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="8" width="18" height="14" rx="5" />
                <path d="M3 13l8.5 5a2 2 0 0 0 1 0L21 13" />
              </svg>
              Aún no hay envíos registrados.
            </div>
          ) : (
            <div className="pb-4 space-y-0">
              {/* Summary pills */}
              <div className="mb-3 flex flex-wrap gap-2">
                {sentDeliveries > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-success-500/30 bg-success-50 px-2 py-0.5 text-[10px] font-bold text-success-700">
                    <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2 6.5L4.5 9l5.5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {sentDeliveries} enviado{sentDeliveries !== 1 ? "s" : ""}
                  </span>
                )}
                {failedDeliveries > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-danger-500/30 bg-danger-50 px-2 py-0.5 text-[10px] font-bold text-danger-700">
                    {failedDeliveries} error{failedDeliveries !== 1 ? "es" : ""}
                  </span>
                )}
              </div>

              {order.emailDeliveries.map((log, idx) => {
                const isSent = log.status === "SENT";
                const isLast = idx === order.emailDeliveries.length - 1;
                return (
                  <div
                    key={log.id}
                    className="op-timeline-entry relative flex gap-3 pb-4"
                  >
                    {/* Vertical line */}
                    {!isLast && (
                      <div
                        className="absolute left-[7px] top-6 bottom-0 w-px"
                        style={{ background: "var(--border-soft)" }}
                        aria-hidden="true"
                      />
                    )}
                    {/* Timeline dot */}
                    <div className="relative mt-0.5 shrink-0">
                      {isSent ? (
                        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-success-500 bg-success-50" aria-hidden="true">
                          <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                        </span>
                      ) : (
                        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-danger-500 bg-danger-50" aria-hidden="true">
                          <span className="h-1.5 w-1.5 rounded-full bg-danger-500" />
                        </span>
                      )}
                    </div>
                    {/* Entry content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className={`text-[12px] font-bold ${isSent ? "text-success-700" : "text-danger-700"}`}>
                          {isSent ? "Enviado" : "Falló"}
                        </span>
                        <span className="text-[10px] text-muted">
                          {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(log.createdAt)}
                        </span>
                      </div>
                      <p
                        className="mt-0.5 truncate text-[11px] text-secondary"
                        style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.02em" }}
                      >
                        {log.recipientEmail}
                      </p>
                      <span className="mt-1 inline-block rounded border border-[color:var(--border-soft)] bg-sunken px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                        {log.trigger}
                      </span>
                      {log.errorMessage && (
                        <div className="mt-1.5 rounded-lg border border-danger-500/25 bg-danger-50 px-3 py-2">
                          <p className="text-[11px] text-danger-700">{log.errorMessage}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── SECCIÓN: Tickets emitidos ── */}
          <div className="op-divider">
            <span className="op-divider-label">Entradas emitidas</span>
            <span className="op-divider-line" aria-hidden="true" />
            {order.tickets.length > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold"
                style={{
                  borderColor: "rgba(91,33,182,0.25)",
                  background: "rgba(91,33,182,0.05)",
                  color: "var(--brand-violet)",
                }}
              >
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" />
                </svg>
                {order.tickets.length} entrada{order.tickets.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {order.tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center pb-6">
              <p className="text-[13px] font-semibold text-muted">Sin entradas emitidas</p>
              <p className="mt-1 max-w-xs text-[11px] text-muted">
                Las entradas se generan cuando el pago es confirmado.
              </p>
            </div>
          ) : (
            <div className="pb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {order.tickets.map((ticket, idx) => {
                const attendeeInitials = (ticket.attendeeName ?? "?")
                  .split(" ")
                  .map((p) => p[0] ?? "")
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <article
                    key={ticket.id}
                    className="op-stub rounded-lg border border-[color:var(--border-soft)] bg-surface overflow-visible"
                    style={{ transition: "border-color 0.14s ease" }}
                  >
                    {/* Ticket header — clean surface, no dark band */}
                    <div
                      className="rounded-t-lg px-4 py-3"
                      style={{ background: "var(--bg-sunken)", borderBottom: "1px solid var(--border-soft)" }}
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Attendee avatar */}
                        <div
                          className={`op-monogram bg-gradient-to-br h-8 w-8 text-[11px] ${getAvatarGradient(ticket.attendeeName ?? "?")}`}
                          aria-hidden="true"
                        >
                          {attendeeInitials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold text-primary">
                            {ticket.attendeeName ?? "Sin nombre"}
                          </p>
                          <p
                            className="mt-0.5 truncate text-[10px] text-muted"
                            style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.02em" }}
                          >
                            {ticket.attendeeEmail ?? "—"}
                          </p>
                        </div>
                        {/* Number badge */}
                        <span
                          className="shrink-0 rounded-full border border-[color:var(--border-soft)] bg-surface px-2 py-0.5 text-[10px] font-bold text-secondary"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          #{idx + 1}
                        </span>
                      </div>
                    </div>

                    {/* Perforation line */}
                    <div
                      className="op-perf relative"
                      style={{ borderTop: "2px dashed var(--border-soft)", margin: 0 }}
                      aria-hidden="true"
                    />

                    {/* Ticket body */}
                    <div className="rounded-b-lg px-4 py-3">
                      <div className="space-y-2">
                        {/* Código */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-secondary">
                            Código
                          </span>
                          <span
                            className="rounded-md border border-[color:var(--border-strong)] bg-[color:var(--bg-sunken)] px-2.5 py-1 text-[11px] font-bold text-primary"
                            style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.07em" }}
                          >
                            {ticket.code}
                          </span>
                        </div>
                        {/* QR payload */}
                        <div>
                          <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-secondary">
                            QR payload
                          </span>
                          <span className="op-qr-chip" title={ticket.qrPayload}>
                            {ticket.qrPayload}
                          </span>
                        </div>
                      </div>
                      {/* PDF button */}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted">
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" />
                          </svg>
                          {order.ticketType.name}
                        </div>
                        <Link
                          href={`/api/admin/orders/${order.id}/ticket/${ticket.id}/pdf`}
                          target="_blank"
                          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition-colors duration-[120ms] hover:border-[color:var(--brand-magenta)]"
                          style={{
                            borderColor: "rgba(219,30,122,0.30)",
                            color: "var(--brand-magenta)",
                            background: "var(--clr-coral-50)",
                          }}
                        >
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Ver PDF
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

        </div>
        {/* /detail surface */}

      </div>
    </>
  );
}
