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

const statusLabels: Record<LiquidationStatus, string> = {
  DRAFT: "Borrador",
  FINALIZED: "Finalizada",
  SETTLED: "Liquidada",
  CANCELLED: "Cancelada"
};

const statusStyles: Record<LiquidationStatus, string> = {
  DRAFT: "bg-warning-50 text-warning-700",
  FINALIZED: "bg-info-50 text-info-700",
  SETTLED: "bg-success-50 text-success-700",
  CANCELLED: "bg-sunken text-primary border border-soft"
};

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
            select: { id: true, orderId: true, grossCents: true, commissionCents: true, netCents: true }
          }
        }
      }
    }
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

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-body-s font-medium text-secondary">Liquidaciones</p>
            <h1 className="mt-1 text-title-m font-semibold tracking-tight text-primary">{event.name}</h1>
            <p className="mt-1 text-body-s text-secondary">
              Comision configurada: {commissionPercent.toFixed(2).replace(/\.00$/, "")}% sobre ventas aprobadas DELEGATED.
            </p>
            {event.client ? (
              <p className="mt-1 text-body-s text-secondary">
                Cliente:{" "}
                <Link href={`/admin/clients/${event.client.id}/merchant`} className="font-medium text-forest-600 hover:underline">
                  {event.client.name}
                </Link>
              </p>
            ) : (
              <p className="mt-1 text-body-s text-danger-700">Evento sin cliente delegado asociado.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/events/${event.id}/edit`} className="btn-secondary">
              Volver al evento
            </Link>
            {event.client ? (
              <Link href={`/admin/clients/${event.client.id}/liquidations`} className="btn-secondary">
                Liquidaciones del cliente
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-body-l font-semibold text-primary">Preview de nueva liquidacion</h2>
        <p className="mt-1 text-body-s text-secondary">
          Incluye solo ordenes PAID en modelo DELEGATED que no pertenecen a una liquidacion previa.
        </p>

        {draftError ? (
          <p className="mt-4 rounded-sm border border-danger-500 bg-danger-50 px-3 py-2 text-body-s text-danger-700">{draftError}</p>
        ) : draft ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <SummaryBox label="Ordenes" value={String(draft.items.length)} />
              <SummaryBox label="Bruto" value={centsToCurrency(draft.grossCents)} />
              <SummaryBox label="Comision" value={centsToCurrency(draft.commissionCents)} />
              <SummaryBox label="Neto" value={centsToCurrency(draft.netCents)} />
            </div>
            <div className="mt-4">
              <LiquidationActions
                mode="create"
                eventId={event.id}
                disabled={draft.items.length === 0}
                disabledReason={draft.items.length === 0 ? "No hay ordenes nuevas para liquidar" : undefined}
              />
            </div>
          </>
        ) : null}
      </section>

      <section className="panel p-6">
        <h2 className="text-body-l font-semibold text-primary">Historial</h2>
        {event.liquidations.length === 0 ? (
          <p className="mt-3 text-body-s text-secondary">Todavia no hay liquidaciones generadas para este evento.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {event.liquidations.map((liq) => (
              <article key={liq.id} className="rounded-md border border-soft p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[liq.status]}`}>
                        {statusLabels[liq.status]}
                      </span>
                      <span className="text-caption text-secondary">
                        {new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(liq.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-body-s text-secondary">
                      Comision snapshot: {(liq.commissionRateBpsSnapshot / 100).toFixed(2).replace(/\.00$/, "")}% · {liq.items.length} orden(es)
                    </p>
                    {liq.settledAt ? (
                      <p className="mt-1 text-caption text-secondary">
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
          </div>
        )}
      </section>
    </div>
  );
}

