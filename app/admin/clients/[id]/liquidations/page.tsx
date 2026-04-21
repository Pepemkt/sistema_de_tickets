import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getScopedEventIdsForViewer, requireViewerClientAccess } from "@/lib/event-scope";
import { centsToCurrency } from "@/lib/utils";
import { LiquidationActions } from "@/components/liquidation-actions";
import { SummaryBox } from "@/components/ui";

/* ─────────────────────────────────────────────────────────────────────────────
   CSS — server-safe (no "use client")
───────────────────────────────────────────────────────────────────────────── */
const PAGE_STYLES = `
@keyframes clq-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes clq-row-in {
  from { opacity: 0; transform: translateX(-4px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes clq-dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.45; transform: scale(0.75); }
}

/* Page sections */
.clq-hero    { animation: clq-fade-up 0.48s var(--ease-tactile) 0.02s both; }
.clq-chips   { animation: clq-fade-up 0.48s var(--ease-tactile) 0.08s both; }
.clq-table   { animation: clq-fade-up 0.48s var(--ease-tactile) 0.16s both; }

/* KPI chip strip */
.clq-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 8px 14px;
  border-right: 1px solid var(--border-soft);
  min-width: 80px;
}
.clq-chip:last-child { border-right: none; }

/* Table */
.clq-tr { transition: background-color 0.10s ease; cursor: default; }
.clq-tr:hover { background-color: var(--bg-sunken); }

/* Row stagger */
.clq-row { animation: clq-row-in 0.34s var(--ease-tactile) both; }
.clq-row:nth-child(1)  { animation-delay: 0.20s; }
.clq-row:nth-child(2)  { animation-delay: 0.23s; }
.clq-row:nth-child(3)  { animation-delay: 0.26s; }
.clq-row:nth-child(4)  { animation-delay: 0.29s; }
.clq-row:nth-child(5)  { animation-delay: 0.32s; }
.clq-row:nth-child(6)  { animation-delay: 0.35s; }
.clq-row:nth-child(7)  { animation-delay: 0.38s; }
.clq-row:nth-child(8)  { animation-delay: 0.41s; }

/* Settled dot pulse */
.clq-dot-settled { animation: clq-dot-pulse 2.2s ease-in-out infinite; }

/* Tabular nums */
.clq-num {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
`;

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────────── */
type Props = {
  params: Promise<{ id: string }>;
};

type LiquidationStatus = "DRAFT" | "FINALIZED" | "SETTLED" | "CANCELLED";

type LiquidationRow = {
  id: string;
  status: LiquidationStatus;
  grossCents: number;
  commissionCents: number;
  netCents: number;
  commissionRateBpsSnapshot: number;
  createdAt: Date;
  settledAt: Date | null;
  eventId: string;
  event: { id: string; name: string } | null;
};

type ClientReader = {
  client: {
    findUnique(args: {
      where: { id: string };
      select: {
        id: true;
        name: true;
        liquidations: {
          where?: { eventId: { in: string[] } };
          orderBy: { createdAt: "desc" };
          select: {
            id: true;
            status: true;
            grossCents: true;
            commissionCents: true;
            netCents: true;
            commissionRateBpsSnapshot: true;
            createdAt: true;
            settledAt: true;
            eventId: true;
            event: { select: { id: true; name: true } };
          };
        };
      };
    }): Promise<{ id: string; name: string; liquidations: LiquidationRow[] } | null>;
  };
};

/* ─────────────────────────────────────────────────────────────────────────────
   STATUS CONFIG
───────────────────────────────────────────────────────────────────────────── */
const statusLabels: Record<LiquidationStatus, string> = {
  DRAFT:     "Borrador",
  FINALIZED: "Finalizada",
  SETTLED:   "Liquidada",
  CANCELLED: "Cancelada",
};

function getStatusPillClass(status: LiquidationStatus): string {
  if (status === "SETTLED")   return "bg-success-50 text-success-700 border-success-500/30";
  if (status === "FINALIZED") return "bg-[color:var(--clr-info-50)] text-[color:var(--clr-info-700)] border-[rgba(67,56,202,0.28)]";
  if (status === "DRAFT")     return "bg-warning-50 text-warning-700 border-warning-500/30";
  return "bg-[color:var(--bg-sunken)] text-secondary border-[color:var(--border-soft)]";
}

