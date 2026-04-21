import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { centsToCurrency } from "@/lib/utils";
import { VisitTracker } from "@/components/visit-tracker";

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
  if (event.status === "DRAFT") notFound();

  const visibleTicketTypes = event.ticketTypes.filter((type) => type.saleMode !== "HIDDEN");
  const startingPrice = visibleTicketTypes[0]?.priceCents ?? 0;
  const isActive = event.status === "ACTIVE";
  const isUpcoming = event.status === "UPCOMING";

  return (
    <div className="bg-page">
      <VisitTracker step="event_page" eventSlug={event.slug} />
      <header className="border-b border-soft bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="font-display text-title-m font-extrabold tracking-tight text-primary">
            EventHub
          </Link>
          <Link href="/login" className="btn-primary--sm">
            Iniciar sesion
          </Link>
        </div>
      </header>

      <section className="relative isolate min-h-[72vh] overflow-hidden">
        {event.heroImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.heroImageUrl} alt={event.name} className="absolute inset-0 -z-20 h-full w-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[color:var(--brand-violet-deep)]/60 via-[color:var(--brand-violet-deep)]/55 to-[color:var(--brand-violet-deep)]/90" />
          </>
        ) : (
          <div className="absolute inset-0 -z-10 bg-hero-gradient" />
        )}

        <div className="mx-auto flex min-h-[72vh] w-full max-w-6xl items-end px-4 py-14 sm:px-6">
          <div>
            <p className="inline-flex rounded-full border border-white/25 bg-white/15 px-3 py-1 text-caption font-semibold uppercase tracking-wide text-white backdrop-blur">
              {event.featuredTag?.trim() || "Evento destacado"}
            </p>
            {isUpcoming && (
              <p className="ml-2 inline-flex rounded-full bg-warning-50/95 px-3 py-1 text-caption font-semibold uppercase tracking-wide text-warning-700">
                Proximamente
              </p>
            )}
            <h1 className="mt-4 max-w-3xl font-display text-[56px] font-extrabold leading-[1.05] tracking-tight text-white">
              {event.name}
            </h1>
            <p className="mt-3 text-body text-white/85">
              {new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeStyle: "short" }).format(event.startsAt)} · {event.venue ?? "Lugar por confirmar"}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <div className="rounded-md bg-white/10 px-5 py-3 text-white backdrop-blur">
                <p className="text-overline font-semibold uppercase tracking-[0.1em] text-white/70">Desde</p>
                <p className="font-display text-title-l font-bold">{startingPrice > 0 ? centsToCurrency(startingPrice) : "Gratis"}</p>
              </div>
              {isActive ? (
                <Link href={`/e/${event.slug}/checkout`} className="btn-primary">
                  Comprar entradas
                </Link>
              ) : (
                <span className="rounded-full bg-white/80 px-6 py-2.5 text-body-s font-semibold text-primary">
                  Compra no habilitada aun
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[1fr_340px] sm:px-6">
        <article>
          <h2 className="font-display text-title-xl font-bold text-primary">Sobre el evento</h2>
          <p className="mt-4 whitespace-pre-line text-body text-secondary">{event.description ?? "Sin descripcion disponible por el momento."}</p>

          {(Array.isArray(event.featureTags) ? event.featureTags : []).map((item) => String(item).trim()).filter(Boolean).length > 0 && (
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(Array.isArray(event.featureTags) ? event.featureTags : [])
                .map((item) => String(item).trim())
                .filter(Boolean)
                .map((item) => (
                  <div key={item} className="rounded-md border border-soft bg-surface p-4 text-center text-body-s font-medium text-secondary shadow-sm">
                    {item}
                  </div>
                ))}
            </div>
          )}
        </article>

        <aside className="panel h-fit lg:sticky lg:top-6">
          <h3 className="font-display text-title-m font-bold text-primary">Seleccion de entradas</h3>
          <p className="mt-1 text-caption text-muted">Elige tu tipo de entrada</p>

          <div className="mt-4 space-y-3">
            {visibleTicketTypes.slice(0, 3).map((type) => (
              <div key={type.id} className="rounded-md border border-soft bg-sunken p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-body-s font-semibold text-primary">{type.name}</p>
                  <p className="font-display text-title-s font-bold text-[color:var(--brand-magenta)]">{centsToCurrency(type.priceCents)}</p>
                </div>
                <p className="mt-1 text-caption text-muted">Stock disponible: {type.stock}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            {isActive ? (
              <Link href={`/e/${event.slug}/checkout`} className="btn-primary w-full text-center">
                Ir al checkout
              </Link>
            ) : (
              <p className="rounded-md border border-warning-500/40 bg-warning-50 px-4 py-3 text-body-s text-warning-700">
                Este evento esta en estado {isUpcoming ? "Proximamente" : event.status} y aun no admite compras online.
              </p>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
