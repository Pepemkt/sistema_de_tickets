"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

/* ─────────────────────────────────────────────────────────────────────────────
   CSS — scoped with ncf- prefix
───────────────────────────────────────────────────────────────────────────── */
const FORM_STYLES = `
@keyframes ncf-shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-4px); }
  40%       { transform: translateX(4px); }
  60%       { transform: translateX(-3px); }
  80%       { transform: translateX(3px); }
}
@keyframes ncf-msg-in {
  from { opacity: 0; transform: translateY(-6px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes ncf-spinner {
  to { transform: rotate(360deg); }
}

/* Single editorial surface — no top stripe */
.ncf-surface {
  border-radius: 10px;
  border: 1px solid var(--border-soft);
  background: var(--bg-surface);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

/* Section divider */
.ncf-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 12px;
  border-top: 1px solid var(--clr-arena-200);
}
.ncf-divider:first-of-type {
  border-top: none;
  padding-top: 18px;
}
.ncf-divider-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--clr-arena-400);
  white-space: nowrap;
  font-family: var(--font-display);
}
.ncf-divider-line {
  flex: 1;
  height: 1px;
  background: var(--clr-arena-200);
}

/* Input */
.ncf-input {
  width: 100%;
  border-radius: 7px;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  padding: 8px 12px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.ncf-input::placeholder {
  color: var(--text-muted);
  font-weight: 400;
}
.ncf-input:focus {
  border-color: var(--clr-forest-500);
  box-shadow: 0 0 0 3px rgba(91,33,182,0.10);
}
.ncf-input-error {
  border-color: var(--clr-danger-400) !important;
  box-shadow: 0 0 0 3px rgba(239,68,68,0.10) !important;
}

/* Error chip */
.ncf-error-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: 9999px;
  border: 1px solid rgba(239,68,68,0.25);
  background: rgba(239,68,68,0.07);
  font-size: 12px;
  font-weight: 600;
  color: var(--clr-danger-600, #dc2626);
  animation: ncf-msg-in 0.28s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) both;
}

/* Counter */
.ncf-counter {
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  transition: color 0.15s ease;
}

/* Shake */
.ncf-shake { animation: ncf-shake 0.4s ease both; }

/* Sticky footer */
.ncf-sticky-footer {
  position: sticky;
  bottom: 0;
  z-index: 20;
  background: var(--clr-white);
  border-top: 1px solid var(--clr-arena-200);
  box-shadow: 0 -4px 20px rgba(21,22,43,0.06);
}

/* Spinner */
.ncf-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(255,255,255,0.28);
  border-top-color: #fff;
  border-radius: 9999px;
  animation: ncf-spinner 0.65s linear infinite;
  flex-shrink: 0;
}
`;

export function NewClientForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);

  const trimmed = name.trim();
  const isReady = trimmed.length >= 2;
  const charCount = name.length;
  const counterColor =
    charCount > 100
      ? "var(--clr-danger-500, #ef4444)"
      : charCount > 80
        ? "var(--clr-warning-600, #d97706)"
        : "var(--text-muted)";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isReady || saving) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = (await res.json()) as { error?: string; client?: { id: string } };

      if (!res.ok) {
        setError(data.error ?? "No se pudo crear el cliente");
        setShaking(true);
        setTimeout(() => setShaking(false), 450);
        return;
      }

      const id = data.client?.id;
      if (id) {
        router.push(`/admin/clients/${id}/merchant`);
      } else {
        router.push("/admin/clients");
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>{FORM_STYLES}</style>

      <form onSubmit={onSubmit} noValidate className="pb-24">
        {/* ══ SINGLE SURFACE ═════════════════════════════════════════════════ */}
        <div className={`ncf-surface${shaking ? " ncf-shake" : ""}`}>

          {/* ── SECTION: Nombre del partner ── */}
          <div className="ncf-divider">
            <span className="ncf-divider-label">Nombre del partner</span>
            <span className="ncf-divider-line" aria-hidden="true" />
          </div>

          <div className="px-5 pb-4 space-y-3">
            <p className="text-[12px] text-secondary leading-relaxed">
              Este nombre es solo interno — lo usás para identificar al cliente en liquidaciones y eventos.
            </p>

            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <label
                  htmlFor="client-name"
                  className="text-[11px] font-semibold text-secondary"
                  style={{ letterSpacing: "0.01em" }}
                >
                  Nombre *
                </label>
                <span
                  className="ncf-counter"
                  style={{ color: counterColor }}
                  aria-live="polite"
                  aria-label={`${charCount} de 120 caracteres`}
                >
                  {charCount}/120
                </span>
              </div>

              <input
                id="client-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                required
                minLength={2}
                maxLength={120}
                placeholder="Ej: Productora X"
                autoComplete="off"
                autoFocus
                className={`ncf-input${error ? " ncf-input-error" : ""}`}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "ncf-error" : undefined}
                disabled={saving}
              />

              {!error && (
                <p className="mt-1 text-[11px] text-muted">
                  Mínimo 2 caracteres · Máximo 120 caracteres
                </p>
              )}
            </div>

            {/* Error chip */}
            {error ? (
              <div id="ncf-error" role="alert" className="flex">
                <span className="ncf-error-chip">
                  <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  {error}
                </span>
              </div>
            ) : null}
          </div>

        </div>{/* /single surface */}

        {/* ══ STICKY FOOTER ══════════════════════════════════════════════════ */}
        <div className="ncf-sticky-footer mt-0 px-5 py-3">
          <div className="flex items-center justify-end gap-3">
            <p className="mr-auto text-[11px] text-muted">
              {isReady
                ? "Todo listo para continuar"
                : "Ingresá al menos 2 caracteres para continuar"}
            </p>

            {/* Cancelar */}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] bg-surface px-5 py-2 text-[13px] font-medium text-secondary transition-colors duration-150 hover:text-primary hover:border-[color:var(--border-focus)]"
              onClick={() => router.push("/admin/clients")}
            >
              Cancelar
            </button>

            {/* Crear cliente */}
            <button
              type="submit"
              disabled={saving || !isReady}
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-bold text-white shadow-[var(--shadow-sm)] transition-all duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "var(--grad-hero)" }}
              aria-busy={saving}
            >
              {saving ? (
                <>
                  <span className="ncf-spinner" aria-hidden="true" />
                  Creando…
                </>
              ) : (
                <>
                  Crear cliente
                  <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
