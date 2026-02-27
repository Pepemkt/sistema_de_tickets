import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { centsToCurrency } from "@/lib/utils";

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

  if (!event) notFound();

  const visibleTicketTypes = event.ticketTypes.filter((type) => type.saleMode !== "HIDDEN");
  const startingPrice = visibleTicketTypes[0]?.priceCents ?? 0;

  return (
    <div className="bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-lg font-bold text-slate-900">
            EventHub
          </Link>
          <Link href="/login" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
            Iniciar sesion
          </Link>
        </div>
      </header>

      <section className="relative isolate min-h-[72vh] overflow-hidden">
        {event.heroImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.heroImageUrl} alt={event.name} className="absolute inset-0 -z-20 h-full w-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/60 via-slate-950/50 to-slate-950/85" />
          </>
        ) : (
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950" />
        )}

        <div className="mx-auto flex min-h-[72vh] w-full max-w-6xl items-end px-4 py-14 sm:px-6">
          <div>
            <p className="inline-flex rounded-full border border-white/20 bg-blue-600/25 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white">
              {event.featuredTag?.trim() || "Evento destacado"}
            </p>
            <h1 className="mt-4 max-w-2xl text-5xl font-semibold leading-tight text-white">{event.name}</h1>
            <p className="mt-3 text-sm text-white/85">
              {new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeStyle: "short" }).format(event.startsAt)} · {event.venue ?? "Lugar por confirmar"}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="rounded-xl bg-blue-600 px-4 py-2 text-white">
                <p className="text-xs uppercase tracking-wide text-blue-100">Desde</p>
                <p className="text-2xl font-semibold">{startingPrice > 0 ? centsToCurrency(startingPrice) : "Gratis"}</p>
              </div>
              <Link href={`/e/${event.slug}/checkout`} className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900">
                Comprar entradas
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[1fr_340px] sm:px-6">
        <article>
          <h2 className="text-4xl font-semibold text-slate-900">Sobre el evento</h2>
          <p className="mt-4 whitespace-pre-line text-slate-700">{event.description ?? "Sin descripcion disponible por el momento."}</p>

          {(Array.isArray(event.featureTags) ? event.featureTags : []).map((item) => String(item).trim()).filter(Boolean).length > 0 && (
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(Array.isArray(event.featureTags) ? event.featureTags : [])
                .map((item) => String(item).trim())
                .filter(Boolean)
                .map((item) => (
                  <div key={item} className="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm font-medium text-slate-600 shadow-sm">
                    {item}
                  </div>
                ))}
            </div>
          )}
        </article>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <h3 className="text-xl font-semibold text-slate-900">Seleccion de entradas</h3>
          <p className="mt-1 text-xs text-slate-500">Elige tu tipo de entrada</p>

          <div className="mt-4 space-y-3">
            {visibleTicketTypes.slice(0, 3).map((type) => (
              <div key={type.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900">{type.name}</p>
                  <p className="text-lg font-semibold text-blue-700">{centsToCurrency(type.priceCents)}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">Stock disponible: {type.stock}</p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <Link href={`/e/${event.slug}/checkout`} className="btn-primary w-full text-center">
              Ir al checkout
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
