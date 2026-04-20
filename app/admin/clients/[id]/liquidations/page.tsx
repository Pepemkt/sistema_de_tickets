import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getScopedEventIdsForViewer, requireViewerClientAccess } from "@/lib/event-scope";
import { centsToCurrency } from "@/lib/utils";
import { LiquidationActions } from "@/components/liquidation-actions";

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

const statusLabels: Record<LiquidationStatus, string> = {
  DRAFT: "Borrador",
  FINALIZED: "Finalizada",
  SETTLED: "Liquidada",
  CANCELLED: "Cancelada"
};

const statusStyles: Record<LiquidationStatus, string> = {
  DRAFT: "bg-amber-100 text-amber-700",
  FINALIZED: "bg-blue-100 text-blue-700",
  SETTLED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-200 text-slate-600"
};

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
          event: { select: { id: true, name: true } }
        }
      }
    }
  });

  if (!client) {
    notFound();
  }

  const totals = client.liquidations.reduce(
    (acc, liq) => {
      acc.gross += liq.grossCents;
      acc.commission += liq.commissionCents;
      acc.net += liq.netCents;
      if (liq.status === "SETTLED") acc.settled += liq.netCents;
      if (liq.status === "DRAFT" || liq.status === "FINALIZED") acc.pending += liq.netCents;
      return acc;
    },
    { gross: 0, commission: 0, net: 0, settled: 0, pending: 0 }
  );

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">Liquidaciones</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{client.name}</h1>
            <p className="mt-1 text-sm text-slate-600">
              Liquidaciones manuales por evento de este cliente. La comision aplicada es snapshot al momento de crear la liquidacion.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/clients" className="btn-secondary">
              Volver a clientes
            </Link>
            <Link href={`/admin/clients/${client.id}/merchant`} className="btn-secondary">
              Merchant
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <SummaryBox label="Bruto total" value={centsToCurrency(totals.gross)} />
          <SummaryBox label="Comision total" value={centsToCurrency(totals.commission)} />
          <SummaryBox label="Pendiente" value={centsToCurrency(totals.pending)} />
          <SummaryBox label="Liquidado" value={centsToCurrency(totals.settled)} />
        </div>
      </section>

      {client.liquidations.length === 0 ? (
        <section className="panel p-8">
          <p className="text-slate-600">Este cliente todavia no tiene liquidaciones generadas.</p>
        </section>
      ) : (
        <section className="space-y-3">
          {client.liquidations.map((liq) => (
            <article key={liq.id} className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[liq.status]}`}>
                      {statusLabels[liq.status]}
                    </span>
                    {liq.event ? (
                      <Link href={`/admin/events/${liq.event.id}/liquidation`} className="text-sm font-medium text-slate-900 hover:underline">
                        {liq.event.name}
                      </Link>
                    ) : null}
                    <span className="text-xs text-slate-500">
                      {new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(liq.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    Comision snapshot: {(liq.commissionRateBpsSnapshot / 100).toFixed(2).replace(/\.00$/, "")}%
                  </p>
                  {liq.settledAt ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Liquidada: {new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(liq.settledAt)}
                    </p>
                  ) : null}
                </div>
                <LiquidationActions
                  mode="transition"
                  liquidationId={liq.id}
                  current={liq.status}
                  viewerRole={viewer.role as "ADMIN" | "MANAGER"}
                />
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <SummaryBox label="Bruto" value={centsToCurrency(liq.grossCents)} />
                <SummaryBox label="Comision" value={centsToCurrency(liq.commissionCents)} />
                <SummaryBox label="Neto" value={centsToCurrency(liq.netCents)} />
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
