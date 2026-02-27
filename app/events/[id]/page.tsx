import { notFound } from "next/navigation";
import { requireAnyPageRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { centsToCurrency } from "@/lib/utils";
import { CheckoutCard } from "@/components/checkout-card";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EventDetailPage({ params }: Props) {
  await requireAnyPageRole();
  const { id } = await params;

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
          <div className="mb-5 overflow-hidden rounded-xl border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.heroImageUrl} alt={event.name} className="h-56 w-full object-cover" />
          </div>
        )}
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
          {new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeStyle: "short" }).format(event.startsAt)}
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">{event.name}</h1>
        <p className="mt-2 text-slate-600">{event.venue ?? "Lugar por confirmar"}</p>

        <p className="mt-6 text-slate-700">{event.description ?? "Sin descripcion"}</p>

        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {visibleTicketTypes.map((type) => (
            <div key={type.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">{type.name}</p>
              <p className="mt-1 text-xl font-semibold text-blue-700">{centsToCurrency(type.priceCents)}</p>
              <p className="text-xs text-slate-500">Stock disponible: {type.stock}</p>
              {type.saleMode === "COUPON_ONLY" && <p className="text-xs font-medium text-amber-700">Disponible solo con cupon</p>}
              {type.maxPerOrder ? <p className="text-xs text-slate-500">Max por compra: {type.maxPerOrder}</p> : null}
              {type.maxPerEmail ? <p className="text-xs text-slate-500">Max por email: {type.maxPerEmail}</p> : null}
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