function getStatusDotColor(status: LiquidationStatus): string {
  if (status === "SETTLED")   return "var(--clr-success-500)";
  if (status === "FINALIZED") return "var(--clr-info-500)";
  if (status === "DRAFT")     return "var(--clr-warning-500)";
  return "var(--clr-arena-400)";
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────────────────────── */
export default async function ClientLiquidationsPage({ params }: Props) {
  const viewer = await requirePageRole(["ADMIN", "MANAGER"]);
  const { id } = await params;
  await requireViewerClientAccess(viewer, id);

  const scopedEventIds = await getScopedEventIdsForViewer(viewer);

  const reader = db as unknown as ClientReader;
  const client = await reader.client.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      liquidations: {
        where: scopedEventIds ? { eventId: { in: scopedEventIds } } : undefined,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          grossCents: true,
          commissionCents: true,
          netCents: true,
          commissionRateBpsSnapshot: true,
          createdAt: true,
          settledAt: true,
          eventId: true,
          event: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!client) {
    notFound();
  }

  /* ── Derived totals ── */
  const totals = client.liquidations.reduce(
    (acc, liq) => {
      acc.gross      += liq.grossCents;
      acc.commission += liq.commissionCents;
      acc.net        += liq.netCents;
      if (liq.status === "SETTLED") acc.settled += liq.netCents;
      if (liq.status === "DRAFT" || liq.status === "FINALIZED") acc.pending += liq.netCents;
      return acc;
    },
    { gross: 0, commission: 0, net: 0, settled: 0, pending: 0 }
  );

  const fmtShort = (d: Date) =>
    new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(d);
  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(d);

  /* ── KPI chips ── */
  const chips = [
    { label: "Bruto total",   value: centsToCurrency(totals.gross),      color: "text-primary" },
    { label: "Comisión",      value: centsToCurrency(totals.commission),  color: "text-[color:var(--brand-violet)]" },
    { label: "Neto total",    value: centsToCurrency(totals.net),         color: "text-primary" },
    { label: "Pendiente",     value: centsToCurrency(totals.pending),     color: "text-warning-700" },
    { label: "Pagado",        value: centsToCurrency(totals.settled),     color: "text-success-700" },
  ];

  return (
    <>
      <style>{PAGE_STYLES}</style>

      <div className="space-y-0">

        {/* ── HERO BAR — bare div, no panel ── */}
        <div
          className="clq-hero flex flex-wrap items-start justify-between gap-4 pb-5"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div>
            {/* Back link */}
            <Link
              href="/admin/clients"
              className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-secondary transition-colors duration-150 hover:text-primary"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Cliente
            </Link>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--brand-magenta)" }}
            >
              LIQUIDACIONES
            </p>
            <h1 className="mt-1 font-display text-[1.625rem] font-extrabold leading-tight tracking-tight text-primary">
              {client.name}<span style={{ color: "var(--brand-magenta)" }}>.</span>
            </h1>
            <p className="mt-1 text-[12px] text-secondary">
              {client.liquidations.length > 0 ? (
                <>
                  <span className="font-medium text-primary">{client.liquidations.length}</span> liquidaciones
                  {totals.gross > 0 && (
                    <> · bruto <span className="font-medium text-primary">{centsToCurrency(totals.gross)}</span></>
                  )}
                </>
              ) : (
                "Sin liquidaciones generadas aún."
              )}
            </p>
          </div>

          {/* Right: secondary actions */}
          <div className="flex items-center gap-2 pt-0.5">
            <Link
              href={`/admin/clients/${client.id}/merchant`}
              className="inline-flex items-center gap-1.5 rounded-[7px] border px-3 py-[5px] text-[12px] font-medium text-secondary transition-colors duration-[120ms] hover:border-[color:var(--border-strong)] hover:text-primary"
              style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-surface)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              Merchant
            </Link>
          </div>
        </div>

        {/* ── KPI CHIP STRIP ── */}
        <div
          className="clq-chips flex flex-wrap items-stretch"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
          aria-label="Resumen financiero"
        >
          {chips.map((chip) => (
            <div key={chip.label} className="clq-chip">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">
                {chip.label}
              </span>
              <span
                className={`mt-0.5 font-display text-[1.1rem] font-extrabold leading-none tracking-tight clq-num ${chip.color}`}
              >
                {chip.value}
              </span>
            </div>
          ))}
        </div>

        {/* ── LIQUIDATIONS TABLE ── */}
        {client.liquidations.length === 0 ? (
          <div className="clq-table flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[13px] font-semibold text-primary">Sin liquidaciones todavía</p>
            <p className="mt-1 text-[11px] text-secondary max-w-xs">
              Este cliente no tiene liquidaciones generadas. Creá una desde la página de liquidaciones de cada evento.
            </p>
          </div>
        ) : (
          <div className="clq-table overflow-x-auto">
            <table className="min-w-full" style={{ fontSize: "13px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--bg-sunken)", borderBottom: "1px solid var(--border-soft)" }}>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                    Estado
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                    Evento
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                    Bruto
                  </th>
                  <th className="whitespace-nowrap hidden px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.11em] text-secondary sm:table-cell">
                    Comisión
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                    Neto
                  </th>
                  <th className="whitespace-nowrap hidden px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.11em] text-secondary md:table-cell">
                    Fecha
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {client.liquidations.map((liq) => {
                  const isSettled = liq.status === "SETTLED";
                  const snapshotPercent = (liq.commissionRateBpsSnapshot / 100).toFixed(2).replace(/\.00$/, "");

                  return (
                    <tr
                      key={liq.id}
                      className="clq-row clq-tr"
                      style={{ borderBottom: "1px solid var(--border-soft)" }}
                    >
                      {/* Estado */}
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] ${getStatusPillClass(liq.status)}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${isSettled ? "clq-dot-settled" : ""}`}
                            style={{ background: getStatusDotColor(liq.status) }}
                            aria-hidden="true"
                          />
                          {statusLabels[liq.status]}
                        </span>
                      </td>

                      {/* Evento */}
                      <td className="px-3 py-2">
                        {liq.event ? (
                          <div className="min-w-0">
                            <p className="max-w-[180px] truncate text-[12px] font-medium text-primary" title={liq.event.name}>
                              {liq.event.name}
                            </p>
                            <p className="text-[10px] text-muted" style={{ fontFamily: "var(--font-mono)" }}>
                              {snapshotPercent}% snapshot
                            </p>
                          </div>
                        ) : (
                          <span className="text-[12px] text-muted">—</span>
                        )}
                      </td>

                      {/* Bruto */}
                      <td className="px-3 py-2 text-right">
                        <span className="clq-num font-display text-[12px] font-bold text-primary">
                          {centsToCurrency(liq.grossCents)}
                        </span>
                      </td>

                      {/* Comisión */}
                      <td className="hidden px-3 py-2 text-right sm:table-cell">
                        <span className="clq-num text-[12px] text-secondary">
                          {centsToCurrency(liq.commissionCents)}
                        </span>
                      </td>

                      {/* Neto */}
                      <td className="px-3 py-2 text-right">
                        <span
                          className="clq-num font-display text-[12px] font-bold"
                          style={{ color: isSettled ? "var(--clr-success-700)" : "var(--text-primary)" }}
                        >
                          {centsToCurrency(liq.netCents)}
                        </span>
                        {liq.settledAt && (
                          <p className="text-[10px] text-success-700" style={{ fontFamily: "var(--font-mono)" }}>
                            {fmtDate(liq.settledAt)}
                          </p>
                        )}
                      </td>

                      {/* Fecha */}
                      <td className="hidden px-3 py-2 text-right text-[11px] text-muted md:table-cell">
                        {fmtShort(liq.createdAt)}
                      </td>

                      {/* Acciones */}
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="flex items-center justify-end">
                          <LiquidationActions
                            mode="transition"
                            liquidationId={liq.id}
                            current={liq.status}
                            viewerRole={viewer.role as "ADMIN" | "MANAGER"}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Footer count */}
            <div
              className="flex items-center justify-between px-3 py-2.5"
              style={{ borderTop: "1px solid var(--border-soft)" }}
            >
              <span className="text-[11px] text-muted">
                <span className="font-medium text-secondary">{client.liquidations.length}</span> liquidaciones
              </span>
              {/* SummaryBox row for totals */}
              <div className="hidden gap-2 sm:flex">
                <SummaryBox label="Bruto" value={centsToCurrency(totals.gross)} />
                <SummaryBox label="Neto" value={centsToCurrency(totals.net)} />
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
