"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { commissionBpsToPercent } from "@/lib/platform-commission";

/* ─────────────────────────────────────────────────────────────────────────────
   CSS — scoped with mf- prefix, v2 design language
───────────────────────────────────────────────────────────────────────────── */
const FORM_STYLES = `
@keyframes mf-msg-in {
  from { opacity: 0; transform: translateY(-6px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes mf-stub-in {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes mf-spin {
  to { transform: rotate(360deg); }
}

/* Message chips */
.mf-msg-success {
  animation: mf-msg-in 0.35s cubic-bezier(0.22,1,0.36,1) both;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 9999px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid rgba(31,174,74,0.30);
  background: var(--clr-success-50);
  color: var(--clr-success-700);
}
.mf-msg-error {
  animation: mf-msg-in 0.35s cubic-bezier(0.22,1,0.36,1) both;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 9999px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid rgba(225,29,72,0.28);
  background: var(--clr-danger-50);
  color: var(--clr-danger-700);
}

/* Section divider */
.mf-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 20px 14px;
  border-top: 1px solid var(--clr-arena-200);
}
.mf-divider:first-of-type {
  border-top: none;
  padding-top: 20px;
}
.mf-divider-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--clr-arena-400);
  white-space: nowrap;
  font-family: var(--font-display);
}
.mf-divider-line {
  flex: 1;
  height: 1px;
  background: var(--clr-arena-200);
}

/* Input field */
.mf-field {
  width: 100%;
  border-radius: 7px;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  outline: none;
}
.mf-field:focus {
  border-color: var(--clr-forest-500);
  box-shadow: 0 0 0 3px rgba(91,33,182,0.10);
}
.mf-field:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* Password field with lock icon inline */
.mf-field-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.mf-field-icon {
  position: absolute;
  right: 10px;
  color: var(--text-muted);
  pointer-events: none;
}

/* Select */
.mf-select {
  appearance: none;
  width: 100%;
  border-radius: 7px;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  padding: 8px 32px 8px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  outline: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.mf-select:focus {
  border-color: var(--clr-forest-500);
  box-shadow: 0 0 0 3px rgba(91,33,182,0.10);
}

/* Danger checkbox row */
.mf-clear-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding: 6px 10px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  transition: background 0.15s ease, border-color 0.15s ease;
  cursor: pointer;
}
.mf-clear-row:has(input:checked) {
  background: var(--clr-danger-50);
  border-color: rgba(225,29,72,0.22);
}
.mf-clear-check {
  appearance: none;
  width: 15px;
  height: 15px;
  border-radius: 4px;
  border: 1.5px solid var(--border-strong);
  background: var(--bg-surface);
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.mf-clear-check:checked {
  background: #DC2626;
  border-color: #DC2626;
}
.mf-clear-check:checked::after {
  content: '';
  position: absolute;
  left: 3.5px;
  top: 1px;
  width: 5px;
  height: 8px;
  border: 2px solid #fff;
  border-top: none;
  border-left: none;
  transform: rotate(45deg);
}

/* Has-set badge */
.mf-set-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 700;
  border: 1px solid rgba(31,174,74,0.25);
  background: var(--clr-success-50);
  color: var(--clr-success-700);
}
.mf-set-badge-missing {
  border-color: rgba(245,158,11,0.25);
  background: var(--clr-warning-50);
  color: var(--clr-warning-700);
}

/* Event stub row */
.mf-stub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 7px;
  border: 1px solid var(--border-soft);
  background: var(--bg-sunken);
  animation: mf-stub-in 0.36s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) both;
  transition: border-color 0.12s ease;
}
.mf-stub:hover { border-color: rgba(91,33,182,0.20); }
.mf-stub:nth-child(1) { animation-delay: 0.20s; }
.mf-stub:nth-child(2) { animation-delay: 0.26s; }
.mf-stub:nth-child(3) { animation-delay: 0.32s; }
.mf-stub:nth-child(4) { animation-delay: 0.38s; }
.mf-stub:nth-child(5) { animation-delay: 0.44s; }
.mf-stub:nth-child(6) { animation-delay: 0.50s; }

/* Spinner */
.mf-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 9999px;
  animation: mf-spin 0.65s linear infinite;
}

/* Lock badge — quiet inline indicator */
.mf-lock-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 600;
  border: 1px solid var(--border-soft);
  background: var(--bg-sunken);
  color: var(--text-muted);
}

/* Sticky footer */
.mf-sticky-footer {
  position: sticky;
  bottom: 0;
  z-index: 20;
  background: var(--clr-white);
  border-top: 1px solid var(--clr-arena-200);
  box-shadow: 0 -4px 20px rgba(21,22,43,0.06);
}
`;

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────────── */
type MerchantFormState = {
  merchantAccountId: string | null;
  status: "ACTIVE" | "DISABLED";
  hasAccessToken: boolean;
  hasWebhookSecret: boolean;
  commissionRateBps: number;
  updatedAt: string | null;
};

