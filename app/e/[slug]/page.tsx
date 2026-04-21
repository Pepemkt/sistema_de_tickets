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

  const dateFormatted = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeStyle: "short" }).format(event.startsAt);
  const dayNum = new Intl.DateTimeFormat("es-AR", { day: "2-digit" }).format(event.startsAt);
  const monthAbbr = new Intl.DateTimeFormat("es-AR", { month: "short" }).format(event.startsAt).toUpperCase().replace(".", "");
  const yearNum = new Intl.DateTimeFormat("es-AR", { year: "numeric" }).format(event.startsAt);
  const timeFormatted = new Intl.DateTimeFormat("es-AR", { timeStyle: "short" }).format(event.startsAt);

  const featureTagsArr = (Array.isArray(event.featureTags) ? event.featureTags : [])
    .map((item) => String(item).trim())
    .filter(Boolean);

  return (
    <>
      <style>{`
        @keyframes hero-fade-up {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes hero-line-grow {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes badge-pop {
          0%   { opacity: 0; transform: scale(0.82); }
          70%  { transform: scale(1.04); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes mesh-drift {
          0%, 100% { transform: translate(0,0) scale(1); }
          33%       { transform: translate(3%, 2%) scale(1.03); }
          66%       { transform: translate(-2%, 3%) scale(0.98); }
        }
        @keyframes card-reveal {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hero-tag   { animation: badge-pop    0.5s var(--ease-spring) 0.1s both; }
        .hero-title { animation: hero-fade-up 0.7s var(--ease-tactile) 0.25s both; }
        .hero-meta  { animation: hero-fade-up 0.7s var(--ease-tactile) 0.4s both; }
        .hero-ctas  { animation: hero-fade-up 0.7s var(--ease-tactile) 0.52s both; }
        .hero-mesh  { animation: mesh-drift 14s ease-in-out infinite; }
        .hero-line  {
          transform-origin: left;
          animation: hero-line-grow 0.8s var(--ease-tactile) 0.3s both;
        }
        .ticket-card {
          animation: card-reveal 0.55s var(--ease-tactile) both;
        }
        .ticket-card:nth-child(1) { animation-delay: 0.05s; }
        .ticket-card:nth-child(2) { animation-delay: 0.12s; }
        .ticket-card:nth-child(3) { animation-delay: 0.19s; }
        .feature-chip {
          animation: card-reveal 0.5s var(--ease-tactile) both;
        }
        .feature-chip:nth-child(1) { animation-delay: 0.05s; }
        .feature-chip:nth-child(2) { animation-delay: 0.10s; }
        .feature-chip:nth-child(3) { animation-delay: 0.15s; }
        .feature-chip:nth-child(4) { animation-delay: 0.20s; }
        .feature-chip:nth-child(5) { animation-delay: 0.25s; }
        .feature-chip:nth-child(6) { animation-delay: 0.30s; }
        .ticket-hover {
          transition: transform 0.2s var(--ease-tactile), box-shadow 0.2s var(--ease-tactile), border-color 0.15s ease;
        }
        .ticket-hover:hover {
          transform: translateX(4px);
          box-shadow: var(--shadow-md);
          border-color: rgba(236,42,138,0.35);
        }
      `}</style>

      <div className="min-h-screen bg-page">
        <VisitTracker step="event_page" eventSlug={event.slug} />

        {/* ── NAV ─────────────────────────────────────────────────────── */}
        <header className="absolute left-0 right-0 top-0 z-20">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="font-display text-title-m font-extrabold tracking-tight text-white drop-shadow-sm">
              Tickets<span className="text-[color:var(--brand-magenta)]">.</span>
            </Link>
            <Link href="/login" className="rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-caption font-semibold text-white backdrop-blur-sm transition-all duration-base hover:bg-white/20">
              Iniciar sesion
            </Link>
          </div>
        </header>

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section className="relative isolate min-h-[88vh] overflow-hidden">
          {/* Background image or gradient */}
          {event.heroImageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.heroImageUrl}
                alt={event.name}
                className="absolute inset-0 -z-30 h-full w-full object-cover"
              />
              {/* Deep cinematic overlay */}
              <div className="absolute inset-0 -z-20 bg-gradient-to-t from-[color:var(--brand-violet-deep)] via-[color:var(--brand-violet-deep)]/75 to-[color:var(--brand-violet-deep)]/40" />
              {/* Side vignette */}
              <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[color:var(--brand-violet-deep)]/60 via-transparent to-transparent" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 -z-20 bg-hero-gradient" />
              {/* Animated mesh blobs */}
              <div className="hero-mesh absolute -z-10 inset-0 pointer-events-none">
                <div className="absolute -top-32 -right-32 h-[600px] w-[600px] rounded-full bg-[color:var(--brand-magenta)]/20 blur-[120px]" />
                <div className="absolute -bottom-24 -left-24 h-[500px] w-[500px] rounded-full bg-forest-800/60 blur-[100px]" />
              </div>
            </>
          )}

          {/* Noise texture overlay */}
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035]"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")", backgroundSize: "200px 200px" }}
          />

          {/* Content */}
          <div className="mx-auto flex min-h-[88vh] w-full max-w-6xl flex-col justify-end px-4 pb-16 pt-28 sm:px-6 lg:pb-20">
            {/* Date block — floated top-right on desktop */}
            <div className="mb-8 hidden lg:absolute lg:right-8 lg:top-1/2 lg:mb-0 lg:flex lg:-translate-y-1/2 lg:flex-col lg:items-center lg:rounded-2xl lg:border lg:border-white/15 lg:bg-white/10 lg:px-6 lg:py-5 lg:text-center lg:backdrop-blur-md">
              <span className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--brand-magenta)]">{monthAbbr}</span>
              <span className="font-display text-[56px] font-extrabold leading-none tracking-tight text-white">{dayNum}</span>
              <span className="mt-1 font-display text-[13px] font-semibold text-white/60">{yearNum}</span>
              <div className="my-3 h-px w-8 bg-white/20" />
              <span className="font-display text-[13px] font-bold text-white/80">{timeFormatted}</span>
            </div>

            {/* Tags row */}
            <div className="hero-tag flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--brand-magenta)]/50 bg-[color:var(--brand-magenta)]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--brand-magenta)] backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--brand-magenta)] animate-pulse" />
                {event.featuredTag?.trim() || "Evento destacado"}
              </span>
              {isUpcoming && (
                <span className="inline-flex items-center rounded-full bg-warning-50/95 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-warning-700">
                  Proximamente
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="hero-title mt-5 max-w-[680px] font-display font-extrabold leading-[0.97] tracking-tight text-white" style={{ fontSize: "clamp(2.8rem, 7vw, 5.5rem)" }}>
              {event.name}
            </h1>

            {/* Accent line */}
            <div className="hero-line mt-5 h-[3px] w-16 rounded-full bg-[color:var(--brand-magenta)]" />

            {/* Meta */}
            <p className="hero-meta mt-4 text-body text-white/70">
              <span className="font-semibold text-white/90">{dateFormatted}</span>
              {event.venue && (
                <>
                  <span className="mx-3 text-white/30">·</span>
                  <span>{event.venue}</span>
                </>
              )}
            </p>

            {/* CTA row */}
            <div className="hero-ctas mt-8 flex flex-wrap items-center gap-4">
              {/* Price bubble */}
              <div className="rounded-xl border border-white/15 bg-white/10 px-5 py-3 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">Desde</p>
                <p className="mt-0.5 font-display text-title-l font-extrabold text-white">
                  {startingPrice > 0 ? centsToCurrency(startingPrice) : "Gratis"}
                </p>
              </div>

              {isActive ? (
                <Link
                  href={`/e/${event.slug}/checkout`}
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-[color:var(--brand-magenta)] px-8 py-3.5 font-display text-[15px] font-bold text-white shadow-[var(--shadow-glow-accent)] transition-all duration-base hover:-translate-y-0.5 hover:bg-[color:var(--brand-magenta-dark)] hover:shadow-[0_12px_32px_rgba(236,42,138,0.5)]"
                >
                  <svg className="h-4 w-4 transition-transform duration-base group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H4" />
                  </svg>
                  Comprar entradas
                </Link>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-3 text-body-s font-semibold text-white/70 backdrop-blur-sm">
                  <svg className="h-4 w-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Compra no habilitada aun
                </span>
              )}
            </div>
          </div>

          {/* Bottom fade into page bg */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[color:var(--bg-page)] to-transparent pointer-events-none" />
        </section>

        {/* ── BODY ─────────────────────────────────────────────────────── */}
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1fr_360px] sm:px-6">

          {/* LEFT: About + Feature tags */}
          <article className="space-y-10">
            {/* About */}
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--brand-violet)]">Sobre el evento</p>
              <p className="whitespace-pre-line text-body-l leading-relaxed text-secondary">
                {event.description ?? "Sin descripcion disponible por el momento."}
              </p>
            </div>

            {/* Feature tags */}
            {featureTagsArr.length > 0 && (
              <div>
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--brand-violet)]">Incluye</p>
                <div className="flex flex-wrap gap-2.5">
                  {featureTagsArr.map((item, idx) => (
                    <div
                      key={item}
                      className="feature-chip inline-flex items-center gap-2 rounded-full border border-forest-100 bg-forest-50 px-4 py-2 text-body-s font-semibold text-[color:var(--brand-violet)]"
                      style={{ animationDelay: `${0.05 + idx * 0.055}s` }}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-violet)]/50" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Date + venue detail strip */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-start gap-3 rounded-xl border border-soft bg-surface p-4 shadow-xs">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-forest-50 text-[color:var(--brand-violet)]">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Fecha</p>
                  <p className="mt-0.5 text-body-s font-semibold text-primary">{dateFormatted}</p>
                </div>
              </div>
              {event.venue && (
                <div className="flex items-start gap-3 rounded-xl border border-soft bg-surface p-4 shadow-xs">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-forest-50 text-[color:var(--brand-violet)]">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Lugar</p>
                    <p className="mt-0.5 text-body-s font-semibold text-primary">{event.venue}</p>
                  </div>
                </div>
              )}
            </div>
          </article>

          {/* RIGHT: Ticket selector sidebar */}
          <aside className="h-fit lg:sticky lg:top-6">
            {/* Card */}
            <div className="overflow-hidden rounded-2xl border border-soft bg-surface shadow-xl">
              {/* Header strip */}
              <div className="bg-gradient-to-r from-forest-800 to-[color:var(--brand-violet)] px-6 py-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">Entradas disponibles</p>
                <p className="mt-1 font-display text-title-m font-extrabold text-white">{event.name}</p>
              </div>

              {/* Perforation divider */}
              <div className="relative flex items-center overflow-hidden bg-surface">
                <div className="absolute -left-3 h-6 w-6 rounded-full bg-page" />
                <div className="flex-1 border-t-2 border-dashed border-soft mx-3" />
                <div className="absolute -right-3 h-6 w-6 rounded-full bg-page" />
              </div>

              {/* Ticket type list */}
              <div className="space-y-3 px-5 py-5">
                {visibleTicketTypes.slice(0, 3).map((type) => (
                  <div
                    key={type.id}
                    className="ticket-card ticket-hover flex items-center justify-between gap-3 rounded-xl border border-soft bg-sunken px-4 py-3.5"
                  >
                    <div>
                      <p className="text-body-s font-bold text-primary">{type.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted">{type.stock} disponibles</p>
                    </div>
                    <p className="shrink-0 font-display text-title-s font-extrabold text-[color:var(--brand-magenta)]">
                      {centsToCurrency(type.priceCents)}
                    </p>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="px-5 pb-6">
                {isActive ? (
                  <Link
                    href={`/e/${event.slug}/checkout`}
                    className="group flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--brand-magenta)] py-3.5 font-display text-[15px] font-bold text-white shadow-[var(--shadow-glow-accent)] transition-all duration-base hover:-translate-y-0.5 hover:bg-[color:var(--brand-magenta-dark)]"
                  >
                    Ir al checkout
                    <svg className="h-4 w-4 transition-transform duration-base group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                ) : (
                  <div className="rounded-xl border border-warning-500/30 bg-warning-50 px-4 py-3 text-body-s text-warning-700">
                    Este evento esta en estado <strong>{isUpcoming ? "Proximamente" : event.status}</strong> y aun no admite compras online.
                  </div>
                )}
                <p className="mt-3 text-center text-[11px] text-muted">Pago seguro vía Mercado Pago</p>
              </div>
            </div>
          </aside>
        </section>

        {/* ── FOOTER ───────────────────────────────────────────────────── */}
        <footer className="border-t border-soft px-4 py-8 text-center text-caption text-muted sm:px-6">
          © {new Date().getFullYear()} Tickets. Todos los derechos reservados.
        </footer>
      </div>
    </>
  );
}
