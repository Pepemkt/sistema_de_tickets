import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireViewerEventAccess } from "@/lib/event-scope";
import { buildLiquidationForEvent, type LiquidationDraft } from "@/lib/application/liquidations/build-liquidation";
import { commissionBpsToPercent } from "@/lib/platform-commission";
import { centsToCurrency } from "@/lib/utils";
import { LiquidationActions } from "@/components/liquidation-actions";
import { SummaryBox } from "@/components/ui";

/* ─────────────────────────────────────────────────────────────────────────────
   CSS — server-safe (no "use client")
───────────────────────────────────────────────────────────────────────────── */
const PAGE_STYLES = `
@keyframes lq-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes lq-row-in {
  from { opacity: 0; transform: translateX(-4px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes lq-dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.45; transform: scale(0.75); }
}
@keyframes lq-flow-arrow {
  0%, 100% { opacity: 0.4; transform: translateX(0); }
  50%       { opacity: 0.85; transform: translateX(3px); }
}

/* Page sections */
.lq-hero    { animation: lq-fade-up 0.48s var(--ease-tactile) 0.02s both; }
.lq-chips   { animation: lq-fade-up 0.48s var(--ease-tactile) 0.08s both; }
.lq-draft   { animation: lq-fade-up 0.48s var(--ease-tactile) 0.14s both; }
.lq-history { animation: lq-fade-up 0.48s var(--ease-tactile) 0.20s both; }
.lq-dot-settled { animation: lq-dot-pulse 2.2s ease-in-out infinite; }
.lq-arrow   { animation: lq-flow-arrow 2.4s ease-in-out infinite; }

/* KPI chip strip */
.lq-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 8px 14px;
  border-right: 1px solid var(--border-soft);
  min-width: 80px;
}
.lq-chip:last-child { border-right: none; }

/* Table */
.lq-tr { transition: background-color 0.10s ease; cursor: default; }
.lq-tr:hover { background-color: var(--bg-sunken); }

/* Row stagger */
.lq-row { animation: lq-row-in 0.34s var(--ease-tactile) both; }
.lq-row:nth-child(1) { animation-delay: 0.22s; }
.lq-row:nth-child(2) { animation-delay: 0.25s; }
.lq-row:nth-child(3) { animation-delay: 0.28s; }
.lq-row:nth-child(4) { animation-delay: 0.31s; }
.lq-row:nth-child(5) { animation-delay: 0.34s; }
.lq-row:nth-child(6) { animation-delay: 0.37s; }
.lq-row:nth-child(7) { animation-delay: 0.40s; }
.lq-row:nth-child(8) { animation-delay: 0.43s; }

/* Section divider — same as ef- pattern */
.lq-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0 12px;
  border-top: 1px solid var(--border-soft);
}
.lq-divider-first {
  border-top: none;
  padding-top: 12px;
}
.lq-divider-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--clr-arena-400);
  white-space: nowrap;
  font-family: var(--font-display);
}
.lq-divider-line {
  flex: 1;
  height: 1px;
  background: var(--border-soft);
}

/* Tabular nums */
.lq-num {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}

/* Commission chip */
.lq-commission-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px 3px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
  border: 1px solid rgba(91,33,182,0.22);
  background: rgba(91,33,182,0.06);
  color: var(--brand-violet);
  font-family: var(--font-mono);
}

/* Money display */
.lq-money {
  font-family: var(--font-mono);
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
}
.lq-money-gross       { color: var(--text-primary); }
.lq-money-commission  {
  background: linear-gradient(135deg, #EC4899 0%, #DB1E7A 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.lq-money-net {
  background: linear-gradient(135deg, #1FAE4A 0%, #117A30 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Flow arrow connector */
.lq-connector {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 2px;
  color: var(--text-muted);
}

/* Status chip */
.lq-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 9999px;
  padding: 3px 10px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
  border: 1px solid transparent;
}

/* Mono small */
.lq-mono-sm {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--text-muted);
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
  items: Array<{ id: string; orderId: string; grossCents: number; commissionCents: number; netCents: number }>;
};

type EventReaderResult = {
  id: string;
  name: string;
  clientId: string | null;
  platformCommissionRateBps: number | null;
  client: { id: string; name: string } | null;
  liquidations: LiquidationRow[];
};

type EventReader = {
  event: {
    findUnique(args: {
      where: { id: string };
      select: {
        id: true;
        name: true;
        clientId: true;
        platformCommissionRateBps: true;
        client: { select: { id: true; name: true } };
        liquidations: {
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
            items: {
              select: { id: true; orderId: true; grossCents: true; commissionCents: true; netCents: true };
            };
          };
        };
      };
    }): Promise<EventReaderResult | null>;
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

const statusChipStyle: Record<LiquidationStatus, { bg: string; text: string; border: string; dot: string }> = {
  DRAFT: {
    bg:     "var(--clr-warning-50)",
    text:   "var(--clr-warning-700)",
    border: "rgba(245,158,11,0.30)",
    dot:    "var(--clr-warning-500)",
  },
  FINALIZED: {
    bg:     "var(--clr-info-50)",
    text:   "var(--clr-info-700)",
    border: "rgba(67,56,202,0.28)",
    dot:    "var(--clr-info-500)",
  },
  SETTLED: {
    bg:     "var(--clr-success-50)",
    text:   "var(--clr-success-700)",
    border: "rgba(31,174,74,0.28)",
    dot:    "var(--clr-success-500)",
  },
  CANCELLED: {
    bg:     "var(--bg-sunken)",
    text:   "var(--text-secondary)",
    border: "var(--border-soft)",
    dot:    "var(--clr-arena-400)",
  },
};

function getStatusPillClass(status: LiquidationStatus): string {
  if (status === "SETTLED")   return "bg-success-50 text-success-700 border-success-500/30";
  if (status === "FINALIZED") return "bg-[color:var(--clr-info-50)] text-[color:var(--clr-info-700)] border-[rgba(67,56,202,0.28)]";
  if (status === "DRAFT")     return "bg-warning-50 text-warning-700 border-warning-500/30";
  return "bg-[color:var(--bg-sunken)] text-secondary border-[color:var(--border-soft)]";
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────────────────────── */
export default async function EventLiquidationPage({ params }: Props) {
  const viewer = await requirePageRole(["ADMIN", "MANAGER"]);
  const { id } = await params;
  await requireViewerEventAccess(viewer, id);

  const reader = db as unknown as EventReader;
  const event = await reader.event.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      clientId: true,
      platformCommissionRateBps: true,
      client: { select: { id: true, name: true } },
      liquidations: {
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
          items: {
            select: { id: true, orderId: true, grossCents: true, commissionCents: true, netCents: true },
          },
        },
      },
    },
  });

  if (!event) {
    notFound();
  }

  let draft: LiquidationDraft | null = null;
  let draftError: string | null = null;
  try {
    draft = await buildLiquidationForEvent(id);
  } catch (error) {
    draftError = error instanceof Error ? error.message : "No se pudo calcular la liquidacion";
  }

  const commissionPercent = commissionBpsToPercent(event.platformCommissionRateBps);

  /* ── Derived totals ── */
  const totals = event.liquidations.reduce(
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
          className="lq-hero flex flex-wrap items-start justify-between gap-4 pb-5"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div>
            {/* Back link */}
            <Link
              href={`/admin/events/${event.id}/edit`}
              className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-secondary transition-colors duration-150 hover:text-primary"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Evento
            </Link>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--brand-magenta)" }}
            >
              Liquidaciones
            </p>
            <h1 className="mt-1 font-display text-[1.625rem] font-extrabold leading-tight tracking-tight text-primary">
              {event.name}<span style={{ color: "var(--brand-magenta)" }}>.</span>
            </h1>
            <p className="mt-1 text-[12px] text-secondary">
              {event.liquidations.length > 0 ? (
                <>
                  <span className="font-medium text-primary">{event.liquidations.length}</span> liquidaciones
                  {totals.gross > 0 && (
                    <> · bruto <span className="font-medium text-primary">{centsToCurrency(totals.gross)}</span></>
                  )}
                </>
              ) : (
                "Sin liquidaciones generadas aún."
              )}
            </p>
          </div>

          {/* Right: client link + edit event */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {event.client && (
              <Link
                href={`/admin/clients/${event.client.id}/liquidations`}
                className="inline-flex items-center gap-1.5 rounded-[7px] border px-3 py-[5px] text-[12px] font-medium text-secondary transition-colors duration-[120ms] hover:border-[color:var(--border-strong)] hover:text-primary"
                style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-surface)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                {event.client.name}
              </Link>
            )}
            <Link
              href={`/admin/events/${event.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-[7px] border px-3 py-[5px] text-[12px] font-medium text-secondary transition-colors duration-[120ms] hover:border-[color:var(--border-strong)] hover:text-primary"
              style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-surface)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Editar evento
            </Link>
          </div>
        </div>

        {/* ── KPI CHIP STRIP ── */}
        <div
          className="lq-chips flex flex-wrap items-stretch"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
          aria-label="Resumen financiero"
        >
          {chips.map((chip) => (
            <div key={chip.label} className="lq-chip">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">
                {chip.label}
              </span>
              <span
                className={`mt-0.5 font-display text-[1.1rem] font-extrabold leading-none tracking-tight lq-num ${chip.color}`}
              >
                {chip.value}
              </span>
            </div>
          ))}
        </div>

        {/* ── DRAFT PREVIEW ── */}
        <div
          className="lq-draft"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          {/* Section header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-5 pb-3 px-0">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ color: "var(--brand-violet)" }}
              >
                Transacción propuesta
              </p>
              <h2 className="mt-0.5 font-display text-[1rem] font-bold text-primary">
                Preview de nueva liquidación
              </h2>
              <p className="mt-0.5 max-w-lg text-[12px] leading-relaxed text-secondary">
                Incluye solo órdenes <span className="font-semibold text-primary">PAID</span> en modelo <span className="font-semibold text-primary">DELEGATED</span> que no pertenecen a una liquidación previa.
              </p>
            </div>

            {/* Commission chip */}
            <span className="lq-commission-chip">
              <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              {commissionPercent.toFixed(2).replace(/\.00$/, "")}% comisión
            </span>
          </div>

          {/* Error state */}
          {draftError ? (
            <div
              className="flex items-start gap-3 rounded-lg border px-4 py-3 mb-5"
              style={{ borderColor: "rgba(225,29,72,0.25)", background: "var(--clr-danger-50)" }}
            >
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-danger-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-[12px] text-danger-700">{draftError}</p>
            </div>
          ) : draft ? (
            <>
              {/* Orders count badge */}
              <div className="mb-4 flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold"
                  style={{
                    borderColor: draft.items.length === 0
                      ? "var(--border-soft)"
                      : "rgba(91,33,182,0.22)",
                    background: draft.items.length === 0
                      ? "var(--bg-sunken)"
                      : "rgba(91,33,182,0.06)",
                    color: draft.items.length === 0
                      ? "var(--text-muted)"
                      : "var(--brand-violet)",
                  }}
                >
                  <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                  {draft.items.length} orden{draft.items.length !== 1 ? "es" : ""} nuevas
                </span>
              </div>

              {/* Financial flow: Bruto → Comisión → Neto */}
              <div className="mb-4 flex flex-wrap items-stretch gap-0">
                {/* BRUTO */}
                <div className="flex min-w-[130px] flex-1 flex-col justify-between rounded-l-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-sunken)] p-4">
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-secondary">Bruto</p>
                  <p className="lq-money lq-money-gross mt-2">{centsToCurrency(draft.grossCents)}</p>
                  <p className="mt-2 text-[10px] text-muted">Ventas totales PAID</p>
                </div>
                {/* Arrow */}
                <div className="lq-connector lq-arrow flex-none border-y border-[color:var(--border-soft)] bg-[color:var(--bg-sunken)] px-3">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
                {/* COMISIÓN */}
                <div
                  className="flex min-w-[130px] flex-1 flex-col justify-between border-y border-[color:var(--border-soft)] p-4"
                  style={{ background: "var(--clr-coral-50)" }}
                >
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--clr-coral-700)" }}>
                    Comisión plataforma
                  </p>
                  <p className="lq-money lq-money-commission mt-2">{centsToCurrency(draft.commissionCents)}</p>
                  <p className="mt-2 text-[10px]" style={{ color: "var(--clr-coral-600)" }}>
                    {commissionPercent.toFixed(2).replace(/\.00$/, "")}% del bruto
                  </p>
                </div>
                {/* Arrow */}
                <div
                  className="lq-connector lq-arrow flex-none border-y border-[color:var(--border-soft)] px-3"
                  style={{ background: "var(--clr-coral-50)", animationDelay: "0.4s" }}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--clr-coral-400)" }}>
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
                {/* NETO */}
                <div
                  className="flex min-w-[130px] flex-1 flex-col justify-between rounded-r-lg border border-[color:var(--border-soft)] p-4"
                  style={{ background: "var(--clr-success-50)" }}
                >
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--clr-success-700)" }}>
                    Neto al merchant
                  </p>
                  <p className="lq-money lq-money-net mt-2">{centsToCurrency(draft.netCents)}</p>
                  <p className="mt-2 text-[10px]" style={{ color: "var(--clr-success-500)" }}>
                    A liquidar al cliente
                  </p>
                </div>
              </div>

              {/* Summary boxes */}
              <div className="mb-4 grid gap-2.5 sm:grid-cols-4">
                <SummaryBox label="Órdenes" value={String(draft.items.length)} />
                <SummaryBox label="Bruto" value={centsToCurrency(draft.grossCents)} />
                <SummaryBox label="Comisión" value={centsToCurrency(draft.commissionCents)} />
                <SummaryBox label="Neto" value={centsToCurrency(draft.netCents)} />
              </div>

              {/* CTA */}
              <div
                className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-sunken)] px-4 py-3 mb-5"
              >
                <p className="text-[11px] text-secondary">
                  {draft.items.length === 0
                    ? "No hay órdenes nuevas para incluir en esta liquidación."
                    : `Creá la liquidación para registrar estas ${draft.items.length} orden${draft.items.length !== 1 ? "es" : ""}.`}
                </p>
                <LiquidationActions
                  mode="create"
                  eventId={event.id}
                  disabled={draft.items.length === 0}
                  disabledReason={draft.items.length === 0 ? "No hay ordenes nuevas para liquidar" : undefined}
                />
              </div>
            </>
          ) : null}
        </div>

        {/* ── HISTORIAL TABLE ── */}
        {event.liquidations.length === 0 ? (
          <div className="lq-history flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[13px] font-semibold text-primary">Sin liquidaciones todavía</p>
            <p className="mt-1 text-[11px] text-secondary max-w-xs">
              Todavía no hay liquidaciones generadas para este evento.
            </p>
          </div>
        ) : (
          <div className="lq-history overflow-x-auto">
            {/* Section overline */}
            <div className="flex items-center gap-2 pt-5 pb-3">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ color: "var(--text-muted)" }}
              >
                Historial de liquidaciones
              </p>
              <span
                className="inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold"
                style={{
                  borderColor: "rgba(91,33,182,0.18)",
                  background: "rgba(91,33,182,0.05)",
                  color: "var(--brand-violet)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {event.liquidations.length}
              </span>
            </div>

            <table className="min-w-full" style={{ fontSize: "13px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--bg-sunken)", borderBottom: "1px solid var(--border-soft)" }}>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                    Estado
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                    Órdenes
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
                {event.liquidations.map((liq) => {
                  const chip = statusChipStyle[liq.status];
                  const isSettled = liq.status === "SETTLED";
                  const snapshotPercent = (liq.commissionRateBpsSnapshot / 100).toFixed(2).replace(/\.00$/, "");

                  return (
                    <tr
                      key={liq.id}
                      className="lq-row lq-tr"
                      style={{ borderBottom: "1px solid var(--border-soft)" }}
                    >
                      {/* Estado */}
                      <td className="px-3 py-2">
                        <span
                          className="lq-status-chip"
                          style={{
                            background: chip.bg,
                            color: chip.text,
                            borderColor: chip.border,
                          }}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${isSettled ? "lq-dot-settled" : ""}`}
                            style={{ background: chip.dot }}
                            aria-hidden="true"
                          />
                          {statusLabels[liq.status]}
                        </span>
                        <p className="mt-0.5 text-[10px] text-muted" style={{ fontFamily: "var(--font-mono)" }}>
                          {snapshotPercent}% snapshot
                        </p>
                      </td>

                      {/* Órdenes */}
                      <td className="px-3 py-2 text-right">
                        <span className="lq-num font-display text-[12px] font-bold text-primary">
                          {liq.items.length}
                        </span>
                      </td>

                      {/* Bruto */}
                      <td className="px-3 py-2 text-right">
                        <span className="lq-num font-display text-[12px] font-bold text-primary">
                          {centsToCurrency(liq.grossCents)}
                        </span>
                      </td>

                      {/* Comisión */}
                      <td className="hidden px-3 py-2 text-right sm:table-cell">
                        <span className="lq-num text-[12px] text-secondary">
                          {centsToCurrency(liq.commissionCents)}
                        </span>
                      </td>

                      {/* Neto */}
                      <td className="px-3 py-2 text-right">
                        <span
                          className="lq-num font-display text-[12px] font-bold"
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

            {/* Footer */}
            <div
              className="flex items-center justify-between px-3 py-2.5"
              style={{ borderTop: "1px solid var(--border-soft)" }}
            >
              <span className="text-[11px] text-muted">
                <span className="font-medium text-secondary">{event.liquidations.length}</span> liquidaciones
              </span>
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
