import Link from "next/link";
import { VisitTracker } from "@/components/visit-tracker";

/* ── CSS-only animations (server-safe — no "use client") ─────────────────── */
const PAGE_STYLES = `
@keyframes pp-fade-up {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Staggered entrances */
.pp-seal   { animation: pp-fade-up 0.50s var(--ease-tactile) 0.05s both; }
.pp-kicker { animation: pp-fade-up 0.45s var(--ease-tactile) 0.14s both; }
.pp-h1     { animation: pp-fade-up 0.55s var(--ease-tactile) 0.22s both; }
.pp-sub    { animation: pp-fade-up 0.50s var(--ease-tactile) 0.30s both; }
.pp-order  { animation: pp-fade-up 0.50s var(--ease-tactile) 0.38s both; }
.pp-cta    { animation: pp-fade-up 0.45s var(--ease-tactile) 0.50s both; }
`;

/* ── Types ─────────────────────────────────────────────────────────────────── */
type Props = {
  searchParams?: Promise<{ event?: string | string[] }>;
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */
function resolveEventSlug(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/* ── Page ──────────────────────────────────────────────────────────────────── */
export default async function PendingPage({ searchParams }: Props) {
  const params    = (await searchParams) ?? {};
  const eventSlug = resolveEventSlug(params.event);
  const eventUrl  = eventSlug ? `/e/${encodeURIComponent(eventSlug)}` : null;

  const ctaHref  = eventUrl ?? "/";
  const ctaLabel = eventUrl ? "Volver al evento" : "Ir al inicio";

  return (
    <>
      <style>{PAGE_STYLES}</style>

      <div
        className="relative flex min-h-screen flex-col items-center justify-center px-4 py-16 sm:px-6 sm:py-20"
        style={{ background: "var(--bg-page)" }}
      >
        <VisitTracker step="pending" eventSlug={eventSlug} />

        {/* Subtle violet wash — top-right */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed right-0 top-0 -z-10"
          style={{
            width: "480px",
            height: "480px",
            background: "radial-gradient(circle at top right, rgba(139,92,246,0.06) 0%, transparent 70%)",
          }}
        />

        <div className="w-full max-w-[560px]">

          {/* ── SEAL ───────────────────────────────────────────────────── */}
          <div className="pp-seal flex flex-col items-center">
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full"
              style={{
                background: "#F59E0B",
                boxShadow: "0 0 0 12px rgba(245,158,11,0.12)",
              }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-label="Pago pendiente">
                <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2.2" />
                <path d="M12 7v5l3 3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* ── STATUS CHIP ────────────────────────────────────────────── */}
          <div className="pp-kicker mt-6 flex justify-center">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-semibold"
              style={{
                background: "rgba(245,158,11,0.10)",
                color: "var(--clr-warning-500)",
                border: "1px solid rgba(245,158,11,0.25)",
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--clr-warning-500)" }}
                aria-hidden="true"
              />
              Confirmación pendiente
            </span>
          </div>

          {/* ── HEADLINE ───────────────────────────────────────────────── */}
          <h1
            className="pp-h1 mt-4 text-center font-display font-extrabold tracking-tight"
            style={{
              color: "var(--text-primary)",
              fontSize: "clamp(2.25rem, 6vw, 3rem)",
              lineHeight: "1",
            }}
          >
            Pago en camino
          </h1>

          {/* ── SUBTEXT ────────────────────────────────────────────────── */}
          <p
            className="pp-sub mt-3 text-center text-[0.9375rem]"
            style={{ color: "var(--text-secondary)", lineHeight: "1.5" }}
          >
            Te avisamos por email cuando se confirme el cobro.
          </p>

          {/* ── ORDER CARD ─────────────────────────────────────────────── */}
          <div
            className="pp-order mt-8 w-full rounded-2xl bg-white"
            style={{ border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-sm)" }}
          >
            {/* Email notice band */}
            <div className="px-6 py-5">
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: "rgba(109,40,217,0.04)",
                  border: "1px solid rgba(109,40,217,0.12)",
                }}
              >
                <svg
                  className="h-[18px] w-[18px] shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--brand-violet)"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                  Tus tickets se emitirán automáticamente cuando se apruebe el pago.
                </p>
              </div>
            </div>

            {/* CTA */}
            <div style={{ borderTop: "1px solid var(--border-soft)" }} />
            <div className="pp-cta px-6 py-5">
              <Link
                href={ctaHref}
                className="flex w-full items-center justify-center rounded-full py-3.5 font-display text-[15px] font-bold text-white transition-transform duration-200 hover:-translate-y-0.5"
                style={{
                  background: "var(--grad-hero)",
                  boxShadow: "var(--shadow-glow-accent)",
                }}
              >
                {ctaLabel}
              </Link>
            </div>
          </div>

          {/* ── FOOTER ─────────────────────────────────────────────────── */}
          <p
            className="mt-8 text-center text-[11px]"
            style={{ color: "var(--text-muted)", opacity: 0.75 }}
          >
            © {new Date().getFullYear()} Tickets · by Aiderbrand
          </p>

        </div>
      </div>
    </>
  );
}
