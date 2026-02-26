import Link from "next/link";
import { db } from "@/lib/db";
import { requireAnyPageRole } from "@/lib/auth";
import { centsToCurrency } from "@/lib/utils";

export default async function HomePage() {
  const viewer = await requireAnyPageRole();

  const events = await db.event.findMany({
    orderBy: { startsAt: "asc" },
    include: {
      ticketTypes: {
        orderBy: { priceCents: "asc" }
      }
    }
  });

  return (
    <div className="space-y-8">
      <section className="panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Aiderbrand Platform</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Gestion y venta de entradas con experiencia profesional</h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              Publica eventos, vende con Mercado Pago, emite tickets PDF con QR, y valida asistencia con scanner en tiempo real.
            </p>
          </div>

          {viewer.role === "ADMIN" ? (
            <Link href="/admin/events/new" className="btn-primary">
              Crear evento
            </Link>
          ) : viewer.role === "SELLER" ? (
            <Link href="/sales" className="btn-primary">
              Ventas especiales
            </Link>
          ) : (
            <Link href="/scan" className="btn-primary">
              Ir a check-in
            </Link>
          )}
        </div>
      </section>

      {events.length === 0 ? (
        <section className="panel p-8">
          <p className="text-slate-600">Aun no hay eventos publicados.</p>
          {viewer.role === "ADMIN" && (
            <Link href="/admin/events/new" className="btn-primary mt-4 inline-flex">
              Crear primer evento
            </Link>
          )}
        </section>
      ) : (
        <section className="grid gap-5 lg:grid-cols-2">
          {events.map((event) => {
            const listedTypes = event.ticketTypes.filter((type) => type.saleMode !== "HIDDEN");
            const fromType = listedTypes[0] ?? null;

            return (
              <article key={event.id} className="panel p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  {new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeStyle: "short" }).format(event.startsAt)}
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">{event.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{event.venue ?? "Lugar por confirmar"}</p>

                <p className="mt-4 line-clamp-3 text-sm text-slate-600">{event.description ?? "Sin descripcion"}</p>

                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Desde</p>
                    <p className="text-2xl font-semibold text-blue-700">
                      {fromType ? centsToCurrency(fromType.priceCents) : "Solo emision interna"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/events/${event.id}`} className="btn-primary">
                      Comprar
                    </Link>
                    {viewer.role === "ADMIN" && (
                      <Link href={`/admin/events/${event.id}/edit`} className="btn-secondary">
                        Editar
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
