"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/* ── Keyframes — injected once, CSS-only (same pattern as events-panel) ──── */
const LOGIN_STYLES = `
@keyframes lf-fade-up {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes lf-line-grow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
@keyframes lf-glow-pulse {
  0%, 100% { opacity: 0.55; }
  50%       { opacity: 1; }
}

.lf-brand   { animation: lf-fade-up 0.55s var(--ease-tactile) 0.05s both; }
.lf-title   { animation: lf-fade-up 0.6s  var(--ease-tactile) 0.18s both; }
.lf-sub     { animation: lf-fade-up 0.6s  var(--ease-tactile) 0.28s both; }
.lf-line    {
  transform-origin: left;
  animation: lf-line-grow 0.7s var(--ease-tactile) 0.32s both;
}
.lf-fields  { animation: lf-fade-up 0.6s  var(--ease-tactile) 0.42s both; }
.lf-cta     { animation: lf-fade-up 0.55s var(--ease-tactile) 0.52s both; }
.lf-footer  { animation: lf-fade-up 0.5s  var(--ease-tactile) 0.62s both; }

/* Custom field — deeper, more generous than the base .field */
.lf-input {
  width: 100%;
  background: var(--bg-surface, #fff);
  border: 1.5px solid var(--border-soft);
  border-radius: 10px;
  padding: 0.875rem 1rem;
  font-family: var(--font-body);
  font-size: 0.9375rem;
  color: var(--text-primary);
  outline: none;
  transition:
    border-color 0.18s var(--ease-tactile),
    background   0.18s var(--ease-tactile),
    box-shadow   0.18s var(--ease-tactile);
}
.lf-input::placeholder { color: var(--text-muted); }
.lf-input:focus {
  border-color: var(--brand-magenta);
  background: rgba(255,255,255,1);
  box-shadow: 0 0 0 3px rgba(236,42,138,0.22);
}
.lf-input[aria-invalid="true"] {
  border-color: #E11D48;
  box-shadow: 0 0 0 3px rgba(225,29,72,0.18);
}
.lf-label {
  display: block;
  margin-bottom: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

/* Pill submit button — uses brand gradient */
.lf-submit {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.9rem 1.5rem;
  border-radius: 9999px;
  background: var(--grad-hero);
  color: #fff;
  font-family: var(--font-display);
  font-size: 0.9375rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  border: none;
  cursor: pointer;
  box-shadow: var(--shadow-glow-accent);
  transition:
    opacity    0.18s var(--ease-tactile),
    transform  0.18s var(--ease-tactile),
    box-shadow 0.18s var(--ease-tactile);
}
.lf-submit:hover:not(:disabled) {
  opacity: 0.92;
  transform: translateY(-1px);
  box-shadow: 0 0 0 1px rgba(236,42,138,0.28), 0 12px 32px rgba(236,42,138,0.45);
}
.lf-submit:active:not(:disabled) { transform: translateY(0); }
.lf-submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* Spinner inside button */
@keyframes lf-spin {
  to { transform: rotate(360deg); }
}
.lf-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: lf-spin 0.7s linear infinite;
  flex-shrink: 0;
}
`;

function resolveSafeNextPath(next: string | null) {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) {
    return null;
  }
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo iniciar sesión");
      return;
    }

    const next = resolveSafeNextPath(params.get("next"));
    router.push(next ?? (data.user.role === "ADMIN" || data.user.role === "MANAGER" ? "/admin" : data.user.role === "SELLER" ? "/sales" : "/scan"));
    router.refresh();
  }

  const hasError = error !== null;

  return (
    <>
      <style>{LOGIN_STYLES}</style>

      {/* Brand overline */}
      <div className="lf-brand">
        <span className="inline-flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--brand-magenta)", animation: "lf-glow-pulse 2s ease-in-out infinite" }}
            aria-hidden="true"
          />
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[color:var(--brand-magenta)]">
            Aiderbrand
          </span>
        </span>
      </div>

      {/* Headline */}
      <h1 className="lf-title mt-3 font-display font-extrabold leading-[1.05] tracking-tight" style={{ fontSize: "clamp(2rem, 5vw, 2.75rem)", color: "var(--text-primary)" }}>
        Acceso al<br />
        <span style={{ background: "var(--grad-hero)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
          sistema
        </span>
      </h1>

      {/* Accent line */}
      <div className="lf-line mt-4 h-[3px] w-12 rounded-full" style={{ background: "var(--grad-hero)" }} aria-hidden="true" />

      {/* Subtext */}
      <p className="lf-sub mt-4 text-[0.9rem] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Ingresá para gestionar eventos,<br className="hidden sm:block" /> ventas y asistencia.
      </p>

      {/* Form */}
      <form onSubmit={onSubmit} className="lf-fields mt-8 space-y-5" noValidate>

        {/* Usuario */}
        <div>
          <label htmlFor="login-username" className="lf-label">
            Usuario
          </label>
          <input
            id="login-username"
            className="lf-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="tu.usuario"
            required
            autoComplete="username"
            aria-invalid={hasError ? true : undefined}
          />
        </div>

        {/* Contraseña */}
        <div>
          <label htmlFor="login-password" className="lf-label">
            Contraseña
          </label>
          <input
            id="login-password"
            className="lf-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            aria-invalid={hasError ? true : undefined}
          />
        </div>

        {/* Error state */}
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="flex items-start gap-3 rounded-xl border border-danger-500/30 bg-danger-50/10 px-4 py-3"
          >
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-danger-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-[0.8125rem] font-medium text-danger-500">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="lf-cta pt-1">
          <button
            type="submit"
            className="lf-submit"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <span className="lf-spinner" aria-hidden="true" />
                Ingresando...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H4" />
                </svg>
                Iniciar sesión
              </>
            )}
          </button>
        </div>

      </form>

      {/* Trust footer */}
      <div className="lf-footer mt-8 flex items-center gap-2" style={{ color: "var(--text-muted)", opacity: 0.8 }}>
        <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
        </svg>
        <span className="text-[11px] font-medium tracking-wide">Acceso restringido · Solo personal autorizado</span>
      </div>
    </>
  );
}
