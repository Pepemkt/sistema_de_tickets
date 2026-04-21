import { notFound } from "next/navigation";
import { requireAnyPageRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { centsToCurrency } from "@/lib/utils";
import { CheckoutCard } from "@/components/checkout-card";
import { requireViewerEventAccess } from "@/lib/event-scope";

/* ─────────────────────────────────────────────────────────────────────────────
   CSS-ONLY ANIMATIONS — server component safe
───────────────────────────────────────────────────────────────────────────── */
const PAGE_STYLES = `
@keyframes ev-fade-up {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ev-slide-in {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes ev-slide-right {
  from { opacity: 0; transform: translateX(12px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes ev-line-grow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
@keyframes ev-badge-pop {
  0%   { opacity: 0; transform: scale(0.8); }
  70%  { transform: scale(1.05); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes ev-card-in {
  from { opacity: 0; transform: translateY(14px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes ev-mesh-drift {
  0%, 100% { transform: translate(0,0) scale(1); }
  40%       { transform: translate(2%, 1.5%) scale(1.02); }
  80%       { transform: translate(-1.5%, 2%) scale(0.99); }
}
@keyframes ev-dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.45; transform: scale(0.7); }
}

.ev-hero-tag   { animation: ev-badge-pop  0.5s  var(--ease-spring)  0.08s both; }
.ev-hero-name  { animation: ev-fade-up    0.7s  var(--ease-tactile) 0.22s both; }
.ev-hero-line  {
  transform-origin: left;
  animation: ev-line-grow 0.75s var(--ease-tactile) 0.32s both;
}
.ev-hero-meta  { animation: ev-fade-up    0.65s var(--ease-tactile) 0.42s both; }
.ev-mesh       { animation: ev-mesh-drift 18s   ease-in-out infinite; }

.ev-left       { animation: ev-slide-in   0.55s var(--ease-tactile) 0.28s both; }
.ev-right      { animation: ev-slide-right 0.55s var(--ease-tactile) 0.36s both; }

.ev-ticket-card { animation: ev-card-in 0.5s var(--ease-spring) both; }
.ev-ticket-card:nth-child(1) { animation-delay: 0.10s; }
.ev-ticket-card:nth-child(2) { animation-delay: 0.17s; }
.ev-ticket-card:nth-child(3) { animation-delay: 0.24s; }
.ev-ticket-card:nth-child(4) { animation-delay: 0.31s; }

.ev-stock-bar {
  height: 3px;
  background: var(--border-soft);
  border-radius: 9999px;
  overflow: hidden;
  margin-top: 10px;
}
.ev-stock-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.6s var(--ease-tactile);
}

.ev-ticket-card {
  transition: transform 0.2s var(--ease-tactile),
              box-shadow 0.2s var(--ease-tactile),
              border-color 0.15s ease;
}
.ev-ticket-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(21,22,43,0.08), 0 2px 6px rgba(236,42,138,0.07);
  border-color: rgba(236,42,138,0.30);
}

.ev-access-chip { animation: ev-badge-pop 0.45s var(--ease-spring) 0.52s both; }

/* Revenue-style gradient text */
.ev-price-gradient {
  background: var(--grad-hero);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Coupon-only badge */
.ev-coupon-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 1px solid rgba(245,158,11,0.35);
  background: rgba(255,244,224,0.9);
  color: #9B5F17;
}

/* Mode badge PUBLIC */
.ev-public-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 1px solid rgba(31,174,74,0.28);
  background: rgba(233,249,238,0.9);
  color: #117A30;
}

.ev-dot-pulse { animation: ev-dot-pulse 2.4s ease-in-out infinite; }

/* Description editorial */
.ev-description {
  line-height: 1.75;
  font-size: 0.9375rem;
  color: var(--text-secondary);
  white-space: pre-line;
}
`;

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

  const dateFormatted = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(event.startsAt);

  const dayNum = new Intl.DateTimeFormat("es-AR", { day: "2-digit" }).format(event.startsAt);
  const monthAbbr = new Intl.DateTimeFormat("es-AR", { month: "short" })
    .format(event.startsAt)
    .toUpperCase()
    .replace(".", "");
  const timeFormatted = new Intl.DateTimeFormat("es-AR", { timeStyle: "short" }).format(event.startsAt);

  /* Stock bar helpers */
  function stockPercent(stock: number, maxStock = 200): number {
    if (maxStock <= 0) return 100;
    return Math.min(100, Math.round((stock / maxStock) * 100));
  }

  function stockBarColor(stock: number): string {
    if (stock === 0) return "#E11D48";
    if (stock <= 10) return "#F59E0B";
    return "#EC2A8A";
  }

  return (
    <>
      <style>{PAGE_STYLES}</style>

      <div className="space-y-0">

        {/* ── CINEMATIC HERO ─────────────────────────────────────────────── */}
        <section className="relative isolate overflow-hidden rounded-2xl" style={{ minHeight: "340px" }}>

          {/* Background */}
          {event.heroImageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.heroImageUrl}
                alt={event.name}
                className="absolute inset-0 -z-30 h-full w-full object-cover"
              />
              <div
                className="absolute inset-0 -z-20"
                style={{
                  background: "linear-gradient(to top, var(--clr-arena-800) 0%, rgba(12,13,28,0.72) 55%, rgba(12,13,28,0.35) 100%)"
                }}
              />
              <div
                className="absolute inset-0 -z-10"
                style={{ background: "linear-gradient(to right, rgba(12,13,28,0.55) 0%, transparent 60%)" }}
              />
            </>
          ) : (
            <>
              {/* Dark cinematic gradient background */}
              <div
                className="absolute inset-0 -z-20"
                style={{ background: "linear-gradient(135deg, #0C0D1C 0%, #1E0B4A 50%, #0C0D1C 100%)" }}
              />
              {/* Animated mesh glows */}
              <div className="ev-mesh pointer-events-none absolute inset-0 -z-10">
                <div
                  className="absolute -top-20 -right-20 rounded-full"
                  style={{
                    width: "480px",
                    height: "480px",
                    background: "rgba(236,42,138,0.18)",
                    filter: "blur(100px)"
                  }}
                />
                <div
                  className="absolute -bottom-16 -left-16 rounded-full"
                  style={{
                    width: "360px",
                    height: "360px",
                    background: "rgba(91,33,182,0.25)",
                    filter: "blur(90px)"
                  }}
                />
              </div>
            </>
          )}

          {/* Noise grain */}
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
            style={{
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              backgroundSize: "180px 180px"
            }}
          />

          {/* Hero content */}
          <div className="relative flex min-h-[340px] flex-col justify-end px-7 pb-8 pt-10 sm:px-8">

            {/* Date chip floated top-right */}
            <div
              className="absolute right-7 top-7 hidden sm:flex flex-col items-center rounded-2xl px-5 py-4 text-center"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)"
              }}
            >
              <span
                className="font-display text-[10px] font-extrabold uppercase tracking-[0.18em]"
                style={{ color: "var(--brand-magenta)" }}
              >
                {monthAbbr}
              </span>
              <span
                className="font-display font-extrabold leading-none tracking-tight text-white"
                style={{ fontSize: "42px" }}
              >
                {dayNum}
              </span>
              <div className="my-2.5 h-px w-7 bg-white/20" />
              <span
                className="font-display font-bold text-white/75"
                style={{ fontSize: "12px" }}
              >
                {timeFormatted}
              </span>
            </div>

            {/* Access chip */}
            <div className="ev-access-chip mb-4 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
                style={{
                  background: "rgba(236,42,138,0.15)",
                  border: "1px solid rgba(236,42,138,0.40)",
                  backdropFilter: "blur(8px)"
                }}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--brand-magenta)" }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span
                  className="font-display text-[10px] font-extrabold uppercase tracking-[0.14em]"
                  style={{ color: "var(--brand-magenta)" }}
                >
                  Acceso staff
                </span>
                <span
                  className="ev-dot-pulse h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--brand-magenta)" }}
                />
              </span>
            </div>

            {/* Event name */}
            <h1
              className="ev-hero-name font-display font-extrabold leading-[0.96] tracking-tight text-white"
              style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", maxWidth: "680px" }}
            >
              {event.name}
            </h1>

            {/* Accent line */}
            <div
              className="ev-hero-line mt-4 h-[3px] w-14 rounded-full"
              style={{ background: "var(--brand-magenta)" }}
            />

            {/* Meta row */}
            <div className="ev-hero-meta mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {/* Date */}
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-white/80">
                <svg className="h-3.5 w-3.5 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {dateFormatted}
              </span>

              {event.venue && (
                <>
                  <span className="text-white/25 text-lg leading-none">·</span>
                  <span className="flex items-center gap-1.5 text-[13px] text-white/60">
                    <svg className="h-3.5 w-3.5 text-white/35" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {event.venue}
                  </span>
                </>
              )}
            </div>

          </div>

          {/* Bottom page-blend fade */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-10"
            style={{ background: "linear-gradient(to top, var(--bg-page), transparent)" }}
          />
        </section>

        {/* ── BODY GRID ──────────────────────────────────────────────────── */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">

          {/* ── LEFT: INFO + TICKET TYPES ── */}
          <div className="ev-left space-y-6">

            {/* Description panel */}
            <section
              className="relative overflow-hidden rounded-2xl border bg-surface shadow-sm"
              style={{ borderColor: "var(--border-soft)" }}
            >
              {/* Top stripe */}
              <div
                className="absolute inset-x-0 top-0 h-[2.5px] rounded-t-2xl"
                style={{ background: "var(--grad-hero)" }}
                aria-hidden="true"
              />
              {/* Ambient glow */}
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full"
                style={{ background: "rgba(91,33,182,0.055)", filter: "blur(60px)" }}
                aria-hidden="true"
              />

              <div className="px-6 pb-6 pt-7">
                <p
                  className="mb-3 font-display text-[10px] font-extrabold uppercase tracking-[0.18em]"
                  style={{ color: "var(--brand-violet)" }}
                >
                  Descripcion del evento
                </p>
                <p className="ev-description">
                  {event.description ?? "Sin descripcion disponible."}
                </p>
              </div>
            </section>

            {/* Ticket types grid */}
            {visibleTicketTypes.length > 0 && (
              <section
                className="relative overflow-hidden rounded-2xl border bg-surface shadow-sm"
                style={{ borderColor: "var(--border-soft)" }}
              >
                {/* Top micro-stripe */}
                <div
                  className="absolute inset-x-0 top-0 h-[2.5px] rounded-t-2xl"
                  style={{ background: "var(--brand-magenta)" }}
                  aria-hidden="true"
                />

                <div className="px-6 pb-6 pt-7">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <p
                      className="font-display text-[10px] font-extrabold uppercase tracking-[0.18em]"
                      style={{ color: "var(--brand-magenta)" }}
                    >
                      Tipos de entrada
                    </p>
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold"
                      style={{
                        borderColor: "rgba(236,42,138,0.25)",
                        background: "rgba(255,232,242,0.6)",
                        color: "var(--brand-magenta)"
                      }}
                    >
                      <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" />
                      </svg>
                      {visibleTicketTypes.length} tipo{visibleTicketTypes.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {visibleTicketTypes.map((type) => {
                      const pct = stockPercent(type.stock);
                      const fillColor = stockBarColor(type.stock);
                      return (
                        <div
                          key={type.id}
                          className="ev-ticket-card rounded-xl border p-4"
                          style={{
                            borderColor: "var(--border-soft)",
                            background: "var(--bg-sunken)"
                          }}
                        >
                          {/* Name + mode badges */}
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>
                              {type.name}
                            </p>
                            {type.saleMode === "COUPON_ONLY" ? (
                              <span className="ev-coupon-badge shrink-0">
                                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                  <line x1="7" y1="7" x2="7.01" y2="7" />
                                </svg>
                                Cupón
                              </span>
                            ) : (
                              <span className="ev-public-badge shrink-0">
                                <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                                Público
                              </span>
                            )}
                          </div>

                          {/* Price */}
                          <p
                            className="mt-2 font-display text-[1.35rem] font-extrabold leading-none tracking-tight ev-price-gradient"
                          >
                            {centsToCurrency(type.priceCents)}
                          </p>

                          {/* Stock bar */}
                          <div className="ev-stock-bar">
                            <div
                              className="ev-stock-fill"
                              style={{
                                width: `${pct}%`,
                                background: fillColor
                              }}
                            />
                          </div>

                          {/* Stock count */}
                          <p
                            className="mt-2 text-[11px] font-semibold"
                            style={{ color: type.stock === 0 ? "var(--clr-danger-500)" : type.stock <= 10 ? "var(--clr-warning-700)" : "var(--text-muted)" }}
                          >
                            {type.stock === 0 ? "Agotado" : `${type.stock} disponibles`}
                          </p>

                          {/* Limit chips */}
                          {(type.maxPerOrder || type.maxPerEmail) && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {type.maxPerOrder && (
                                <span
                                  className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold"
                                  style={{
                                    borderColor: "var(--border-strong)",
                                    color: "var(--text-secondary)",
                                    background: "var(--bg-surface)"
                                  }}
                                >
                                  <svg className="h-2.5 w-2.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                                    <line x1="1" y1="10" x2="23" y2="10" />
                                  </svg>
                                  Máx. {type.maxPerOrder} por compra
                                </span>
                              )}
                              {type.maxPerEmail && (
                                <span
                                  className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold"
                                  style={{
                                    borderColor: "var(--border-strong)",
                                    color: "var(--text-secondary)",
                                    background: "var(--bg-surface)"
                                  }}
                                >
                                  <svg className="h-2.5 w-2.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                  </svg>
                                  Máx. {type.maxPerEmail} por email
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* No tickets state */}
            {visibleTicketTypes.length === 0 && (
              <div
                className="rounded-2xl border px-6 py-10 text-center"
                style={{
                  borderColor: "rgba(245,158,11,0.30)",
                  background: "rgba(255,244,224,0.6)"
                }}
              >
                <svg
                  className="mx-auto mb-3 h-10 w-10 opacity-40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ color: "#9B5F17" }}
                >
                  <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" />
                </svg>
                <p className="font-display font-bold" style={{ color: "#9B5F17" }}>Sin entradas habilitadas</p>
                <p className="mt-1 text-[13px]" style={{ color: "#9B5F17", opacity: 0.8 }}>
                  Este evento no tiene tipos de entrada visibles para compra.
                </p>
              </div>
            )}
          </div>

          {/* ── RIGHT: CHECKOUT CARD sticky ── */}
          <aside className="ev-right h-fit lg:sticky lg:top-6">
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
          </aside>

        </div>
      </div>
    </>
  );
}
