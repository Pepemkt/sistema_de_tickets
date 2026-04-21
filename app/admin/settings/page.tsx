"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { EMAIL_TEMPLATE_TOKENS } from "@/lib/email-template";
import {
  buildEmailTemplateFromBuilder,
  defaultEmailTemplateBuilder,
  normalizeEmailTemplateBuilder,
  type EmailTemplateBuilderConfig
} from "@/lib/email-template-builder";

/* ─────────────────────────────────────────────────────────────────────────────
   SCOPED CSS — v2 voice, as- prefix
───────────────────────────────────────────────────────────────────────────── */
const PAGE_STYLES = `
@keyframes as-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes as-spin {
  to { transform: rotate(360deg); }
}
@keyframes as-pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.45; transform: scale(0.75); }
}
@keyframes as-msg-pop {
  from { opacity: 0; transform: translateY(-5px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes as-fee-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.as-hero    { animation: as-fade-up 0.48s var(--ease-tactile) 0.02s both; }
.as-content { animation: as-fade-up 0.48s var(--ease-tactile) 0.10s both; }

/* Section divider label */
.as-section-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--text-muted);
  margin-bottom: 16px;
}
.as-section-label::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-soft);
}

/* Stat chips inside sections */
.as-stat-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 8px 14px;
  border-right: 1px solid var(--border-soft);
  min-width: 80px;
}
.as-stat-chip:last-child { border-right: none; }

/* Custom field — matches global .field but scoped for this page */
.as-field {
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--border-soft);
  background: var(--bg-sunken);
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  outline: none;
  font-family: inherit;
}
.as-field:focus {
  border-color: var(--border-focus);
  box-shadow: var(--shadow-focus);
}
.as-field:disabled { opacity: 0.55; cursor: not-allowed; }

.as-field-ta {
  resize: vertical;
  min-height: 96px;
  line-height: 1.55;
}

/* Field with icon inset */
.as-field-wrap { position: relative; }
.as-field-padded { padding-right: 42px; }

/* Password toggle */
.as-eye-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  transition: color 0.12s ease;
}
.as-eye-btn:hover { color: var(--text-secondary); }

/* Clear checkbox row */
.as-clear-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding: 5px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  transition: background 0.15s ease, border-color 0.15s ease;
  cursor: pointer;
  width: fit-content;
}
.as-clear-row:has(input:checked) {
  background: var(--clr-danger-50, #fef2f2);
  border-color: rgba(225,29,72,0.22);
}
.as-clear-check {
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
.as-clear-check:checked { background: #dc2626; border-color: #dc2626; }
.as-clear-check:checked::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 1px;
  width: 5px;
  height: 8px;
  border: 2px solid #fff;
  border-top: none;
  border-left: none;
  transform: rotate(45deg);
}

/* Toggle switch */
.as-toggle-wrap { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.as-toggle {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 9999px;
  background: var(--border-strong, #d1d5db);
  transition: background 0.2s ease;
  flex-shrink: 0;
  cursor: pointer;
  appearance: none;
  border: none;
  outline: none;
}
.as-toggle:checked { background: var(--brand-magenta, #ec4899); }
.as-toggle::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  transition: transform 0.2s cubic-bezier(0.22,1,0.36,1);
}
.as-toggle:checked::after { transform: translateX(16px); }
.as-toggle:focus-visible { box-shadow: 0 0 0 3px rgba(236,72,153,0.28); }

/* Config badge */
.as-badge-ok {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 9999px;
  font-size: 10.5px; font-weight: 700;
  border: 1px solid rgba(16,185,129,0.25);
  background: var(--clr-success-50, #ecfdf5);
  color: var(--clr-success-700, #065f46);
}
.as-badge-miss {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 9999px;
  font-size: 10.5px; font-weight: 700;
  border: 1px solid rgba(245,158,11,0.25);
  background: var(--clr-warning-50, #fffbeb);
  color: var(--clr-warning-700, #92400e);
}
.as-dot-pulse { animation: as-pulse-dot 2.2s ease-in-out infinite; }

/* Message chips */
.as-msg-ok {
  animation: as-msg-pop 0.32s cubic-bezier(0.22,1,0.36,1) both;
  display: inline-flex; align-items: center; gap: 6px;
  border-radius: 9999px; padding: 4px 12px;
  font-size: 12px; font-weight: 700;
  border: 1px solid rgba(16,185,129,0.28);
  background: var(--clr-success-50, #ecfdf5);
  color: var(--clr-success-700, #065f46);
}
.as-msg-err {
  animation: as-msg-pop 0.32s cubic-bezier(0.22,1,0.36,1) both;
  display: inline-flex; align-items: center; gap: 6px;
  border-radius: 9999px; padding: 4px 12px;
  font-size: 12px; font-weight: 700;
  border: 1px solid rgba(225,29,72,0.28);
  background: var(--clr-danger-50, #fef2f2);
  color: var(--clr-danger-700, #991b1b);
}

/* Select */
.as-select {
  appearance: none;
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--border-soft);
  background: var(--bg-sunken);
  padding: 8px 36px 8px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  outline: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  transition: border-color 0.15s ease;
  font-family: inherit;
}
.as-select:focus {
  border-color: var(--border-focus);
  box-shadow: var(--shadow-focus);
}

/* Fee stub */
.as-fee-stub {
  border-radius: 10px;
  border: 1px solid var(--border-soft);
  background: var(--bg-sunken);
  padding: 12px 14px;
  animation: as-fee-in 0.38s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) both;
  transition: border-color 0.14s ease;
  position: relative;
  overflow: hidden;
}
.as-fee-stub::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0; width: 3px;
  border-radius: 10px 0 0 10px;
  background: var(--brand-violet);
}

/* Dropzone */
.as-dropzone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 10px;
  border: 1.5px dashed var(--border-strong);
  background: var(--bg-sunken);
  padding: 24px 20px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  text-align: center;
}
.as-dropzone:hover {
  border-color: var(--brand-violet);
  background: var(--clr-forest-50);
}
.as-dropzone input[type="file"] {
  position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
}

/* Spinner */
.as-spinner {
  width: 13px; height: 13px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 9999px;
  animation: as-spin 0.65s linear infinite;
  flex-shrink: 0;
}

/* Save button */
.as-save-btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 20px; border-radius: 7px;
  font-size: 12px; font-weight: 700;
  background: var(--grad-hero);
  color: #fff; border: none; cursor: pointer;
  transition: opacity 0.15s ease;
}
.as-save-btn:hover:not(:disabled) { opacity: 0.88; }
.as-save-btn:disabled { opacity: 0.55; cursor: not-allowed; }

/* Ghost secondary button */
.as-btn-ghost {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 16px; border-radius: 7px;
  font-size: 12px; font-weight: 700;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color 0.14s ease, color 0.14s ease;
}
.as-btn-ghost:hover { border-color: var(--brand-violet); color: var(--brand-violet); }

/* Token chip */
.as-token-chip {
  display: inline-flex; align-items: center;
  border-radius: 5px;
  border: 1px solid rgba(16,185,129,0.22);
  background: rgba(16,185,129,0.06);
  padding: 2px 7px;
  font-size: 11px; font-weight: 700;
  font-family: var(--font-mono, monospace);
  color: #065f46;
  letter-spacing: 0.03em;
}

/* Divider */
.as-divider { height: 1px; background: var(--border-soft); margin: 4px 0; }

/* Segmented toggle */
.as-seg {
  display: inline-flex; border-radius: 9999px;
  border: 1px solid var(--border-soft);
  background: var(--bg-sunken); overflow: hidden; flex-shrink: 0;
}
.as-seg-opt {
  padding: 5px 12px; font-size: 11px; font-weight: 700;
  cursor: pointer; border: none; background: none;
  color: var(--text-secondary);
  transition: background 0.14s ease, color 0.14s ease;
}
.as-seg-opt-active {
  background: var(--brand-violet);
  color: #fff; border-radius: 9999px;
}

/* Field label */
.as-field-label {
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--text-secondary); margin-bottom: 6px; display: block;
}
`;

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES (unchanged)
───────────────────────────────────────────────────────────────────────────── */
type MercadoPagoState = {
  hasAccessToken: boolean;
  hasWebhookSecret: boolean;
  updatedAt: string | null;
};

