import { notFound } from "next/navigation";
import { requireAnyPageRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { centsToCurrency } from "@/lib/utils";
import { CheckoutCard } from "@/components/checkout-card";
import { requireViewerEventAccess } from "@/lib/event-scope";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EventDetailPage({ params }: Props) {
  const viewer = await requireAnyPageRole();
  const { id } = await params;

  await requireViewerEventAccess(viewer, id);

  const event = await db.event.findUnique({
    where: { id },
    include: {
      ticketTypes: {
        orderBy: { priceCents: "asc" }
      }
    }
  });

  if (!event) {
    notFound();
  }

  const visibleTicketTypes = event.ticketTypes.filter((type) => type.saleMode !== "HIDDEN");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="panel p-7">
        {event.heroImageUrl && (
          <div className="mb-5 overflow-hidden rounded-md border border-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.heroImageUrl} alt={event.name} className="h-56 w-full object-cover" />
          </div>
        )}
        <p className="text-overline font-semibold uppercase tracking-[0.1em] text-[color:var(--brand-magenta)]">
          {new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeStyle: "short" }).format(event.startsAt)}
        </p>
        <h1 className="mt-1 font-display text-title-xl font-bold text-primary">{event.name}</h1>
        <p className="mt-2 text-secondary">{event.venue ?? "Lugar por confirmar"}</p>

        <p className="mt-6 text-secondary">{event.description ?? "Sin descripcion"}</p>

        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {visibleTicketTypes.map((type) => (
            <div key={type.id} className="rounded-md border border-soft bg-sunken p-4">
              <p className="text-body-s text-secondary">{type.name}</p>
              <p className="mt-1 font-display text-title-s font-bold text-[color:var(--brand-magenta)]">{centsToCurrency(type.priceCents)}</p>
              <p className="text-caption text-muted">Stock disponible: {type.stock}</p>
              {type.saleMode === "COUPON_ONLY" && <p className="text-caption font-medium text-warning-700">Disponible solo con cupon</p>}
              {type.maxPerOrder ? <p className="text-caption text-muted">Max por compra: {type.maxPerOrder}</p> : null}
              {type.maxPerEmail ? <p className="text-caption text-muted">Max por email: {type.maxPerEmail}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <CheckoutCard
        eventId={event.id}
        eventName={event.name}
        ticketTypes={visibleTicketTypes.map((item) => ({
          id: item.id,
          name: item.name,
          priceCents: item.priceCents,
          saleMode: item.saleMode,
          maxPerOrder: item.maxPerOrder,
          maxPerEmail: item.maxPerEmail
        }))}
      />
    </div>
  );
}
