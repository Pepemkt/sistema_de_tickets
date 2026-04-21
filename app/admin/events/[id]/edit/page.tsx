import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { EventForm } from "@/components/event-form";
import { EventClientPicker } from "@/components/event-client-picker";
import { requirePageRole } from "@/lib/auth";
import { requireViewerEventAccess } from "@/lib/event-scope";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditEventPage({ params }: Props) {
  const viewer = await requirePageRole(["ADMIN", "MANAGER"]);
  const { id } = await params;

  const eventReader = db as unknown as {
    event: {
      findUnique(args: {
        where: { id: string };
        include: {
          client: { select: { id: true; name: true } };
          ticketTypes: {
            orderBy: { priceCents: "asc" };
            include: { _count: { select: { tickets: true } } };
          };
        };
      }): Promise<
        | {
            id: string;
            slug: string;
            name: string;
            featuredTag: string | null;
            description: string | null;
            featureTags: unknown;
            heroImageUrl: string | null;
            venue: string | null;
            status: "ACTIVE" | "UPCOMING" | "DRAFT";
            platformCommissionRateBps: number;
            startsAt: Date;
            endsAt: Date | null;
            client: { id: string; name: string } | null;
            ticketTypes: Array<{
              id: string;
              name: string;
              priceCents: number;
              stock: number;
              saleMode: "PUBLIC" | "COUPON_ONLY" | "HIDDEN";
              maxPerOrder: number | null;
              maxPerEmail: number | null;
              _count: { tickets: number };
            }>;
          }
        | null
      >;
    };
  };

  await requireViewerEventAccess(viewer, id);

  const event = await eventReader.event.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          name: true
        }
      },
      ticketTypes: {
        orderBy: { priceCents: "asc" },
        include: {
          _count: {
            select: { tickets: true }
          }
        }
      }
    }
  });

  if (!event) {
    notFound();
  }

  const clientListReader = db as unknown as {
    client: {
      findMany(args: { orderBy: { name: "asc" }; select: { id: true; name: true } }): Promise<Array<{ id: string; name: string }>>;
    };
  };
  const availableClients = viewer.role === "ADMIN" ? await clientListReader.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : [];

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
  const publicPath = `/e/${event.slug}`;
  const publicEventUrl = baseUrl ? `${baseUrl}${publicPath}` : publicPath;

  return (
    <section className="panel p-6">
      <h2 className="section-title">Editar evento</h2>
      <p className="muted mt-1">Actualiza contenidos, fechas y estrategia de precios.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Link href={`/admin/events/${event.id}/template`} className="btn-secondary">
          Editar diseno de tickets (PDF)
        </Link>
        <Link href={publicPath} className="btn-secondary" target="_blank" rel="noopener noreferrer">
          Abrir pagina publica de compra
        </Link>
      </div>

      <div className="mt-4 rounded-md border border-soft bg-sunken p-3">
        <p className="text-overline font-semibold uppercase tracking-wide text-muted">Link compartible</p>
        <p className="mt-1 break-all text-body-s text-secondary">{publicEventUrl}</p>
      </div>

      <div className="mt-4 rounded-md border border-soft bg-sunken p-4">
        <p className="text-overline font-semibold uppercase tracking-wide text-muted">Modelo comercial</p>
        <p className="mt-1 text-body-s text-primary">
          {event.client
            ? `Merchant delegado por cliente: ${event.client.name}`
            : "Flujo global temporal activo. Este evento aun no tiene cliente merchant asociado."}
        </p>
        {event.client ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/admin/clients/${event.client.id}/merchant`} className="btn-secondary inline-flex">
              Gestionar merchant del cliente
            </Link>
            <Link href={`/admin/events/${event.id}/liquidation`} className="btn-secondary inline-flex">
              Liquidaciones del evento
            </Link>
          </div>
        ) : null}
        {viewer.role === "ADMIN" ? (
          <EventClientPicker
            eventId={event.id}
            currentClientId={event.client?.id ?? null}
            currentClientName={event.client?.name ?? null}
            clients={availableClients}
          />
        ) : null}
      </div>

      <div className="mt-6">
        <EventForm
          mode="edit"
          eventId={event.id}
          initial={{
            name: event.name,
            featuredTag: event.featuredTag ?? "",
            description: event.description ?? "",
            featureTags: Array.isArray(event.featureTags) ? event.featureTags.map((item) => String(item)) : [],
            heroImageUrl: event.heroImageUrl ?? "",
            venue: event.venue ?? "",
            status: event.status,
            platformCommissionRateBps: event.platformCommissionRateBps,
            startsAt: event.startsAt.toISOString(),
            endsAt: event.endsAt ? event.endsAt.toISOString() : "",
            ticketTypes: event.ticketTypes.map((item) => ({
              id: item.id,
              name: item.name,
              price: item.priceCents / 100,
              stock: item.stock,
              saleMode: item.saleMode,
              maxPerOrder: item.maxPerOrder ?? null,
              maxPerEmail: item.maxPerEmail ?? null,
              soldCount: item._count.tickets
            }))
          }}
          viewerRole={viewer.role}
        />
      </div>
    </section>
  );
}