type SmtpState = {
  configured: boolean;
  host: string;
  port: number;
  user: string;
  from: string;
  secure: boolean;
  hasPassword: boolean;
  updatedAt: string | null;
};

type BrandingState = {
  sidebarLogoUrl: string | null;
};

type EmailTemplateState = {
  builder: EmailTemplateBuilderConfig;
  tokens: readonly string[];
  updatedAt: string | null;
};

type CheckoutFeeItemState = {
  id: string;
  name: string;
  mode: "FIXED" | "PERCENT";
  value: number;
  enabled: boolean;
};

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS (unchanged)
───────────────────────────────────────────────────────────────────────────── */
function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function getErrorMessage(data: Record<string, unknown>, fallback: string) {
  return typeof data.error === "string" && data.error.trim() ? data.error : fallback;
}

/* ─────────────────────────────────────────────────────────────────────────────
   SMALL UI ATOMS
───────────────────────────────────────────────────────────────────────────── */
function Spinner() {
  return <span className="as-spinner" aria-hidden="true" />;
}

function ConfigBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="as-badge-ok">
      <span className="as-dot-pulse inline-block h-1.5 w-1.5 rounded-full bg-[#10b981]" aria-hidden="true" />
      Configurado
    </span>
  ) : (
    <span className="as-badge-miss">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#f59e0b]" aria-hidden="true" />
      Sin configurar
    </span>
  );
}

type MessageBannerProps = { message: string; isError: boolean };
function MessageBanner({ message, isError }: MessageBannerProps) {
  if (isError) {
    return (
      <span className="as-msg-err" role="alert">
        <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {message}
      </span>
    );
  }
  return (
    <span className="as-msg-ok" role="status">
      <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      {message}
    </span>
  );
}

