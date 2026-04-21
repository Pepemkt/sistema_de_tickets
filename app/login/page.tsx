import { redirect } from "next/navigation";
import { getCurrentViewer } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

/* ── Keyframes for the page-level backdrop (CSS-only, server-safe) ───────── */
const PAGE_STYLES = `
@keyframes lp-mesh-drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%       { transform: translate(2.5%, 1.5%) scale(1.04); }
  66%       { transform: translate(-1.5%, 2.5%) scale(0.97); }
}
@keyframes lp-card-in {
  from { opacity: 0; transform: translateY(32px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}
@keyframes lp-left-in {
  from { opacity: 0; transform: translateX(-24px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes lp-grain {
  0%   { transform: translate(0, 0); }
  10%  { transform: translate(-2%, -3%); }
  20%  { transform: translate(1%, 2%); }
  30%  { transform: translate(3%, -1%); }
  40%  { transform: translate(-1%, 3%); }
  50%  { transform: translate(2%, 1%); }
  60%  { transform: translate(-3%, 2%); }
  70%  { transform: translate(1%, -2%); }
  80%  { transform: translate(-2%, 1%); }
  90%  { transform: translate(2%, -3%); }
  100% { transform: translate(0, 0); }
}

/* Animated mesh layer */
.lp-mesh { animation: lp-mesh-drift 18s ease-in-out infinite; }

/* Card entry */
.lp-card { animation: lp-card-in 0.7s var(--ease-tactile) 0.08s both; }

/* Left panel editorial content */
.lp-left { animation: lp-left-in 0.8s var(--ease-tactile) 0.12s both; }

/* Grain overlay — adds cinematic texture */
.lp-grain {
  position: absolute;
  inset: -50%;
  width: 200%;
  height: 200%;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-size: 200px 200px;
  opacity: 0.025;
  animation: lp-grain 0.6s steps(1) infinite;
  pointer-events: none;
}

/* Feature pill on the left side */
.lp-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.875rem;
  border-radius: 9999px;
  border: 1px solid rgba(236,42,138,0.35);
  background: rgba(236,42,138,0.12);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--brand-magenta);
  backdrop-filter: blur(6px);
}
`;

export default async function LoginPage() {
  const viewer = await getCurrentViewer();

  if (viewer) {
    redirect(
      viewer.role === "ADMIN" || viewer.role === "MANAGER"
        ? "/admin"
        : viewer.role === "SELLER"
          ? "/sales"
          : "/scan"
    );
  }

  return (
    <>
      <style>{PAGE_STYLES}</style>

      {/* Full-viewport light cinematic shell */}
      <div className="relative isolate flex min-h-screen overflow-hidden" style={{ background: "var(--bg-page)" }}>

        {/* ── AMBIENT MESH BACKGROUND ─────────────────────────────────── */}
        <div className="lp-mesh pointer-events-none absolute inset-0 -z-10">
          {/* Primary magenta blob — top right */}
          <div
            className="absolute -right-32 -top-32 rounded-full blur-[140px]"
            style={{ width: "640px", height: "640px", background: "rgba(236,42,138,0.08)" }}
            aria-hidden="true"
          />
          {/* Violet blob — bottom left */}
          <div
            className="absolute -bottom-40 -left-40 rounded-full blur-[120px]"
            style={{ width: "560px", height: "560px", background: "rgba(91,33,182,0.10)" }}
            aria-hidden="true"
          />
          {/* Soft centre violet glow */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[180px]"
            style={{ width: "480px", height: "480px", background: "rgba(139,92,246,0.10)" }}
            aria-hidden="true"
          />
        </div>

        {/* Animated film grain */}
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none" }}>
          <div className="lp-grain" />
        </div>

        {/* ── SPLIT LAYOUT ────────────────────────────────────────────── */}
        <div className="relative z-10 flex w-full flex-col lg:flex-row">

          {/* LEFT PANEL — editorial brand column */}
          <div className="lp-left hidden lg:flex lg:flex-1 lg:flex-col lg:justify-between lg:px-14 lg:py-14 xl:px-20">

            {/* Top: wordmark */}
            <div>
              <div className="flex items-center gap-2.5">
                {/* Abstract ticket icon */}
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: "var(--grad-hero)" }}
                  aria-hidden="true"
                >
                  <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" />
                  </svg>
                </div>
                <span className="font-display text-[1.1rem] font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  Tickets<span style={{ color: "var(--brand-magenta)" }}>.</span>
                </span>
              </div>
            </div>

            {/* Middle: editorial headline + features */}
            <div className="space-y-8">
              {/* Big editorial headline */}
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--brand-magenta)" }}>
                  Sistema de eventos
                </p>
                <h2
                  className="mt-4 font-display font-extrabold leading-[0.97] tracking-tight"
                  style={{ color: "var(--text-primary)", fontSize: "clamp(2.5rem, 4vw, 3.75rem)" }}
                >
                  Gestioná<br />
                  cada evento<br />
                  <span style={{ background: "var(--grad-hero)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    sin fricciones.
                  </span>
                </h2>

                {/* Accent line */}
                <div
                  className="mt-5 h-[3px] w-14 rounded-full"
                  style={{ background: "var(--grad-hero)", transformOrigin: "left" }}
                  aria-hidden="true"
                />

                <p className="mt-5 max-w-xs text-[0.9375rem] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  Ventas, escaneo, liquidaciones y analítica en una sola plataforma.
                </p>
              </div>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-2.5">
                {[
                  { icon: "🎟", label: "Venta de entradas" },
                  { icon: "📲", label: "Escaneo QR" },
                  { icon: "📊", label: "Analítica" },
                ].map(({ icon, label }) => (
                  <span key={label} className="lp-pill">
                    <span role="img" aria-hidden="true">{icon}</span>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom: subtle legal footer */}
            <p className="text-[0.6875rem]" style={{ color: "var(--text-muted)", opacity: 0.8 }}>
              © {new Date().getFullYear()} Aiderbrand · Uso interno
            </p>
          </div>

          {/* ── RIGHT PANEL — form card ──────────────────────────────── */}
          <div className="flex flex-1 items-center justify-center px-4 py-16 sm:px-8 lg:max-w-[520px] lg:flex-none lg:px-12 xl:px-16">

            {/* Glass card */}
            <div
              className="lp-card w-full max-w-[420px] rounded-2xl px-8 py-10 sm:px-10"
              style={{
                background: "rgba(255,255,255,0.85)",
                border: "1.5px solid var(--border-soft)",
                boxShadow: "0 24px 60px rgba(109,40,217,0.12), 0 2px 8px rgba(15,16,43,0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            >
              {/* Mobile-only wordmark inside card */}
              <div className="mb-7 flex items-center gap-2 lg:hidden">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ background: "var(--grad-hero)" }}
                  aria-hidden="true"
                >
                  <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" />
                  </svg>
                </div>
                <span className="font-display text-[0.95rem] font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  Tickets<span style={{ color: "var(--brand-magenta)" }}>.</span>
                </span>
              </div>

              {/* The actual form (client component handles all interaction) */}
              <LoginForm />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