type LinkedEvent = {
  id: string;
  name: string;
  startsAt: string;
};

type Props = {
  clientId: string;
  clientName: string;
  viewerRole: "ADMIN" | "MANAGER";
  initialMerchant: MerchantFormState;
  linkedEvents: LinkedEvent[];
};

/* ─────────────────────────────────────────────────────────────────────────────
   HELPER
───────────────────────────────────────────────────────────────────────────── */
function getErrorMessage(data: Record<string, unknown>, fallback: string) {
  return typeof data.error === "string" && data.error.trim() ? data.error : fallback;
}

/* ─────────────────────────────────────────────────────────────────────────────
   SECTION DIVIDER — shared
───────────────────────────────────────────────────────────────────────────── */
function SectionDivider({ label, aside, first = false }: { label: string; aside?: React.ReactNode; first?: boolean }) {
  return (
    <div className={`mf-divider${first ? " mf-divider-first" : ""}`} style={first ? { borderTop: "none", paddingTop: 20 } : undefined}>
      <span className="mf-divider-label">{label}</span>
      <span className="mf-divider-line" aria-hidden="true" />
      {aside}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export function ClientMerchantForm({ clientId, clientName, viewerRole, initialMerchant, linkedEvents }: Props) {
  const router = useRouter();
  const canEditCommission = viewerRole === "ADMIN";

  const [merchant, setMerchant] = useState(initialMerchant);
  const [status, setStatus] = useState<"ACTIVE" | "DISABLED">(initialMerchant.status);
  const [commissionPercent, setCommissionPercent] = useState(commissionBpsToPercent(initialMerchant.commissionRateBps));
  const [accessToken, setAccessToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [clearAccessToken, setClearAccessToken] = useState(false);
  const [clearWebhookSecret, setClearWebhookSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const isActive = status === "ACTIVE";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setIsError(false);

    const payload: Record<string, unknown> = { status };

    if (clearAccessToken || accessToken.trim()) {
      payload.accessToken = clearAccessToken ? "" : accessToken.trim();
    }
    if (clearWebhookSecret || webhookSecret.trim()) {
      payload.webhookSecret = clearWebhookSecret ? "" : webhookSecret.trim();
    }
    if (canEditCommission) {
      payload.commissionPercent = commissionPercent;
    }

    const response = await fetch(`/api/admin/clients/${clientId}/merchant`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    setSaving(false);

    if (!response.ok) {
      setIsError(true);
      setMessage(getErrorMessage(data, "No se pudo guardar la configuracion merchant"));
      return;
    }

    const nextMerchant: MerchantFormState = {
      merchantAccountId: typeof data.merchantAccountId === "string" ? data.merchantAccountId : merchant.merchantAccountId,
      status: data.status === "DISABLED" ? "DISABLED" : "ACTIVE",
      hasAccessToken: Boolean(data.hasAccessToken),
      hasWebhookSecret: Boolean(data.hasWebhookSecret),
      commissionRateBps: typeof data.commissionRateBps === "number" ? data.commissionRateBps : merchant.commissionRateBps,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
    };

    setMerchant(nextMerchant);
    setStatus(nextMerchant.status);
    setCommissionPercent(commissionBpsToPercent(nextMerchant.commissionRateBps));
    setAccessToken("");
    setWebhookSecret("");
    setClearAccessToken(false);
    setClearWebhookSecret(false);
    setIsError(false);
    setMessage(`Merchant de ${clientName} actualizado correctamente`);
    router.refresh();
  }

  const inputCls = "mf-field";
  const selectCls = "mf-select";

  return (
    <>
      <style>{FORM_STYLES}</style>

      <form onSubmit={onSubmit} className="pb-24">
        {/* ══ SINGLE EDITORIAL SURFACE ═══════════════════════════════════════ */}
        <div className="rounded-xl border border-[color:var(--border-soft)] bg-surface shadow-[var(--shadow-sm)]">

          {/* ── SECTION: Estado y comisión ── */}
          <div className="px-5">
            <SectionDivider label="Estado y comisión" first />
          </div>

          <div className="grid gap-4 px-5 pb-4 md:grid-cols-2">

            {/* Estado operativo */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-secondary" style={{ letterSpacing: "0.01em" }}>
                Estado operativo
              </label>
              <select
                className={selectCls}
                value={status}
                onChange={(e) => setStatus(e.target.value as "ACTIVE" | "DISABLED")}
              >
                <option value="ACTIVE">Activo</option>
                <option value="DISABLED">Deshabilitado</option>
              </select>
              <div
                className="mt-2 flex items-center gap-2 rounded-[7px] border px-3 py-1.5"
                style={{
                  borderColor: isActive ? "rgba(31,174,74,0.25)" : "rgba(245,158,11,0.25)",
                  background:  isActive ? "var(--clr-success-50)" : "var(--clr-warning-50)",
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ background: isActive ? "var(--clr-success-500)" : "var(--clr-warning-500)" }}
                  aria-hidden="true"
                />
                <p
                  className="text-[11px] font-semibold"
                  style={{ color: isActive ? "var(--clr-success-700)" : "var(--clr-warning-700)" }}
                >
                  {isActive ? "Puede procesar pagos." : "No procesa pagos."}
                </p>
              </div>
            </div>

            {/* Comisión */}
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-[11px] font-semibold text-secondary" style={{ letterSpacing: "0.01em" }}>
                  Comisión plataforma (%)
                </label>
                {!canEditCommission && (
                  <span className="mf-lock-badge">
                    <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Solo lectura
                  </span>
                )}
              </div>
              <input
                className={inputCls}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={commissionPercent}
                onChange={(e) => setCommissionPercent(Number(e.target.value))}
                disabled={!canEditCommission}
              />
              <p className="mt-1 text-[11px] text-muted">
                {canEditCommission
                  ? "ADMIN define la comisión base para liquidaciones."
                  : "MANAGER puede ver la comisión, pero no modificarla."}
              </p>
            </div>

          </div>

          {/* ── SECTION: Credenciales Mercado Pago ── */}
          <div className="px-5">
            <SectionDivider label="Credenciales Mercado Pago" />
          </div>

          <div className="px-5 pb-4 space-y-4">
            <p className="rounded-[7px] border border-[color:var(--border-soft)] bg-sunken px-3 py-2 text-[12px] leading-relaxed text-secondary">
              Las credenciales se almacenan <span className="font-semibold text-primary">cifradas</span>. Para reemplazar, ingresá la nueva. Para eliminar, usá la casilla de limpieza.
            </p>

            {/* Access Token */}
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-secondary" style={{ letterSpacing: "0.01em" }}>
                  <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                  </svg>
                  Access Token
                </label>
                {merchant.hasAccessToken ? (
                  <span className="mf-set-badge">
                    <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Configurado
                  </span>
                ) : (
                  <span className="mf-set-badge mf-set-badge-missing">
                    Sin configurar
                  </span>
                )}
              </div>
              <div className="mf-field-wrap">
                <input
                  className={inputCls}
                  style={{ paddingRight: 36 }}
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder={merchant.hasAccessToken ? "Ya configurado. Ingresá uno nuevo para reemplazarlo." : "APP_USR-…"}
                />
                <div className="mf-field-icon" aria-hidden="true">
                  <svg className="h-[14px] w-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
              </div>
              {merchant.hasAccessToken && (
                <label className="mf-clear-row">
                  <input
                    type="checkbox"
                    className="mf-clear-check"
                    checked={clearAccessToken}
                    onChange={(e) => setClearAccessToken(e.target.checked)}
                  />
                  <span className="text-[12px] font-medium" style={{ color: clearAccessToken ? "var(--clr-danger-700)" : "var(--text-secondary)" }}>
                    Limpiar access token actual
                  </span>
                </label>
              )}
            </div>

            {/* Divider */}
            <div className="h-px" style={{ background: "var(--border-soft)" }} aria-hidden="true" />

            {/* Webhook Secret */}
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-secondary" style={{ letterSpacing: "0.01em" }}>
                  <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Webhook Secret
                </label>
                {merchant.hasWebhookSecret ? (
                  <span className="mf-set-badge">
                    <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Configurado
                  </span>
                ) : (
                  <span className="mf-set-badge mf-set-badge-missing">
                    Sin configurar
                  </span>
                )}
              </div>
              <div className="mf-field-wrap">
                <input
                  className={inputCls}
                  style={{ paddingRight: 36 }}
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder={merchant.hasWebhookSecret ? "Ya configurado. Ingresá uno nuevo para reemplazarlo." : "Secret del webhook de Mercado Pago"}
                />
                <div className="mf-field-icon" aria-hidden="true">
                  <svg className="h-[14px] w-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
              </div>
              {merchant.hasWebhookSecret && (
                <label className="mf-clear-row">
                  <input
                    type="checkbox"
                    className="mf-clear-check"
                    checked={clearWebhookSecret}
                    onChange={(e) => setClearWebhookSecret(e.target.checked)}
                  />
                  <span className="text-[12px] font-medium" style={{ color: clearWebhookSecret ? "var(--clr-danger-700)" : "var(--text-secondary)" }}>
                    Limpiar webhook secret actual
                  </span>
                </label>
              )}
            </div>

            {/* Last updated */}
            {merchant.updatedAt && (
              <p className="text-[10px]" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                Última actualización:{" "}
                {new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(merchant.updatedAt))}
              </p>
            )}
          </div>

          {/* ── SECTION: Eventos asignados ── */}
          <div className="px-5">
            <SectionDivider
              label="Eventos asignados"
              aside={
                linkedEvents.length > 0 ? (
                  <span
                    className="inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold"
                    style={{
                      fontFamily: "var(--font-mono)",
                      borderColor: "rgba(91,33,182,0.18)",
                      background: "rgba(91,33,182,0.05)",
                      color: "var(--brand-violet)",
                    }}
                  >
                    {linkedEvents.length}
                  </span>
                ) : undefined
              }
            />
          </div>

          <div className="px-5 pb-5">
            {linkedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[color:var(--border-soft)] py-10 text-center">
                <p className="text-[12px] font-semibold text-muted">Sin eventos vinculados</p>
                <p className="mt-1 max-w-xs text-[11px] text-muted">
                  No hay eventos visibles vinculados a este cliente.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {linkedEvents.map((event) => (
                  <div key={event.id} className="mf-stub">
                    <svg
                      className="h-3 w-3 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-primary">{event.name}</p>
                      <p className="text-[10px] text-muted" style={{ fontFamily: "var(--font-mono)" }}>
                        {new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.startsAt))}
                      </p>
                    </div>
                    <a
                      href={`/admin/events/${event.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-[6px] border px-2 py-1 text-[11px] font-medium text-secondary transition-colors duration-[120ms] hover:border-[color:var(--border-strong)] hover:text-primary"
                      style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-surface)" }}
                    >
                      <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Ver
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>{/* /single surface */}

        {/* ══ STICKY FOOTER ══════════════════════════════════════════════════ */}
        <div className="mf-sticky-footer mt-0 px-5 py-3">
          <div className="flex items-center justify-end gap-3">
            {/* Feedback message */}
            {message && (
              <span
                className={`mr-auto ${isError ? "mf-msg-error" : "mf-msg-success"}`}
                role={isError ? "alert" : "status"}
              >
                {isError ? (
                  <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                ) : (
                  <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
                {message}
              </span>
            )}

            {/* Cancelar */}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] bg-surface px-5 py-2 text-[13px] font-medium text-secondary transition-colors duration-150 hover:text-primary hover:border-[color:var(--border-focus)]"
              onClick={() => router.push("/admin/clients")}
            >
              Cancelar
            </button>

            {/* Guardar cambios */}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-bold text-white shadow-[var(--shadow-sm)] transition-all duration-150 hover:opacity-90 hover:shadow-[0_4px_16px_rgba(109,40,217,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "var(--grad-hero)" }}
            >
              {saving ? (
                <>
                  <span className="mf-spinner" aria-hidden="true" />
                  Guardando…
                </>
              ) : (
                <>
                  <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  Guardar cambios
                </>
              )}
            </button>
          </div>
        </div>

      </form>
    </>
  );
}