/* Password input with eye toggle */
function PasswordInput({
  value, onChange, placeholder, id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="as-field-wrap">
      <input
        id={id}
        className="as-field as-field-padded"
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
      />
      <button type="button" className="as-eye-btn" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar" : "Mostrar"}>
        {show ? (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ICONS (unchanged)
───────────────────────────────────────────────────────────────────────────── */
const IconLock = ({ cls = "h-4 w-4" }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IconKey = ({ cls = "h-4 w-4" }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);
const IconMail = ({ cls = "h-4 w-4" }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
  </svg>
);
const IconImage = ({ cls = "h-4 w-4" }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
  </svg>
);
const IconTag = ({ cls = "h-4 w-4" }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);
const IconCreditCard = ({ cls = "h-4 w-4" }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);
const IconSave = ({ cls = "h-3.5 w-3.5" }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
  </svg>
);
const IconPlus = ({ cls = "h-3.5 w-3.5" }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconTrash = ({ cls = "h-3.5 w-3.5" }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
);
const IconRefresh = ({ cls = "h-3.5 w-3.5" }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.95" />
  </svg>
);
const IconUpload = ({ cls = "h-6 w-6" }: { cls?: string }) => (
  <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
);

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);

  /* ── saving states ── */
  const [savingMp, setSavingMp] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingEmailTemplate, setSavingEmailTemplate] = useState(false);
  const [savingCheckoutFees, setSavingCheckoutFees] = useState(false);

  /* ── per-section messages ── */
  const [mpMsg, setMpMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [smtpMsg, setSmtpMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [brandMsg, setBrandMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [emailMsg, setEmailMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [feesMsg, setFeesMsg] = useState<{ text: string; err: boolean } | null>(null);

  /* ── global error for load failure ── */
  const [message, setMessage] = useState<string | null>(null);

  /* ── server state snapshots ── */
  const [mpState, setMpState] = useState<MercadoPagoState>({
    hasAccessToken: false,
    hasWebhookSecret: false,
    updatedAt: null,
  });
  const [smtpState, setSmtpState] = useState<SmtpState>({
    configured: false,
    host: "",
    port: 587,
    user: "",
    from: "",
    secure: false,
    hasPassword: false,
    updatedAt: null,
  });
  const [brandingState, setBrandingState] = useState<BrandingState>({ sidebarLogoUrl: null });
  const [emailTemplateState, setEmailTemplateState] = useState<EmailTemplateState>({
    builder: defaultEmailTemplateBuilder,
    tokens: EMAIL_TEMPLATE_TOKENS,
    updatedAt: null,
  });
  const [checkoutFeeItems, setCheckoutFeeItems] = useState<CheckoutFeeItemState[]>([]);
  const [checkoutFeesUpdatedAt, setCheckoutFeesUpdatedAt] = useState<string | null>(null);

  /* ── form fields ── */
  const [accessToken, setAccessToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [clearAccessToken, setClearAccessToken] = useState(false);
  const [clearWebhookSecret, setClearWebhookSecret] = useState(false);

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [clearSmtpPassword, setClearSmtpPassword] = useState(false);

  const [sidebarLogoUrl, setSidebarLogoUrl] = useState("");
  const [emailBuilder, setEmailBuilder] = useState<EmailTemplateBuilderConfig>(defaultEmailTemplateBuilder);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ─────────────────────────────────────────────────────────────────────────
     HELPERS (preserved verbatim)
  ───────────────────────────────────────────────────────────────────────── */
  async function fetchJsonSafe(url: string) {
    const response = await fetch(url);
    const text = await response.text();
    let data: Record<string, unknown> = {};
    if (text) {
      try { data = JSON.parse(text); }
      catch { throw new Error(`Respuesta no valida en ${url}`); }
    }
    if (!response.ok) throw new Error(getErrorMessage(data, `Error cargando ${url}`));
    return data;
  }

  async function parseJsonResponseSafe(response: Response, fallbackError: string) {
    const text = await response.text();
    let data: Record<string, unknown> = {};
    if (text) {
      try { data = JSON.parse(text); }
      catch { throw new Error(fallbackError); }
    }
    return { ok: response.ok, data };
  }

  /* ─────────────────────────────────────────────────────────────────────────
     LOAD (preserved verbatim)
  ───────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    Promise.all([
      fetchJsonSafe("/api/admin/settings/mercadopago"),
      fetchJsonSafe("/api/admin/settings/smtp"),
      fetchJsonSafe("/api/admin/settings/branding"),
      fetchJsonSafe("/api/admin/settings/email-template"),
      fetchJsonSafe("/api/admin/settings/checkout-fees"),
    ])
      .then(([mpData, smtpData, brandingData, emailData, checkoutFeesData]) => {
        const normalizedMpState: MercadoPagoState = {
          hasAccessToken: asBoolean(mpData.hasAccessToken),
          hasWebhookSecret: asBoolean(mpData.hasWebhookSecret),
          updatedAt: typeof mpData.updatedAt === "string" ? mpData.updatedAt : null,
        };
        const normalizedSmtpState: SmtpState = {
          configured: asBoolean(smtpData.configured),
          host: asString(smtpData.host),
          port: asNumber(smtpData.port, 465),
          user: asString(smtpData.user),
          from: asString(smtpData.from),
          secure: asBoolean(smtpData.secure),
          hasPassword: asBoolean(smtpData.hasPassword),
          updatedAt: typeof smtpData.updatedAt === "string" ? smtpData.updatedAt : null,
        };

        setMpState(normalizedMpState);
        setSmtpState(normalizedSmtpState);
        setSmtpHost(normalizedSmtpState.host);
        setSmtpPort(normalizedSmtpState.port);
        setSmtpUser(normalizedSmtpState.user);
        setSmtpFrom(normalizedSmtpState.from);
        setSmtpSecure(normalizedSmtpState.secure);
        setBrandingState({
          sidebarLogoUrl: typeof brandingData.sidebarLogoUrl === "string" ? brandingData.sidebarLogoUrl : null,
        });
        setSidebarLogoUrl(typeof brandingData.sidebarLogoUrl === "string" ? brandingData.sidebarLogoUrl : "");

        const builder = normalizeEmailTemplateBuilder(emailData.builder ?? defaultEmailTemplateBuilder);
        setEmailTemplateState({
          builder,
          tokens: Array.isArray(emailData.tokens) ? emailData.tokens.map(String) : EMAIL_TEMPLATE_TOKENS,
          updatedAt: typeof emailData.updatedAt === "string" ? emailData.updatedAt : null,
        });
        setEmailBuilder(builder);
        setCheckoutFeeItems(Array.isArray(checkoutFeesData.items) ? (checkoutFeesData.items as CheckoutFeeItemState[]) : []);
        setCheckoutFeesUpdatedAt(typeof checkoutFeesData.updatedAt === "string" ? checkoutFeesData.updatedAt : null);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "No se pudo cargar la configuracion");
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─────────────────────────────────────────────────────────────────────────
     LOGO UPLOAD (preserved verbatim)
  ───────────────────────────────────────────────────────────────────────── */
  async function onLogoFileChange(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setBrandMsg({ text: "Selecciona un archivo de imagen valido", err: true });
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.readAsDataURL(file);
    });
    setSidebarLogoUrl(dataUrl);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     SUBMIT HANDLERS (preserved verbatim)
  ───────────────────────────────────────────────────────────────────────── */
  async function onSubmitMercadoPago(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: { mercadoPagoAccessToken?: string; mercadoPagoWebhookSecret?: string } = {};
    if (clearAccessToken || accessToken.trim()) payload.mercadoPagoAccessToken = clearAccessToken ? "" : accessToken.trim();
    if (clearWebhookSecret || webhookSecret.trim()) payload.mercadoPagoWebhookSecret = clearWebhookSecret ? "" : webhookSecret.trim();
    if (Object.keys(payload).length === 0) {
      setMpMsg({ text: "No hay cambios para guardar en Mercado Pago", err: false });
      return;
    }
    setSavingMp(true);
    setMpMsg(null);
    const res = await fetch("/api/admin/settings/mercadopago", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const { ok, data } = await parseJsonResponseSafe(res, "Respuesta invalida guardando Mercado Pago");
    setSavingMp(false);
    if (!ok) {
      setMpMsg({ text: getErrorMessage(data, "No se pudieron guardar las credenciales de Mercado Pago"), err: true });
      return;
    }
    setMpState({
      hasAccessToken: asBoolean(data.hasAccessToken),
      hasWebhookSecret: asBoolean(data.hasWebhookSecret),
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
    });
    setAccessToken("");
    setWebhookSecret("");
    setClearAccessToken(false);
    setClearWebhookSecret(false);
    setMpMsg({ text: "Mercado Pago actualizado correctamente", err: false });
  }

  async function onSubmitSmtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSmtp(true);
    setSmtpMsg(null);
    const res = await fetch("/api/admin/settings/smtp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smtpHost, smtpPort, smtpUser, smtpPass: clearSmtpPassword ? "" : smtpPass || undefined, smtpFrom, smtpSecure }),
    });
    const { ok, data } = await parseJsonResponseSafe(res, "Respuesta invalida guardando SMTP");
    setSavingSmtp(false);
    if (!ok) {
      setSmtpMsg({ text: getErrorMessage(data, "No se pudo guardar SMTP"), err: true });
      return;
    }
    setSmtpState({
      configured: asBoolean(data.configured),
      host: asString(data.host),
      port: asNumber(data.port, 465),
      user: asString(data.user),
      from: asString(data.from),
      secure: asBoolean(data.secure),
      hasPassword: asBoolean(data.hasPassword),
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
    });
    setSmtpPass("");
    setClearSmtpPassword(false);
    setSmtpMsg({ text: "SMTP actualizado correctamente", err: false });
  }

  async function onSubmitBranding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingBranding(true);
    setBrandMsg(null);
    const res = await fetch("/api/admin/settings/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sidebarLogoUrl: sidebarLogoUrl.trim() || null }),
    });
    const { ok, data } = await parseJsonResponseSafe(res, "Respuesta invalida guardando branding");
    setSavingBranding(false);
    if (!ok) {
      setBrandMsg({ text: getErrorMessage(data, "No se pudo guardar branding"), err: true });
      return;
    }
    setBrandingState({ sidebarLogoUrl: typeof data.sidebarLogoUrl === "string" ? data.sidebarLogoUrl : null });
    setSidebarLogoUrl(typeof data.sidebarLogoUrl === "string" ? data.sidebarLogoUrl : "");
    setBrandMsg({ text: "Logo lateral actualizado", err: false });
  }

  async function onSubmitEmailTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingEmailTemplate(true);
    setEmailMsg(null);
    const res = await fetch("/api/admin/settings/email-template", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ builder: emailBuilder }),
    });
    const { ok, data } = await parseJsonResponseSafe(res, "Respuesta invalida guardando plantilla");
    setSavingEmailTemplate(false);
    if (!ok) {
      setEmailMsg({ text: getErrorMessage(data, "No se pudo guardar la plantilla de email"), err: true });
      return;
    }
    const builder = normalizeEmailTemplateBuilder(data.builder ?? emailBuilder);
    setEmailTemplateState({
      builder,
      tokens: Array.isArray(data.tokens) ? data.tokens.map(String) : EMAIL_TEMPLATE_TOKENS,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
    });
    setEmailBuilder(builder);
    setEmailMsg({ text: "Plantilla de email actualizada correctamente", err: false });
  }

  async function onSubmitCheckoutFees(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingCheckoutFees(true);
    setFeesMsg(null);
    const res = await fetch("/api/admin/settings/checkout-fees", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: checkoutFeeItems }),
    });
    const { ok, data } = await parseJsonResponseSafe(res, "Respuesta invalida guardando cargos");
    setSavingCheckoutFees(false);
    if (!ok) {
      setFeesMsg({ text: getErrorMessage(data, "No se pudieron guardar los cargos"), err: true });
      return;
    }
    setCheckoutFeeItems(Array.isArray(data.items) ? (data.items as CheckoutFeeItemState[]) : []);
    setCheckoutFeesUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : null);
    setFeesMsg({ text: "Cargos de checkout actualizados", err: false });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     FEE ITEM HELPERS (preserved verbatim)
  ───────────────────────────────────────────────────────────────────────── */
  function addCheckoutFeeItem() {
    setCheckoutFeeItems((current) => [...current, { id: crypto.randomUUID(), name: "", mode: "PERCENT", value: 0, enabled: true }]);
  }

  function removeCheckoutFeeItem(id: string) {
    setCheckoutFeeItems((current) => current.filter((item) => item.id !== id));
  }

  function updateCheckoutFeeItem(id: string, key: keyof CheckoutFeeItemState, value: string | number | boolean) {
    setCheckoutFeeItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        return { ...item, [key]: value };
      })
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
     EMAIL BUILDER HELPERS (preserved verbatim)
  ───────────────────────────────────────────────────────────────────────── */
  function resetEmailTemplate() {
    setEmailBuilder(defaultEmailTemplateBuilder);
  }

  function updateBuilderField<K extends keyof EmailTemplateBuilderConfig>(key: K, value: EmailTemplateBuilderConfig[K]) {
    setEmailBuilder((current) => ({ ...current, [key]: value }));
  }

  /* ─────────────────────────────────────────────────────────────────────────
     LIVE PREVIEW (preserved verbatim)
  ───────────────────────────────────────────────────────────────────────── */
  const liveTemplate = useMemo(() => buildEmailTemplateFromBuilder(emailBuilder), [emailBuilder]);

  const previewVars: Record<string, string> = {
    buyerName: "Ana Perez",
    buyerEmail: "ana@email.com",
    eventName: "Festival Sunset 2026",
    eventDate: "viernes, 3 de abril de 2026, 20:00",
    eventVenue: "Hipodromo de Palermo",
    orderId: "ORD-9F8A27",
    quantity: "2",
    ticketCount: "2",
    totalAmount: "$ 25.000,00",
    supportEmail: smtpFrom || "tickets@tudominio.com",
    year: String(new Date().getFullYear()),
  };

  const previewSubject = liveTemplate.subject.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => previewVars[key] ?? "");
  const previewHtml    = liveTemplate.html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => previewVars[key] ?? "");

  /* ─────────────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{PAGE_STYLES}</style>

      <div className="space-y-0">

        {/* ── HERO BAR ── */}
        <div
          className="as-hero flex flex-wrap items-start justify-between gap-4 pb-5"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div>
            <Link
              href="/admin"
              className="mb-2 inline-flex items-center gap-1.5 text-[11px] text-secondary transition-colors hover:text-primary"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Admin
            </Link>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--brand-violet)" }}
            >
              CONFIGURACIÓN
            </p>
            <h1 className="mt-1 font-display text-[1.625rem] font-extrabold leading-tight tracking-tight text-primary">
              Configuración del sistema<span style={{ color: "var(--brand-magenta)" }}>.</span>
            </h1>
            <p className="mt-1 text-[12px] text-secondary">
              Integraciones, branding, correo y comportamiento del checkout.
            </p>
          </div>
        </div>

        {/* global load error */}
        {message && (
          <div
            className="flex items-center gap-2 px-0 py-3 text-[12px] font-semibold"
            style={{ color: "var(--clr-danger-700)", borderBottom: "1px solid var(--border-soft)" }}
            role="alert"
          >
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
            </svg>
            {message}
          </div>
        )}

        {/* ── MAIN CONTENT — one container, sections divided by borders ── */}
        <div className="as-content">

          {/* ════════════════════════════════════════════════════════════════
              SECTION 1 — MERCADO PAGO
          ════════════════════════════════════════════════════════════════ */}
          <div className="py-6" style={{ borderBottom: "1px solid var(--border-soft)" }}>
            <div className="as-section-label">
              <IconKey cls="h-3 w-3 shrink-0" />
              Mercado Pago
              {!loading && <ConfigBadge ok={mpState.hasAccessToken && mpState.hasWebhookSecret} />}
            </div>
            <p className="mb-5 text-[12px] text-secondary">
              Credenciales cifradas para procesar pagos y recibir notificaciones de webhook.
            </p>

            {loading ? (
              <div className="flex items-center gap-2 py-4 text-[12px] text-muted">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                Cargando...
              </div>
            ) : (
              <>
                {/* Status chips */}
                <div
                  className="mb-5 flex flex-wrap items-stretch"
                  style={{ borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)" }}
                >
                  <div className="as-stat-chip">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Access Token</span>
                    <div className="mt-1"><ConfigBadge ok={mpState.hasAccessToken} /></div>
                  </div>
                  <div className="as-stat-chip">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Webhook Secret</span>
                    <div className="mt-1"><ConfigBadge ok={mpState.hasWebhookSecret} /></div>
                  </div>
                  {mpState.updatedAt && (
                    <div className="as-stat-chip">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Última actualización</span>
                      <span className="mt-1 text-[12px] font-semibold text-primary" style={{ fontFamily: "var(--font-mono)" }}>
                        {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(mpState.updatedAt))}
                      </span>
                    </div>
                  )}
                </div>

                <form onSubmit={onSubmitMercadoPago} className="space-y-4 max-w-lg">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label htmlFor="mp-access-token" className="as-field-label flex items-center gap-1.5">
                        <IconKey cls="h-3 w-3" />
                        Nuevo Access Token
                      </label>
                      <ConfigBadge ok={mpState.hasAccessToken} />
                    </div>
                    <PasswordInput
                      id="mp-access-token"
                      value={accessToken}
                      onChange={setAccessToken}
                      placeholder={mpState.hasAccessToken ? "Ingresá uno nuevo para reemplazarlo" : "APP_USR-..."}
                    />
                    {mpState.hasAccessToken && (
                      <label className="as-clear-row">
                        <input type="checkbox" className="as-clear-check" checked={clearAccessToken} onChange={(e) => setClearAccessToken(e.target.checked)} />
                        <span className="text-[12px] font-semibold" style={{ color: clearAccessToken ? "var(--clr-danger-700)" : "var(--text-secondary)" }}>
                          Limpiar access token actual
                        </span>
                      </label>
                    )}
                  </div>

                  <div className="as-divider" />

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label htmlFor="mp-webhook" className="as-field-label flex items-center gap-1.5">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        Nuevo Webhook Secret
                      </label>
                      <ConfigBadge ok={mpState.hasWebhookSecret} />
                    </div>
                    <PasswordInput
                      id="mp-webhook"
                      value={webhookSecret}
                      onChange={setWebhookSecret}
                      placeholder={mpState.hasWebhookSecret ? "Ingresá uno nuevo para reemplazarlo" : "Secret del webhook"}
                    />
                    {mpState.hasWebhookSecret && (
                      <label className="as-clear-row">
                        <input type="checkbox" className="as-clear-check" checked={clearWebhookSecret} onChange={(e) => setClearWebhookSecret(e.target.checked)} />
                        <span className="text-[12px] font-semibold" style={{ color: clearWebhookSecret ? "var(--clr-danger-700)" : "var(--text-secondary)" }}>
                          Limpiar webhook secret actual
                        </span>
                      </label>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button className="as-save-btn" type="submit" disabled={savingMp}>
                      {savingMp ? <><Spinner />Guardando…</> : <><IconSave />Guardar Mercado Pago</>}
                    </button>
                    {mpMsg && <MessageBanner message={mpMsg.text} isError={mpMsg.err} />}
                  </div>
                </form>
              </>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              SECTION 2 — SMTP / EMAILS
          ════════════════════════════════════════════════════════════════ */}
          <div className="py-6" style={{ borderBottom: "1px solid var(--border-soft)" }}>
            <div className="as-section-label">
              <IconMail cls="h-3 w-3 shrink-0" />
              SMTP / Correo saliente
              {!loading && <ConfigBadge ok={smtpState.configured} />}
            </div>
            <p className="mb-5 text-[12px] text-secondary">
              Configurá el servidor de correo para envío de tickets y notificaciones.
            </p>

            {loading ? (
              <div className="flex items-center gap-2 py-4 text-[12px] text-muted">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                Cargando...
              </div>
            ) : (
              <>
                {/* Status chips */}
                <div
                  className="mb-5 flex flex-wrap items-stretch"
                  style={{ borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)" }}
                >
                  <div className="as-stat-chip">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Estado</span>
                    <div className="mt-1"><ConfigBadge ok={smtpState.configured} /></div>
                  </div>
                  <div className="as-stat-chip">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Servidor</span>
                    <span className="mt-1 text-[12px] font-semibold text-primary truncate max-w-[120px]" style={{ fontFamily: "var(--font-mono)" }}>
                      {smtpState.host || "—"}
                    </span>
                  </div>
                  <div className="as-stat-chip">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Puerto</span>
                    <span className="mt-1 text-[12px] font-semibold text-primary" style={{ fontFamily: "var(--font-mono)" }}>
                      {smtpState.port || "—"}
                    </span>
                  </div>
                  {smtpState.updatedAt && (
                    <div className="as-stat-chip">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Última actualización</span>
                      <span className="mt-1 text-[12px] font-semibold text-primary" style={{ fontFamily: "var(--font-mono)" }}>
                        {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(smtpState.updatedAt))}
                      </span>
                    </div>
                  )}
                </div>

                <form onSubmit={onSubmitSmtp} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
                    <div>
                      <label className="as-field-label" htmlFor="smtp-host">SMTP Host</label>
                      <input id="smtp-host" className="as-field" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="mail.ejemplo.com" required />
                    </div>
                    <div>
                      <label className="as-field-label" htmlFor="smtp-port">Puerto</label>
                      <input id="smtp-port" className="as-field" type="number" min={1} max={65535} value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))} required />
                    </div>
                    <div>
                      <label className="as-field-label" htmlFor="smtp-user">Usuario</label>
                      <input id="smtp-user" className="as-field" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="tickets@ejemplo.com" required />
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="as-field-label mb-0 flex items-center gap-1.5" htmlFor="smtp-pass">
                          <IconLock cls="h-3 w-3" />
                          Password
                        </label>
                        <ConfigBadge ok={smtpState.hasPassword} />
                      </div>
                      <PasswordInput
                        id="smtp-pass"
                        value={smtpPass}
                        onChange={setSmtpPass}
                        placeholder={smtpState.hasPassword ? "Dejar vacío para conservar" : "Password SMTP"}
                      />
                      {smtpState.hasPassword && (
                        <label className="as-clear-row">
                          <input type="checkbox" className="as-clear-check" checked={clearSmtpPassword} onChange={(e) => setClearSmtpPassword(e.target.checked)} />
                          <span className="text-[12px] font-semibold" style={{ color: clearSmtpPassword ? "var(--clr-danger-700)" : "var(--text-secondary)" }}>
                            Limpiar password actual
                          </span>
                        </label>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="as-field-label" htmlFor="smtp-from">Dirección From</label>
                      <input id="smtp-from" className="as-field" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} placeholder={'Tickets <tickets@ejemplo.com>'} required />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="as-toggle-wrap" htmlFor="smtp-secure">
                        <input
                          id="smtp-secure"
                          type="checkbox"
                          role="switch"
                          className="as-toggle"
                          checked={smtpSecure}
                          onChange={(e) => setSmtpSecure(e.target.checked)}
                        />
                        <span className="text-[13px] font-semibold text-primary">Usar conexión segura (SSL/TLS)</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button className="as-save-btn" type="submit" disabled={savingSmtp}>
                      {savingSmtp ? <><Spinner />Guardando…</> : <><IconSave />Guardar SMTP</>}
                    </button>
                    {smtpMsg && <MessageBanner message={smtpMsg.text} isError={smtpMsg.err} />}
                  </div>
                </form>
              </>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              SECTION 3 — BRANDING
          ════════════════════════════════════════════════════════════════ */}
          <div className="py-6" style={{ borderBottom: "1px solid var(--border-soft)" }}>
            <div className="as-section-label">
              <IconImage cls="h-3 w-3 shrink-0" />
              Branding lateral
            </div>
            <p className="mb-5 text-[12px] text-secondary">
              Logo personalizado que aparece en la barra lateral de la plataforma.
            </p>

            {loading ? (
              <div className="flex items-center gap-2 py-4 text-[12px] text-muted">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                Cargando...
              </div>
            ) : (
              <form onSubmit={onSubmitBranding} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
                  <div>
                    <label className="as-field-label" htmlFor="logo-url">URL o data:image</label>
                    <input
                      id="logo-url"
                      className="as-field"
                      value={sidebarLogoUrl}
                      onChange={(e) => setSidebarLogoUrl(e.target.value)}
                      placeholder="https://... o data:image/png;base64,..."
                    />
                  </div>
                  <div>
                    <label className="as-field-label">Subir imagen</label>
                    <div className="as-dropzone">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => void onLogoFileChange(e.target.files?.[0] ?? null)}
                        aria-label="Subir logo"
                      />
                      <IconUpload cls="h-7 w-7 text-[color:var(--brand-violet)] opacity-60" />
                      <p className="text-[12px] font-semibold text-secondary">Arrastrá o hacé clic para subir</p>
                      <p className="text-[11px] text-muted">PNG, JPG, SVG — máx 5 MB</p>
                    </div>
                  </div>
                </div>

                {sidebarLogoUrl ? (
                  <div
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5 max-w-lg"
                    style={{ borderColor: "var(--border-soft)", background: "var(--bg-sunken)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sidebarLogoUrl} alt="Logo lateral" className="h-10 w-10 rounded-lg object-contain border border-[color:var(--border-soft)]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-primary">Logo cargado</p>
                      <p className="text-[11px] text-muted truncate">{sidebarLogoUrl.startsWith("data:") ? "Imagen embebida (base64)" : sidebarLogoUrl}</p>
                    </div>
                    <button type="button" className="as-btn-ghost text-[11px]" onClick={() => setSidebarLogoUrl("")}>
                      Quitar
                    </button>
                  </div>
                ) : (
                  <p className="text-[12px] text-secondary italic">Sin logo personalizado — se usa el logo por defecto.</p>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button className="as-save-btn" type="submit" disabled={savingBranding}>
                    {savingBranding ? <><Spinner />Guardando…</> : <><IconSave />Guardar logo lateral</>}
                  </button>
                  {brandMsg && <MessageBanner message={brandMsg.text} isError={brandMsg.err} />}
                </div>
              </form>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              SECTION 4 — CHECKOUT FEES
          ════════════════════════════════════════════════════════════════ */}
          <div className="py-6" style={{ borderBottom: "1px solid var(--border-soft)" }}>
            <div className="as-section-label">
              <IconCreditCard cls="h-3 w-3 shrink-0" />
              Cargos del checkout
              {!loading && checkoutFeesUpdatedAt && (
                <span className="text-[10px] font-normal normal-case text-muted" style={{ fontFamily: "var(--font-mono)" }}>
                  Actualizado {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(checkoutFeesUpdatedAt))}
                </span>
              )}
            </div>
            <p className="mb-5 text-[12px] text-secondary">
              Recargos por ítem (monto fijo o porcentaje). Si no hay ítems activos, no se aplica ningún cargo extra.
            </p>

            {loading ? (
              <div className="flex items-center gap-2 py-4 text-[12px] text-muted">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                Cargando...
              </div>
            ) : (
              <form onSubmit={onSubmitCheckoutFees} className="space-y-4">
                <div className="space-y-3">
                  {checkoutFeeItems.map((item, idx) => (
                    <div key={item.id} className="as-fee-stub" style={{ animationDelay: `${idx * 0.06}s` }}>
                      <div className="grid gap-3 sm:grid-cols-12 items-end">
                        <div className="sm:col-span-4">
                          <label className="as-field-label" htmlFor={`fee-name-${item.id}`}>Nombre</label>
                          <input
                            id={`fee-name-${item.id}`}
                            className="as-field"
                            value={item.name}
                            onChange={(e) => updateCheckoutFeeItem(item.id, "name", e.target.value)}
                            placeholder="ej: Cargo de servicio"
                            required
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="as-field-label">Tipo</label>
                          <div className="as-seg">
                            <button type="button" className={`as-seg-opt ${item.mode === "PERCENT" ? "as-seg-opt-active" : ""}`} onClick={() => updateCheckoutFeeItem(item.id, "mode", "PERCENT")}>%</button>
                            <button type="button" className={`as-seg-opt ${item.mode === "FIXED" ? "as-seg-opt-active" : ""}`} onClick={() => updateCheckoutFeeItem(item.id, "mode", "FIXED")}>ARS</button>
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="as-field-label" htmlFor={`fee-value-${item.id}`}>Valor</label>
                          <input
                            id={`fee-value-${item.id}`}
                            className="as-field"
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.value}
                            onChange={(e) => updateCheckoutFeeItem(item.id, "value", Number(e.target.value))}
                            required
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="as-field-label">Estado</label>
                          <label className="as-toggle-wrap" htmlFor={`fee-enabled-${item.id}`}>
                            <input
                              id={`fee-enabled-${item.id}`}
                              type="checkbox"
                              role="switch"
                              className="as-toggle"
                              checked={item.enabled}
                              onChange={(e) => updateCheckoutFeeItem(item.id, "enabled", e.target.checked)}
                            />
                            <span className="text-[12px] font-semibold text-secondary">{item.enabled ? "Activo" : "Inactivo"}</span>
                          </label>
                        </div>
                        <div className="sm:col-span-1 flex justify-end sm:pb-0.5">
                          <button
                            type="button"
                            onClick={() => removeCheckoutFeeItem(item.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--border-soft)] text-secondary transition-colors hover:border-[color:var(--clr-danger-500)]/40 hover:text-[color:var(--clr-danger-700)]"
                            style={{ background: "var(--bg-surface)" }}
                            aria-label="Eliminar cargo"
                          >
                            <IconTrash cls="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {checkoutFeeItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--border-soft)] py-10 text-center">
                      <IconTag cls="h-8 w-8 mb-3 text-muted opacity-30" />
                      <p className="text-[13px] font-semibold text-muted">Sin cargos configurados</p>
                      <p className="mt-1 text-[11px] text-muted">Agregá un ítem para aplicar recargos al checkout.</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button type="button" className="as-btn-ghost" onClick={addCheckoutFeeItem}>
                    <IconPlus />
                    Agregar cargo
                  </button>
                  <button className="as-save-btn" type="submit" disabled={savingCheckoutFees}>
                    {savingCheckoutFees ? <><Spinner />Guardando…</> : <><IconSave />Guardar cargos</>}
                  </button>
                  {feesMsg && <MessageBanner message={feesMsg.text} isError={feesMsg.err} />}
                </div>
              </form>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              SECTION 5 — EMAIL TEMPLATE BUILDER
          ════════════════════════════════════════════════════════════════ */}
          <div className="py-6">
            <div className="as-section-label">
              <IconMail cls="h-3 w-3 shrink-0" />
              Email template builder
              {!loading && emailTemplateState.updatedAt && (
                <span className="text-[10px] font-normal normal-case text-muted" style={{ fontFamily: "var(--font-mono)" }}>
                  Actualizado {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(emailTemplateState.updatedAt))}
                </span>
              )}
            </div>
            <p className="mb-5 text-[12px] text-secondary">
              Editá los textos sin tocar HTML. El diseño profesional base se mantiene automáticamente.
            </p>

            {loading ? (
              <div className="flex items-center gap-2 py-4 text-[12px] text-muted">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                Cargando...
              </div>
            ) : (
              <>
                {/* Token chips */}
                <div
                  className="mb-5 rounded-lg border px-4 py-3"
                  style={{ borderColor: "var(--border-soft)", background: "var(--bg-sunken)" }}
                >
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Variables disponibles</p>
                  <div className="flex flex-wrap gap-1.5">
                    {emailTemplateState.tokens.map((token) => (
                      <span key={token} className="as-token-chip">{`{{${token}}}`}</span>
                    ))}
                  </div>
                </div>

                {/* Two-column layout */}
                <div className="grid gap-6 lg:grid-cols-2">

                  {/* Builder fields */}
                  <form onSubmit={onSubmitEmailTemplate} className="space-y-4">
                    <div>
                      <label className="as-field-label" htmlFor="et-subject">Asunto del correo</label>
                      <input id="et-subject" className="as-field" value={emailBuilder.subjectTemplate} onChange={(e) => updateBuilderField("subjectTemplate", e.target.value)} />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="as-field-label" htmlFor="et-brand">Marca (arriba)</label>
                        <input id="et-brand" className="as-field" value={emailBuilder.brandName} onChange={(e) => updateBuilderField("brandName", e.target.value)} />
                      </div>
                      <div>
                        <label className="as-field-label" htmlFor="et-badge">Título header</label>
                        <input id="et-badge" className="as-field" value={emailBuilder.badgeText} onChange={(e) => updateBuilderField("badgeText", e.target.value)} />
                      </div>
                    </div>

                    <div>
                      <label className="as-field-label" htmlFor="et-headline">Título principal</label>
                      <input id="et-headline" className="as-field" value={emailBuilder.headline} onChange={(e) => updateBuilderField("headline", e.target.value)} />
                    </div>

                    <div>
                      <label className="as-field-label" htmlFor="et-greeting">Saludo</label>
                      <input id="et-greeting" className="as-field" value={emailBuilder.greetingText} onChange={(e) => updateBuilderField("greetingText", e.target.value)} />
                    </div>

                    <div>
                      <label className="as-field-label" htmlFor="et-body">Texto principal</label>
                      <textarea id="et-body" className="as-field as-field-ta" value={emailBuilder.bodyText} onChange={(e) => updateBuilderField("bodyText", e.target.value)} />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="as-field-label" htmlFor="et-details">Título bloque detalle</label>
                        <input id="et-details" className="as-field" value={emailBuilder.detailsTitle} onChange={(e) => updateBuilderField("detailsTitle", e.target.value)} />
                      </div>
                      <div>
                        <label className="as-field-label" htmlFor="et-support">Texto soporte</label>
                        <input id="et-support" className="as-field" value={emailBuilder.supportText} onChange={(e) => updateBuilderField("supportText", e.target.value)} />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      {([
                        ["et-label-event",  "labelEvent",   "Label Evento"],
                        ["et-label-date",   "labelDate",    "Label Fecha"],
                        ["et-label-venue",  "labelVenue",   "Label Lugar"],
                        ["et-label-tickets","labelTickets", "Label Entradas"],
                        ["et-label-total",  "labelTotal",   "Label Total"],
                        ["et-label-order",  "labelOrder",   "Label Orden"],
                      ] as [string, keyof EmailTemplateBuilderConfig, string][]).map(([id, field, lbl]) => (
                        <div key={field}>
                          <label className="as-field-label" htmlFor={id}>{lbl}</label>
                          <input id={id} className="as-field" value={emailBuilder[field] as string} onChange={(e) => updateBuilderField(field, e.target.value)} />
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="as-field-label" htmlFor="et-footer">Footer legal</label>
                      <input id="et-footer" className="as-field" value={emailBuilder.footerText} onChange={(e) => updateBuilderField("footerText", e.target.value)} />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button className="as-save-btn" type="submit" disabled={savingEmailTemplate}>
                        {savingEmailTemplate ? <><Spinner />Guardando…</> : <><IconSave />Guardar plantilla</>}
                      </button>
                      <button type="button" className="as-btn-ghost" onClick={resetEmailTemplate}>
                        <IconRefresh />
                        Restaurar base
                      </button>
                      {emailMsg && <MessageBanner message={emailMsg.text} isError={emailMsg.err} />}
                    </div>
                  </form>

                  {/* Live preview */}
                  <div className="flex flex-col gap-3">
                    <div
                      className="sticky top-4 z-10 flex items-center justify-between rounded-lg border px-4 py-2.5"
                      style={{ borderColor: "var(--border-soft)", background: "var(--bg-surface)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="as-dot-pulse inline-block h-1.5 w-1.5 rounded-full bg-[#10b981]" aria-hidden="true" />
                        <p className="text-[12px] font-bold text-primary">Vista previa en vivo</p>
                      </div>
                      <p className="max-w-[180px] truncate text-[11px] text-secondary" title={previewSubject}>
                        {previewSubject}
                      </p>
                    </div>

                    <iframe
                      title="Preview email tickets"
                      className="h-[600px] w-full rounded-lg border border-[color:var(--border-soft)]"
                      style={{ background: "var(--bg-surface)" }}
                      sandbox=""
                      srcDoc={previewHtml}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
