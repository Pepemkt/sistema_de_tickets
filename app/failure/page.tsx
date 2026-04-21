import Link from "next/link";
import { VisitTracker } from "@/components/visit-tracker";

/* ── CSS-only animations (server-safe — no "use client") ─────────────────── */
const PAGE_STYLES = `
@keyframes fp-fade-up {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fp-x-draw {
  from { stroke-dashoffset: 32; opacity: 0; }
  to   { stroke-dashoffset: 0;  opacity: 1; }
}
@keyframes fp-details-open {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Staggered entrances */
.fp-seal    { animation: fp-fade-up 0.50s var(--ease-tactile) 0.05s both; }
.fp-kicker  { animation: fp-fade-up 0.45s var(--ease-tactile) 0.14s both; }
.fp-h1      { animation: fp-fade-up 0.55s var(--ease-tactile) 0.22s both; }
.fp-sub     { animation: fp-fade-up 0.50s var(--ease-tactile) 0.30s both; }
.fp-card    { animation: fp-fade-up 0.50s var(--ease-tactile) 0.38s both; }
.fp-cta     { animation: fp-fade-up 0.45s var(--ease-tactile) 0.52s both; }

/* X stroke draw-in */
.fp-x-path {
  stroke-dasharray: 32;
  stroke-dashoffset: 32;
  animation: fp-x-draw 0.40s var(--ease-tactile) 0.28s both;
}

/* Details accordion */
details.fp-details summary {
  list-style: none;
  cursor: pointer;
  user-select: none;
}
details.fp-details summary::-webkit-details-marker { display: none; }
details.fp-details .fp-chevron {
  transition: transform 0.20s var(--ease-tactile);
}
details.fp-details[open] .fp-chevron {
  transform: rotate(180deg);
}
details.fp-details[open] .fp-details-body {
  animation: fp-details-open 0.22s var(--ease-tactile) both;
}
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
export default async function FailurePage({ searchParams }: Props) {
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
        <VisitTracker step="failure" eventSlug={eventSlug} />

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
          <div className="fp-seal flex flex-col items-center">
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full"
              style={{
                background: "#E11D48",
                boxShadow: "0 0 0 12px rgba(225,29,72,0.10)",
              }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-label="Pago no completado">
                <line
                  className="fp-x-path"
                  x1="7" y1="7" x2="17" y2="17"
                  stroke="white"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <line
                  className="fp-x-path"
                  x1="17" y1="7" x2="7" y2="17"
                  stroke="white"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* ── STATUS CHIP ────────────────────────────────────────────── */}
          <div className="fp-kicker mt-6 flex justify-center">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-semibold"
              style={{
                background: "rgba(225,29,72,0.08)",
                color: "var(--clr-danger-500)",
                border: "1px solid rgba(225,29,72,0.20)",
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--clr-danger-500)" }}
                aria-hidden="true"
              />
              Pago no completado
            </span>
          </div>

          {/* ── HEADLINE ───────────────────────────────────────────────── */}
          <h1
            className="fp-h1 mt-4 text-center font-display font-extrabold tracking-tight"
            style={{
              color: "var(--text-primary)",
              fontSize: "clamp(2.25rem, 6vw, 3rem)",
              lineHeight: "1",
            }}
          >
            No pudimos procesar el pago
          </h1>

          {/* ── SUBTEXT ────────────────────────────────────────────────── */}
          <p
            className="fp-sub mt-3 text-center text-[0.9375rem]"
            style={{ color: "var(--text-secondary)", lineHeight: "1.5" }}
          >
            No se realizó ningún cargo. Probá de nuevo o elegí otro medio.
          </p>

          {/* ── CARD ───────────────────────────────────────────────────── */}
          <div
            className="fp-card mt-8 w-full rounded-2xl bg-white"
            style={{ border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-sm)" }}
          >
            {/* Razones comunes — collapsed by default */}
            <div className="px-6 py-5">
              <details className="fp-details">
                <summary className="flex items-center justify-between gap-3">
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Razones comunes
                  </span>
                  <svg
                    className="fp-chevron h-3.5 w-3.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <ul
                  className="fp-details-body mt-4 space-y-2.5 pl-1"
                >
                  {[
                    "Fondos insuficientes en la cuenta o tarjeta.",
                    "Tarjeta vencida, bloqueada o con límite diario alcanzado.",
                    "Rechazo del banco emisor para compras en plataformas online.",
                  ].map((reason) => (
                    <li
                      key={reason}
                      className="flex items-start gap-2.5 text-[13px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <span
                        className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: "var(--text-muted)" }}
                        aria-hidden="true"
                      />
                      {reason}
                    </li>
                  ))}
                </ul>
              </details>
            </div>

            {/* CTA */}
            <div style={{ borderTop: "1px solid var(--border-soft)" }} />
            <div className="fp-cta px-6 py-5">
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
