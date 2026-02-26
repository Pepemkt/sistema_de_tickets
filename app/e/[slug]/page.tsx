import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { centsToCurrency } from "@/lib/utils";
import { CheckoutCard } from "@/components/checkout-card";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PublicEventPage({ params }: Props) {
  const { slug } = await params;

  const event = await db.event.findUnique({
    where: { slug },
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
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <section className="panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              {new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeStyle: "short" }).format(event.startsAt)}
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">{event.name}</h1>
            <p className="mt-2 text-slate-600">{event.venue ?? "Lugar por confirmar"}</p>
          </div>
          <Link href="/login" className="btn-secondary">
            Acceso organizador
          </Link>
        </div>

        <p className="mt-5 text-slate-700">{event.description ?? "Sin descripcion"}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="panel p-7">
          <h2 className="text-xl font-semibold text-slate-900">Entradas disponibles</h2>

          {visibleTicketTypes.length === 0 ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              Este evento no tiene entradas habilitadas para compra online.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
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
          )}
        </section>

        <CheckoutCard
          eventId={event.id}
          eventName={event.name}
          allowDevSimulation={false}
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
    </div>
  );
}
