"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { centsToCurrency } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES — UNCHANGED
───────────────────────────────────────────────────────────────────────────── */
type TicketTypeItem = {
  id: string;
  name: string;
  priceCents: number;
  stock: number;
  saleMode: "PUBLIC" | "COUPON_ONLY" | "HIDDEN";
  maxPerOrder: number | null;
  maxPerEmail: number | null;
};

type EventItem = {
  id: string;
  name: string;
  startsAt: string;
  venue: string | null;
  ticketTypes: TicketTypeItem[];
};

type CouponItem = {
  id: string;
  code: string;
  eventId: string;
  ticketTypeId: string | null;
  maxUses: number;
  usedCount: number;
  reservedUses?: number;
  isActive: boolean;
  expiresAt: string | null;
  discountType: "FIXED_PRICE" | "FIXED_DISCOUNT" | "PERCENT" | null;
  discountValue: number | null;
  createdAt: string;
  event: { name: string };
  ticketType: { name: string } | null;
};

type InvitationTicketItem = {
  id: string;
  code: string;
  attendeeName: string;
  attendeeEmail: string;
  downloadUrl: string;
  emailStatus: "SENT" | "FAILED" | null;
  emailError: string | null;
  emailedAt: string | null;
};

type InvitationOrderItem = {
  orderId: string;
  issuedBy: string;
  createdAt: string;
  quantity: number;
  eventName: string;
  ticketTypeName: string;
  tickets: InvitationTicketItem[];
};

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS — UNCHANGED
───────────────────────────────────────────────────────────────────────────── */
function parseAttendees(raw: string) {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const attendees: Array<{ name: string; email: string }> = [];

  for (const line of lines) {
    const chunks = line.split(",").map((part) => part.trim()).filter(Boolean);
    if (chunks.length < 2) continue;
    attendees.push({
      name: chunks[0],
      email: chunks[1]
    });
  }

  return attendees;
}

function toLocalDateTimeInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   KEYFRAMES & COMPONENT STYLES — v2 LIGHT VOICE
───────────────────────────────────────────────────────────────────────────── */
const CONSOLE_STYLES = `
@keyframes sc-fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes sc-slide-in {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes sc-scale-in {
  from { opacity: 0; transform: scale(0.97) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes sc-dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.45; transform: scale(0.72); }
}
@keyframes sc-dot-pulse-magenta {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.45; transform: scale(0.72); }
}
@keyframes sc-shimmer {
  0%   { background-position: -600px 0; }
  100% { background-position:  600px 0; }
}
@keyframes sc-toast-in {
  from { opacity: 0; transform: translateX(60px) scale(0.95); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes sc-price-flash {
  0%   { opacity: 0.55; transform: scale(0.94); }
  100% { opacity: 1;    transform: scale(1); }
}
@keyframes sc-row-in {
  from { opacity: 0; transform: translateX(-5px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* ── Page mount stagger ─────────────────────────────────────────────────── */
.sc-page  { animation: sc-fade-up 0.52s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) 0.02s both; }
.sc-sec-1 { animation: sc-fade-up 0.52s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) 0.08s both; }
.sc-sec-2 { animation: sc-fade-up 0.52s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) 0.16s both; }
.sc-sec-3 { animation: sc-fade-up 0.52s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) 0.24s both; }

/* ── Overline label ─────────────────────────────────────────────────────── */
.sc-overline {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

/* ── Skeleton shimmer ───────────────────────────────────────────────────── */
.sc-shimmer {
  background: linear-gradient(
    90deg,
    var(--clr-arena-100, #F1F2F6) 0%,
    var(--clr-arena-200, #E5E7EF) 50%,
    var(--clr-arena-100, #F1F2F6) 100%
  );
  background-size: 600px 100%;
  animation: sc-shimmer 1.5s ease-in-out infinite;
  border-radius: 6px;
}

/* ── Price flash ────────────────────────────────────────────────────────── */
.sc-price-flash { animation: sc-price-flash 0.28s cubic-bezier(0.34,1.56,0.64,1) both; }

/* ── Pulse dots ─────────────────────────────────────────────────────────── */
.sc-dot-active  { animation: sc-dot-pulse 2.2s ease-in-out infinite; }
.sc-dot-magenta { animation: sc-dot-pulse-magenta 2s ease-in-out infinite; }

/* ── Coupon row ─────────────────────────────────────────────────────────── */
.sc-coupon-row {
  position: relative;
  transition: background-color 0.11s ease;
  animation: sc-row-in 0.36s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) both;
}
.sc-coupon-row:nth-child(1)  { animation-delay: 0.26s; }
.sc-coupon-row:nth-child(2)  { animation-delay: 0.31s; }
.sc-coupon-row:nth-child(3)  { animation-delay: 0.36s; }
.sc-coupon-row:nth-child(4)  { animation-delay: 0.41s; }
.sc-coupon-row:nth-child(5)  { animation-delay: 0.46s; }
.sc-coupon-row:nth-child(6)  { animation-delay: 0.51s; }
.sc-coupon-row:nth-child(7)  { animation-delay: 0.56s; }
.sc-coupon-row:nth-child(8)  { animation-delay: 0.61s; }
.sc-coupon-row:hover { background-color: var(--bg-sunken, #F3F4F8); }

/* Left accent bar per discount type */
.sc-coupon-row::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
}
.sc-coupon-row[data-dtype="PERCENT"]::before        { background: #10B981; }
.sc-coupon-row[data-dtype="FIXED_DISCOUNT"]::before { background: var(--brand-violet, #5B21B6); }
.sc-coupon-row[data-dtype="FIXED_PRICE"]::before    { background: var(--brand-magenta, #EC2A8A); }

/* ── Invitation card ────────────────────────────────────────────────────── */
.sc-invite-card {
  position: relative;
  transition: border-color 0.14s ease, box-shadow 0.14s ease, transform 0.14s ease;
  animation: sc-row-in 0.38s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) both;
}
.sc-invite-card:nth-child(1) { animation-delay: 0.24s; }
.sc-invite-card:nth-child(2) { animation-delay: 0.30s; }
.sc-invite-card:nth-child(3) { animation-delay: 0.36s; }
.sc-invite-card:nth-child(4) { animation-delay: 0.42s; }
.sc-invite-card:nth-child(5) { animation-delay: 0.48s; }
.sc-invite-card:hover { transform: translateY(-1px); }

/* ── Ticket stub ────────────────────────────────────────────────────────── */
.sc-ticket-stub {
  position: relative;
  transition: border-color 0.14s ease;
}
.sc-ticket-stub::before,
.sc-ticket-stub::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 12px; height: 12px;
  border-radius: 9999px;
  background: var(--bg-page, #F7F7FB);
  z-index: 2;
}
.sc-ticket-stub::before { left: -6px; }
.sc-ticket-stub::after  { right: -6px; }

/* Perforation divider */
.sc-perf {
  border: none;
  border-top: 2px dashed var(--border-soft, #E5E7EF);
  margin: 0;
}

/* ── Toast ──────────────────────────────────────────────────────────────── */
.sc-toast {
  animation: sc-toast-in 0.36s cubic-bezier(0.22,1,0.36,1) both;
}

/* ── Icon action button (28×28, ::after tooltip via data-tip) ───────────── */
.sc-icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px; height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-muted, #7A7E99);
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
  flex-shrink: 0;
}
.sc-icon-btn:hover {
  background-color: var(--bg-sunken, #F3F4F8);
  color: var(--text-primary, #15162B);
}
.sc-icon-btn-danger:hover {
  background-color: #FEE8EC;
  color: #9F1239;
}
.sc-icon-btn-success:hover {
  background-color: #E9F9EE;
  color: #117A30;
}
.sc-icon-btn::after {
  content: attr(data-tip);
  position: absolute;
  bottom: calc(100% + 5px);
  left: 50%; transform: translateX(-50%);
  white-space: nowrap;
  font-size: 10px;
  font-weight: 600;
  font-family: var(--font-body, system-ui);
  padding: 3px 7px;
  border-radius: 5px;
  background: var(--clr-arena-700, #15162B);
  color: #fff;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.14s ease;
  z-index: 20;
}
.sc-icon-btn:hover::after { opacity: 1; }

/* ── Attendees / invitees textarea — light, monospace ───────────────────── */
.sc-attendees-textarea {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 1.75;
  letter-spacing: 0.04em;
  background: var(--bg-sunken, #F3F4F8);
  color: var(--text-primary, #15162B);
  border: 1.5px solid var(--border-soft, #E5E7EF);
  border-radius: 10px;
  width: 100%;
  resize: vertical;
  outline: none;
  padding: 10px 12px;
  transition: border-color 0.14s ease, box-shadow 0.14s ease, background 0.14s ease;
  caret-color: var(--brand-violet, #5B21B6);
}
.sc-attendees-textarea:focus {
  background: var(--bg-surface, #FFFFFF);
  border-color: var(--brand-violet, #5B21B6);
  box-shadow: 0 0 0 3px rgba(91,33,182,0.12);
}
.sc-attendees-textarea::placeholder {
  color: var(--text-muted, #7A7E99);
  opacity: 0.65;
}

/* ── Order summary card ─────────────────────────────────────────────────── */
.sc-order-card {
  position: relative;
  overflow: visible;
}

/* ── Segmented payment control — same pattern as ev-seg-btn ────────────── */
.sc-seg-btn {
  display: inline-flex;
  align-items: center;
  padding: 4px 11px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
  white-space: nowrap;
}
.sc-seg-btn:hover { color: var(--text-primary); background-color: var(--bg-sunken); }
.sc-seg-btn.active {
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(21,22,43,0.08);
}

/* ── Glow ring for latest invitation order ──────────────────────────────── */
@keyframes sc-glow-ring {
  0%, 100% { box-shadow: 0 0 0 2px rgba(236,42,138,0.25), 0 0 12px rgba(236,42,138,0.08); }
  50%       { box-shadow: 0 0 0 3px rgba(236,42,138,0.38), 0 0 20px rgba(236,42,138,0.14); }
}
.sc-latest-glow {
  animation: sc-glow-ring 2.5s ease-in-out infinite;
}
`;

/* ─────────────────────────────────────────────────────────────────────────────
   SKELETON BLOCK
───────────────────────────────────────────────────────────────────────────── */
function SkeletonSection() {
  return (
    <div className="space-y-3 pt-4">
      <div className="sc-shimmer h-10 w-full rounded-lg" />
      <div className="sc-shimmer h-10 w-3/4 rounded-lg" />
      <div className="sc-shimmer h-24 w-full rounded-lg" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SECTION PANEL WRAPPER — v2 white card with overline header
───────────────────────────────────────────────────────────────────────────── */
function SectionPanel({
  id,
  animClass,
  accentColor,
  icon,
  title,
  subtitle,
  badge,
  children,
}: {
  id: string;
  animClass: string;
  accentColor: string;
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`${animClass} overflow-hidden rounded-2xl border`}
      style={{
        borderColor: "var(--border-soft, #E5E7EF)",
        background: "var(--bg-surface, #FFFFFF)",
        boxShadow: "var(--shadow-sm)",
      }}
      aria-labelledby={id}
    >
      {/* Top accent line */}
      <div
        className="h-[3px] w-full"
        style={{ background: accentColor }}
        aria-hidden="true"
      />

      {/* Section header */}
      <div
        className="flex items-center gap-3 px-6 py-4"
        style={{ borderBottom: "1px solid var(--border-soft, #E5E7EF)" }}
      >
        {/* 36×36 flat icon circle */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${accentColor}18` }}
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 id={id} className="flex flex-wrap items-center gap-2 text-[14px] font-bold" style={{ color: "var(--text-primary, #15162B)" }}>
            {title}
            {badge}
          </h2>
          <p className="text-[11px]" style={{ color: "var(--text-secondary, #4B4F6B)" }}>
            {subtitle}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   RECEIPT CARD — clean white, perforation aesthetic preserved
───────────────────────────────────────────────────────────────────────────── */
function ReceiptCard({
  headerBg,
  headerText,
  eventName,
  venue,
  lineItems,
  totalLabel,
  totalValue,
  totalSub,
  submitDisabled,
  onSubmit,
  submitLabel,
  submittingLabel,
  isSubmitting,
}: {
  headerBg: string;
  headerText: string;
  eventName: string;
  venue?: string | null;
  lineItems: Array<{ label: string; value: React.ReactNode }>;
  totalLabel: string;
  totalValue: React.ReactNode;
  totalSub?: React.ReactNode;
  submitDisabled: boolean;
  onSubmit?: () => void;
  submitLabel: React.ReactNode;
  submittingLabel: React.ReactNode;
  isSubmitting: boolean;
}) {
  return (
    <aside className="sc-order-card overflow-hidden rounded-2xl border lg:sticky lg:top-6 lg:h-fit"
      style={{
        borderColor: "var(--border-soft, #E5E7EF)",
        background: "var(--bg-surface, #FFFFFF)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Card header — colored band */}
      <div className="px-5 py-4" style={{ background: headerBg }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">{headerText}</p>
        <p className="mt-0.5 font-display text-[1.1rem] font-extrabold leading-tight text-white">
          {eventName}
        </p>
        {venue && (
          <p className="mt-0.5 text-[11px] text-white/50">{venue}</p>
        )}
      </div>

      {/* Perforation */}
      <div className="relative overflow-hidden">
        <div className="absolute -left-[7px] top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full" style={{ background: "var(--bg-page, #F7F7FB)" }} aria-hidden="true" />
        <div className="absolute -right-[7px] top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full" style={{ background: "var(--bg-page, #F7F7FB)" }} aria-hidden="true" />
        <hr className="sc-perf" />
      </div>

      {/* Line items */}
      <div className="space-y-2.5 px-5 py-4 text-[13px]">
        {lineItems.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span style={{ color: "var(--text-secondary, #4B4F6B)" }}>{item.label}</span>
            <span className="font-semibold" style={{ color: "var(--text-primary, #15162B)" }}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* Second perforation */}
      <div className="relative overflow-hidden">
        <div className="absolute -left-[7px] top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full" style={{ background: "var(--bg-page, #F7F7FB)" }} aria-hidden="true" />
        <div className="absolute -right-[7px] top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full" style={{ background: "var(--bg-page, #F7F7FB)" }} aria-hidden="true" />
        <hr className="sc-perf" />
      </div>

      {/* Total + submit */}
      <div className="px-5 py-4">
        <div className="flex items-end justify-between">
          <span className="font-display text-[13px] font-bold" style={{ color: "var(--text-secondary, #4B4F6B)" }}>{totalLabel}</span>
          <div className="text-right">
            {totalValue}
            {totalSub}
          </div>
        </div>

        <button
          type="submit"
          onClick={onSubmit}
          disabled={submitDisabled}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-6 py-2.5 text-[13px] font-bold text-white transition-all duration-150 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
          style={{
            background: submitDisabled ? "var(--border-strong, #D1D5E0)" : "var(--grad-hero, linear-gradient(135deg,#6D28D9,#8B5CF6,#EC4899))",
            boxShadow: submitDisabled ? "none" : "0 4px 16px rgba(109,40,217,0.28)",
          }}
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
        <p className="mt-2 text-center text-[10.5px]" style={{ color: "var(--text-muted, #7A7E99)" }}>
          Se crea una orden y se emiten tickets para cada asistente.
        </p>
      </div>
    </aside>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT — SalesConsole
───────────────────────────────────────────────────────────────────────────── */
export function SalesConsole() {
  /* ── ALL STATE — PRESERVED EXACTLY ── */
  const [loading, setLoading] = useState(true);
  const [savingIssue, setSavingIssue] = useState(false);
  const [savingInvitation, setSavingInvitation] = useState(false);
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationOrderItem[]>([]);

  const [eventId, setEventId] = useState("");
  const [ticketTypeId, setTicketTypeId] = useState("");
  const [attendeesText, setAttendeesText] = useState("");

  const [inviteEventId, setInviteEventId] = useState("");
  const [inviteTicketTypeId, setInviteTicketTypeId] = useState("");
  const [inviteesText, setInviteesText] = useState("");
  const [latestInvitationOrderId, setLatestInvitationOrderId] = useState<string | null>(null);

  const [couponCode, setCouponCode] = useState("");
  const [couponEventId, setCouponEventId] = useState("");
  const [couponTicketTypeId, setCouponTicketTypeId] = useState("");
  const [couponMaxUses, setCouponMaxUses] = useState(50);
  const [couponExpiresAt, setCouponExpiresAt] = useState("");
  const [couponDiscountType, setCouponDiscountType] = useState<"FIXED_PRICE" | "FIXED_DISCOUNT" | "PERCENT">("PERCENT");
  const [couponDiscountValue, setCouponDiscountValue] = useState(10);

  /* ── ALL DERIVED STATE — PRESERVED EXACTLY ── */
  const selectedEvent = useMemo(() => events.find((item) => item.id === eventId) ?? null, [events, eventId]);
  const selectedInviteEvent = useMemo(() => events.find((item) => item.id === inviteEventId) ?? null, [events, inviteEventId]);
  const selectedCouponEvent = useMemo(() => events.find((item) => item.id === couponEventId) ?? null, [events, couponEventId]);
  const selectedTicketType = useMemo(
    () => selectedEvent?.ticketTypes.find((item) => item.id === ticketTypeId) ?? null,
    [selectedEvent, ticketTypeId]
  );
  const selectedInviteTicketType = useMemo(
    () => selectedInviteEvent?.ticketTypes.find((item) => item.id === inviteTicketTypeId) ?? null,
    [selectedInviteEvent, inviteTicketTypeId]
  );
  const attendeesPreview = useMemo(() => parseAttendees(attendeesText), [attendeesText]);
  const inviteesPreview = useMemo(() => parseAttendees(inviteesText), [inviteesText]);
  const previewTotalCents = (selectedTicketType?.priceCents ?? 0) * attendeesPreview.length;
  const invitationReferenceTotalCents = (selectedInviteTicketType?.priceCents ?? 0) * inviteesPreview.length;

  /* ── ALL HANDLERS — PRESERVED EXACTLY ── */

  async function readJsonSafe(response: Response) {
    const raw = await response.text();
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { error: raw };
    }
  }

  function showMessage(text: string, isError = false) {
    setMessage(text);
    setMessageIsError(isError);
    setTimeout(() => setMessage(null), 5000);
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sales/bootstrap");
      const data = await readJsonSafe(res);
      setLoading(false);

      if (!res.ok) {
        const errorText = typeof data.error === "string" ? data.error : "No se pudo cargar consola de ventas";
        showMessage(errorText, true);
        return;
      }

      const eventsData = Array.isArray(data.events) ? (data.events as EventItem[]) : [];
      const couponsData = Array.isArray(data.coupons) ? (data.coupons as CouponItem[]) : [];
      const invitationsData = Array.isArray(data.invitations) ? (data.invitations as InvitationOrderItem[]) : [];

      setEvents(eventsData);
      setCoupons(couponsData);
      setInvitations(invitationsData);

      const firstEventId = eventsData[0]?.id ?? "";
      setEventId((current) => current || firstEventId);
      setInviteEventId((current) => current || firstEventId);
      setCouponEventId((current) => current || firstEventId);

      const firstTicketTypeId = eventsData[0]?.ticketTypes?.[0]?.id ?? "";
      setTicketTypeId((current) => current || firstTicketTypeId);
      setInviteTicketTypeId((current) => current || firstTicketTypeId);
    } catch {
      setLoading(false);
      showMessage("No se pudo conectar con la consola de ventas", true);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedEvent) {
      setTicketTypeId("");
      return;
    }
    if (!selectedEvent.ticketTypes.some((item) => item.id === ticketTypeId)) {
      setTicketTypeId(selectedEvent.ticketTypes[0]?.id ?? "");
    }
  }, [selectedEvent, ticketTypeId]);

  useEffect(() => {
    if (!selectedCouponEvent) {
      setCouponTicketTypeId("");
      return;
    }
    if (couponTicketTypeId && !selectedCouponEvent.ticketTypes.some((item) => item.id === couponTicketTypeId)) {
      setCouponTicketTypeId("");
    }
  }, [selectedCouponEvent, couponTicketTypeId]);

  useEffect(() => {
    if (!selectedInviteEvent) {
      setInviteTicketTypeId("");
      return;
    }
    if (!selectedInviteEvent.ticketTypes.some((item) => item.id === inviteTicketTypeId)) {
      setInviteTicketTypeId(selectedInviteEvent.ticketTypes[0]?.id ?? "");
    }
  }, [selectedInviteEvent, inviteTicketTypeId]);

  async function onManualIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eventId || !ticketTypeId) {
      showMessage("Selecciona evento y tipo de ticket", true);
      return;
    }
    const attendees = parseAttendees(attendeesText);
    if (attendees.length === 0) {
      showMessage("Debes cargar asistentes como 'Nombre,Email' (una linea por ticket)", true);
      return;
    }
    setSavingIssue(true);
    setMessage(null);
    const res = await fetch("/api/sales/manual-issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, ticketTypeId, attendees })
    });
    const data = await readJsonSafe(res);
    setSavingIssue(false);
    if (!res.ok) {
      const errorText = typeof data.error === "string" ? data.error : "No se pudo emitir entradas manualmente";
      showMessage(errorText, true);
      return;
    }
    const payload = data as { created?: unknown; eventName?: unknown; orderId?: unknown };
    const createdCount = typeof payload.created === "number" ? payload.created : attendees.length;
    const issuedEventName = typeof payload.eventName === "string" ? payload.eventName : "evento";
    const issuedOrderId = typeof payload.orderId === "string" ? payload.orderId : "-";
    setAttendeesText("");
    showMessage(`Emision OK: ${createdCount} tickets creados para ${issuedEventName}. Orden: ${issuedOrderId}`);
    void loadData();
  }

  async function onCreateCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!couponEventId) {
      showMessage("Selecciona un evento para el cupon", true);
      return;
    }
    setSavingCoupon(true);
    setMessage(null);
    const expiresAtDate = couponExpiresAt ? new Date(couponExpiresAt) : null;
    if (expiresAtDate && Number.isNaN(expiresAtDate.getTime())) {
      setSavingCoupon(false);
      showMessage("Fecha de vencimiento invalida", true);
      return;
    }
    if (couponDiscountType === "PERCENT" && (couponDiscountValue < 1 || couponDiscountValue > 100)) {
      setSavingCoupon(false);
      showMessage("El porcentaje debe estar entre 1 y 100", true);
      return;
    }
    if (couponDiscountType === "FIXED_DISCOUNT" && couponDiscountValue < 1) {
      setSavingCoupon(false);
      showMessage("El descuento fijo debe ser mayor a 0", true);
      return;
    }
    if (couponDiscountType === "FIXED_PRICE" && couponDiscountValue < 0) {
      setSavingCoupon(false);
      showMessage("El precio fijo no puede ser negativo", true);
      return;
    }
    const normalizedDiscountValue =
      couponDiscountType === "PERCENT" ? Math.round(couponDiscountValue) : Math.round(couponDiscountValue * 100);
    const res = await fetch("/api/sales/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: couponCode,
        eventId: couponEventId,
        ticketTypeId: couponTicketTypeId || null,
        maxUses: couponMaxUses,
        expiresAt: expiresAtDate ? expiresAtDate.toISOString() : null,
        discountType: couponDiscountType,
        discountValue: normalizedDiscountValue
      })
    });
    const data = await readJsonSafe(res);
    setSavingCoupon(false);
    if (!res.ok) {
      const errorText = typeof data.error === "string" ? data.error : "No se pudo crear cupon";
      showMessage(errorText, true);
      return;
    }
    setCouponCode("");
    setCouponMaxUses(50);
    setCouponExpiresAt("");
    setCouponTicketTypeId("");
    setCouponDiscountType("PERCENT");
    setCouponDiscountValue(10);
    const createdCouponCode =
      data.coupon && typeof data.coupon === "object" && "code" in data.coupon && typeof data.coupon.code === "string"
        ? data.coupon.code
        : couponCode;
    showMessage(`Cupon ${createdCouponCode} creado`);
    void loadData();
  }

  async function onCreateInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteEventId || !inviteTicketTypeId) {
      showMessage("Selecciona evento y tipo de ticket para la invitacion", true);
      return;
    }
    const attendees = parseAttendees(inviteesText);
    if (attendees.length === 0) {
      showMessage("Debes cargar invitados como 'Nombre,Email' (una linea por ticket)", true);
      return;
    }
    setSavingInvitation(true);
    setMessage(null);
    const res = await fetch("/api/sales/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: inviteEventId, ticketTypeId: inviteTicketTypeId, attendees })
    });
    const data = await readJsonSafe(res);
    setSavingInvitation(false);
    if (!res.ok) {
      const errorText = typeof data.error === "string" ? data.error : "No se pudieron emitir invitaciones";
      showMessage(errorText, true);
      return;
    }
    const payload = data as {
      orderId?: unknown;
      created?: unknown;
      eventName?: unknown;
      emailsSent?: unknown;
      emailsFailed?: unknown;
    };
    const createdCount = typeof payload.created === "number" ? payload.created : attendees.length;
    const eventName = typeof payload.eventName === "string" ? payload.eventName : "evento";
    const orderId = typeof payload.orderId === "string" ? payload.orderId : null;
    const emailsSent = typeof payload.emailsSent === "number" ? payload.emailsSent : 0;
    const emailsFailed = typeof payload.emailsFailed === "number" ? payload.emailsFailed : 0;
    setInviteesText("");
    setLatestInvitationOrderId(orderId);
    showMessage(`Invitaciones OK: ${createdCount} tickets para ${eventName}. Emails enviados: ${emailsSent}. Fallidos: ${emailsFailed}.`);
    await loadData();
  }

  async function onToggleCoupon(coupon: CouponItem) {
    const res = await fetch(`/api/sales/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !coupon.isActive })
    });
    const data = await readJsonSafe(res);
    if (!res.ok) {
      const errorText = typeof data.error === "string" ? data.error : "No se pudo actualizar cupon";
      showMessage(errorText, true);
      return;
    }
    const updatedCouponCode =
      data.coupon && typeof data.coupon === "object" && "code" in data.coupon && typeof data.coupon.code === "string"
        ? data.coupon.code
        : coupon.code;
    showMessage(`Cupon ${updatedCouponCode} actualizado`);
    void loadData();
  }

  async function onUpdateMaxUses(coupon: CouponItem) {
    const value = window.prompt(`Nuevo limite de uso para ${coupon.code}`, String(coupon.maxUses));
    if (!value) return;
    const maxUses = Number(value);
    if (!Number.isInteger(maxUses) || maxUses <= 0) {
      showMessage("El limite debe ser entero positivo", true);
      return;
    }
    const res = await fetch(`/api/sales/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxUses })
    });
    const data = await readJsonSafe(res);
    if (!res.ok) {
      const errorText = typeof data.error === "string" ? data.error : "No se pudo actualizar maxUses";
      showMessage(errorText, true);
      return;
    }
    const updatedCouponCode =
      data.coupon && typeof data.coupon === "object" && "code" in data.coupon && typeof data.coupon.code === "string"
        ? data.coupon.code
        : coupon.code;
    showMessage(`Limite de ${updatedCouponCode} actualizado`);
    void loadData();
  }

  /* ── Discount type label ── */
  const discountLabel =
    couponDiscountType === "PERCENT"
      ? "Porcentaje (%)"
      : couponDiscountType === "FIXED_DISCOUNT"
        ? "Descuento fijo (ARS)"
        : "Precio fijo (ARS)";

  /* ── JSX ── */
  return (
    <>
      <style>{CONSOLE_STYLES}</style>

      {/* ── FLOATING TOAST ─────────────────────────────────────────────────── */}
      {message && (
        <div
          className="sc-toast fixed right-5 top-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3"
          style={{
            background: messageIsError ? "#FEE8EC" : "var(--clr-success-50, #E9F9EE)",
            borderColor: messageIsError ? "rgba(225,29,72,0.25)" : "rgba(31,174,74,0.3)",
            boxShadow: "0 8px 32px rgba(21,22,43,0.14)",
          }}
          role="status"
          aria-live="polite"
        >
          {messageIsError ? (
            <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          ) : (
            <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="#1FAE4A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
          <p
            className="flex-1 text-[13px] font-semibold leading-snug"
            style={{ color: messageIsError ? "#9F1239" : "var(--clr-success-700, #117A30)" }}
          >
            {message}
          </p>
          <button
            type="button"
            className="mt-0.5 shrink-0 transition-colors"
            style={{ color: "var(--text-muted, #7A7E99)" }}
            onClick={() => setMessage(null)}
            aria-label="Cerrar"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="sc-page space-y-6">

        {/* ═══════════════════════════════════════════════════════════════════
            HERO HEADER — v2 editorial bare-div pattern
        ════════════════════════════════════════════════════════════════════ */}
        <header
          className="flex flex-wrap items-start justify-between gap-5 pb-5"
          style={{ borderBottom: "1px solid var(--border-soft, #E5E7EF)" }}
        >
          <div>
            {/* Overline */}
            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--brand-violet, #5B21B6)" }}
            >
              Operaciones
            </p>
            {/* Display title */}
            <h1
              className="mt-1 font-display text-[1.75rem] font-extrabold leading-tight tracking-tight"
              style={{
                fontFamily: "var(--font-display, 'Poppins', sans-serif)",
                color: "var(--text-primary, #15162B)",
              }}
            >
              Consola de ventas
              <span style={{ color: "var(--brand-magenta, #EC2A8A)" }}>.</span>
            </h1>
            {/* Subtext */}
            <p className="mt-1 max-w-lg text-[12px]" style={{ color: "var(--text-secondary, #4B4F6B)" }}>
              Terminal operativa para emisión manual, invitaciones cortesía y gestión de cupones.
            </p>
          </div>

          {/* Right: operator badge + stat chips */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {/* Operator pill */}
            <div
              className="flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5"
              style={{
                borderColor: "var(--border-soft, #E5E7EF)",
                background: "var(--bg-surface, #FFFFFF)",
              }}
            >
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ background: "var(--grad-hero, linear-gradient(135deg,#6D28D9,#EC4899))" }}
                aria-hidden="true"
              >
                OP
              </div>
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary, #4B4F6B)" }}>
                Operador activo
              </span>
              <span
                className="sc-dot-active h-2 w-2 rounded-full"
                style={{ background: "var(--clr-success-500, #1FAE4A)" }}
                aria-hidden="true"
              />
            </div>

            {/* KPI chips — only when loaded */}
            {!loading && (
              <>
                <div
                  className="flex flex-col items-center rounded-xl border px-4 py-2"
                  style={{
                    borderColor: "var(--border-soft, #E5E7EF)",
                    background: "var(--bg-surface, #FFFFFF)",
                    minWidth: 54,
                  }}
                >
                  <span
                    className="font-display text-[1.15rem] font-extrabold leading-none tabular-nums"
                    style={{ color: "var(--brand-violet, #5B21B6)" }}
                  >
                    {events.length}
                  </span>
                  <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted, #7A7E99)" }}>
                    Eventos
                  </span>
                </div>
                <div
                  className="flex flex-col items-center rounded-xl border px-4 py-2"
                  style={{
                    borderColor: coupons.length > 0 ? "rgba(236,42,138,0.25)" : "var(--border-soft, #E5E7EF)",
                    background: coupons.length > 0 ? "rgba(236,42,138,0.04)" : "var(--bg-surface, #FFFFFF)",
                    minWidth: 54,
                  }}
                >
                  <span
                    className="font-display text-[1.15rem] font-extrabold leading-none tabular-nums"
                    style={{ color: coupons.length > 0 ? "var(--brand-magenta, #EC2A8A)" : "var(--text-muted, #7A7E99)" }}
                  >
                    {coupons.length}
                  </span>
                  <span
                    className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: coupons.length > 0 ? "var(--brand-magenta, #EC2A8A)" : "var(--text-muted, #7A7E99)" }}
                  >
                    Cupones
                  </span>
                </div>
                <div
                  className="flex flex-col items-center rounded-xl border px-4 py-2"
                  style={{
                    borderColor: "var(--border-soft, #E5E7EF)",
                    background: "var(--bg-surface, #FFFFFF)",
                    minWidth: 54,
                  }}
                >
                  <span
                    className="font-display text-[1.15rem] font-extrabold leading-none tabular-nums"
                    style={{ color: "var(--clr-success-700, #117A30)" }}
                  >
                    {invitations.length}
                  </span>
                  <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted, #7A7E99)" }}>
                    Invit.
                  </span>
                </div>
              </>
            )}
          </div>
        </header>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 1 — TERMINAL DE VENTAS MANUALES
        ════════════════════════════════════════════════════════════════════ */}
        <SectionPanel
          id="sec-manual-heading"
          animClass="sc-sec-1"
          accentColor="var(--grad-hero, linear-gradient(90deg,#6D28D9,#EC4899))"
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand-violet, #5B21B6)" }}>
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
              <path d="M7 8h.01M11 8h.01M15 8h.01M7 12h10" />
            </svg>
          }
          title="Terminal de ventas manuales"
          subtitle="Emite tickets pagos de forma manual — caja operativa para el equipo."
        >
          {loading ? (
            <SkeletonSection />
          ) : (
            <form onSubmit={onManualIssue} className="grid gap-5 lg:grid-cols-[1fr_340px]">

              {/* ── LEFT: inputs ── */}
              <div className="space-y-4">

                {/* Attendees textarea */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label
                      htmlFor="manual-attendees"
                      className="sc-overline"
                      style={{ color: "var(--text-muted, #7A7E99)" }}
                    >
                      Log de asistentes
                    </label>
                    {attendeesPreview.length > 0 && (
                      <span
                        className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold"
                        style={{
                          borderColor: "rgba(91,33,182,0.22)",
                          background: "rgba(91,33,182,0.06)",
                          color: "var(--brand-violet, #5B21B6)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {attendeesPreview.length} línea{attendeesPreview.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <textarea
                    id="manual-attendees"
                    className="sc-attendees-textarea"
                    style={{ minHeight: 144 }}
                    value={attendeesText}
                    onChange={(event) => setAttendeesText(event.target.value)}
                    placeholder={"Ana Perez,ana@email.com\nJuan Gomez,juan@email.com"}
                    required
                    aria-label="Asistentes en formato Nombre,Email"
                  />
                  <p className="mt-1.5 text-[10.5px]" style={{ color: "var(--text-muted, #7A7E99)" }}>
                    Formato:{" "}
                    <code style={{ fontFamily: "var(--font-mono)" }}>Nombre,Email</code>{" "}
                    — una entrada por línea.
                  </p>
                </div>

                {/* Event + ticket type */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="manual-event" className="label">Evento</label>
                    <select
                      id="manual-event"
                      className="field"
                      value={eventId}
                      onChange={(event) => setEventId(event.target.value)}
                      required
                    >
                      {events.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({new Date(item.startsAt).toLocaleDateString("es-AR")})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="manual-ticket" className="label">Tipo de ticket</label>
                    <select
                      id="manual-ticket"
                      className="field"
                      value={ticketTypeId}
                      onChange={(event) => setTicketTypeId(event.target.value)}
                      required
                    >
                      {(selectedEvent?.ticketTypes ?? []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} - {centsToCurrency(item.priceCents)} [{item.saleMode}]
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── RIGHT: order summary card ── */}
              <ReceiptCard
                headerBg="linear-gradient(135deg, var(--clr-forest-800, #2E1065) 0%, var(--brand-violet, #5B21B6) 100%)"
                headerText="Cuenta"
                eventName={selectedEvent?.name ?? "Sin evento"}
                venue={selectedEvent?.venue}
                lineItems={[
                  { label: "Ticket", value: selectedTicketType?.name ?? "—" },
                  {
                    label: "Cantidad",
                    value: (
                      <span key={attendeesPreview.length} className="sc-price-flash font-display font-bold">
                        {attendeesPreview.length}
                      </span>
                    )
                  },
                  {
                    label: "Precio unitario",
                    value: selectedTicketType ? centsToCurrency(selectedTicketType.priceCents) : "—"
                  },
                ]}
                totalLabel="Total"
                totalValue={
                  <span
                    key={previewTotalCents}
                    className="sc-price-flash font-display text-[1.6rem] font-extrabold leading-none"
                    style={{ color: "var(--brand-magenta, #EC2A8A)" }}
                  >
                    {centsToCurrency(previewTotalCents)}
                  </span>
                }
                submitDisabled={savingIssue || !eventId || !ticketTypeId}
                submitLabel={
                  <>
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                    </svg>
                    Emitir y procesar venta
                  </>
                }
                submittingLabel={
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Emitiendo...
                  </>
                }
                isSubmitting={savingIssue}
              />
            </form>
          )}
        </SectionPanel>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 2 — INVITACIONES
        ════════════════════════════════════════════════════════════════════ */}
        <SectionPanel
          id="sec-invitations-heading"
          animClass="sc-sec-2"
          accentColor="linear-gradient(90deg, #F59E0B 0%, #F97316 50%, #EF4444 100%)"
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#F59E0B" }}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          }
          title="Invitaciones"
          subtitle="Tickets gratuitos con envío por email — importe final $0."
          badge={
            <span
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold"
              style={{
                borderColor: "rgba(245,158,11,0.30)",
                background: "rgba(245,158,11,0.08)",
                color: "#B45309",
              }}
            >
              Cortesía
            </span>
          }
        >
          {loading ? (
            <SkeletonSection />
          ) : (
            <>
              <form onSubmit={onCreateInvitation} className="grid gap-5 lg:grid-cols-[1fr_340px]">

                {/* ── LEFT: inputs ── */}
                <div className="space-y-4">
                  {/* Invitees textarea */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label
                        htmlFor="invite-attendees"
                        className="sc-overline"
                        style={{ color: "var(--text-muted, #7A7E99)" }}
                      >
                        Lista de invitados
                      </label>
                      {inviteesPreview.length > 0 && (
                        <span
                          className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold"
                          style={{
                            borderColor: "rgba(245,158,11,0.30)",
                            background: "rgba(245,158,11,0.08)",
                            color: "#B45309",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {inviteesPreview.length} invitado{inviteesPreview.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <textarea
                      id="invite-attendees"
                      className="sc-attendees-textarea"
                      style={{ minHeight: 144 }}
                      value={inviteesText}
                      onChange={(event) => setInviteesText(event.target.value)}
                      placeholder={"Ana Perez,ana@email.com\nJuan Gomez,juan@email.com"}
                      required
                      aria-label="Invitados en formato Nombre,Email"
                    />
                    <p className="mt-1.5 text-[10.5px]" style={{ color: "var(--text-muted, #7A7E99)" }}>
                      Formato:{" "}
                      <code style={{ fontFamily: "var(--font-mono)" }}>Nombre,Email</code>{" "}
                      — uno por línea.
                    </p>
                  </div>

                  {/* Event + ticket type */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="invite-event" className="label">Evento</label>
                      <select
                        id="invite-event"
                        className="field"
                        value={inviteEventId}
                        onChange={(event) => setInviteEventId(event.target.value)}
                        required
                      >
                        {events.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({new Date(item.startsAt).toLocaleDateString("es-AR")})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="invite-ticket" className="label">Tipo de ticket</label>
                      <select
                        id="invite-ticket"
                        className="field"
                        value={inviteTicketTypeId}
                        onChange={(event) => setInviteTicketTypeId(event.target.value)}
                        required
                      >
                        {(selectedInviteEvent?.ticketTypes ?? []).map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} - {centsToCurrency(item.priceCents)} [{item.saleMode}]
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT: cortesía summary ── */}
                <ReceiptCard
                  headerBg="linear-gradient(135deg, #92400E 0%, #B45309 50%, #D97706 100%)"
                  headerText="Resumen cortesía"
                  eventName={selectedInviteEvent?.name ?? "Sin evento"}
                  lineItems={[
                    { label: "Ticket", value: selectedInviteTicketType?.name ?? "—" },
                    {
                      label: "Cantidad",
                      value: (
                        <span key={inviteesPreview.length} className="sc-price-flash font-display font-bold">
                          {inviteesPreview.length}
                        </span>
                      )
                    },
                    {
                      label: "Valor de referencia",
                      value: (
                        <span className="line-through" style={{ color: "var(--text-muted, #7A7E99)" }}>
                          {selectedInviteTicketType ? centsToCurrency(selectedInviteTicketType.priceCents) : "—"}
                        </span>
                      )
                    },
                  ]}
                  totalLabel="Total a cobrar"
                  totalValue={
                    <span
                      className="font-display text-[1.6rem] font-extrabold leading-none"
                      style={{ color: "#D97706" }}
                    >
                      {centsToCurrency(0)}
                    </span>
                  }
                  totalSub={
                    invitationReferenceTotalCents > 0 ? (
                      <p className="mt-0.5 text-[10.5px] line-through" style={{ color: "var(--text-muted, #7A7E99)" }}>
                        {centsToCurrency(invitationReferenceTotalCents)}
                      </p>
                    ) : undefined
                  }
                  submitDisabled={savingInvitation || !inviteEventId || !inviteTicketTypeId}
                  submitLabel={
                    <>
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                      </svg>
                      Emitir invitaciones
                    </>
                  }
                  submittingLabel={
                    <>
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                      Emitiendo invitaciones...
                    </>
                  }
                  isSubmitting={savingInvitation}
                />
              </form>

              {/* ── RECENT INVITATIONS LIST ── */}
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="sc-overline" style={{ color: "var(--text-muted, #7A7E99)" }}>Historial</p>
                    <h3 className="mt-0.5 text-[14px] font-bold" style={{ color: "var(--text-primary, #15162B)" }}>
                      Invitaciones recientes
                    </h3>
                  </div>
                  {invitations.length > 0 && (
                    <span
                      className="inline-flex items-center rounded-full border px-3 py-0.5 text-[11px] font-bold"
                      style={{
                        borderColor: "rgba(245,158,11,0.28)",
                        background: "rgba(245,158,11,0.06)",
                        color: "#B45309",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {invitations.length} órdenes
                    </span>
                  )}
                </div>

                {invitations.length === 0 ? (
                  <div
                    className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center"
                    style={{ borderColor: "rgba(245,158,11,0.25)" }}
                  >
                    <svg
                      className="mb-3 h-12 w-12 opacity-20"
                      viewBox="0 0 48 48"
                      fill="none"
                      aria-hidden="true"
                      style={{ color: "#D97706" }}
                    >
                      <rect x="6" y="10" width="36" height="28" rx="5" stroke="currentColor" strokeWidth="2" fill="none" />
                      <polyline points="6,14 24,26 42,14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-muted, #7A7E99)" }}>
                      Todavía no hay invitaciones emitidas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {invitations.map((invitation) => {
                      const isLatest = invitation.orderId === latestInvitationOrderId;
                      return (
                        <article
                          key={invitation.orderId}
                          className={`sc-invite-card overflow-hidden rounded-2xl border ${isLatest ? "sc-latest-glow" : ""}`}
                          style={{
                            borderColor: isLatest ? "rgba(236,42,138,0.35)" : "var(--border-soft, #E5E7EF)",
                            background: isLatest ? "rgba(236,42,138,0.025)" : "var(--bg-surface, #FFFFFF)",
                          }}
                        >
                          {/* Order header */}
                          <div
                            className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
                            style={{
                              borderBottom: "1px solid var(--border-soft, #E5E7EF)",
                              background: isLatest ? "rgba(236,42,138,0.03)" : undefined,
                            }}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-[14px] font-bold" style={{ color: "var(--text-primary, #15162B)" }}>
                                  {invitation.eventName}
                                </h4>
                                {isLatest && (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold"
                                    style={{
                                      borderColor: "rgba(236,42,138,0.35)",
                                      background: "rgba(236,42,138,0.08)",
                                      color: "var(--brand-magenta, #EC2A8A)",
                                    }}
                                  >
                                    <span
                                      className="sc-dot-magenta inline-block h-1.5 w-1.5 rounded-full"
                                      style={{ background: "var(--brand-magenta, #EC2A8A)" }}
                                      aria-hidden="true"
                                    />
                                    Reciente
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-secondary, #4B4F6B)" }}>
                                {invitation.ticketTypeName} · {invitation.quantity} ticket{invitation.quantity !== 1 ? "s" : ""} · {new Date(invitation.createdAt).toLocaleString("es-AR")}
                              </p>
                              <p
                                className="mt-0.5 text-[10.5px]"
                                style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted, #7A7E99)" }}
                              >
                                Orden {invitation.orderId} · {invitation.issuedBy}
                              </p>
                            </div>
                            <span
                              className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold"
                              style={{
                                borderColor: "rgba(245,158,11,0.30)",
                                background: "rgba(245,158,11,0.08)",
                                color: "#92400E",
                              }}
                            >
                              Invitación
                            </span>
                          </div>

                          {/* Ticket stubs */}
                          <div className="grid gap-3 p-4">
                            {invitation.tickets.map((ticket) => (
                              <div
                                key={ticket.id}
                                className="sc-ticket-stub relative overflow-hidden rounded-xl border"
                                style={{
                                  borderColor: "var(--border-soft, #E5E7EF)",
                                  background: "var(--bg-sunken, #F3F4F8)",
                                }}
                              >
                                <div className="px-4 pt-3">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-[13px] font-bold" style={{ color: "var(--text-primary, #15162B)" }}>
                                        {ticket.attendeeName}
                                      </p>
                                      <p className="text-[11px]" style={{ color: "var(--text-secondary, #4B4F6B)" }}>
                                        {ticket.attendeeEmail}
                                      </p>
                                      <p
                                        className="text-[10.5px]"
                                        style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted, #7A7E99)" }}
                                      >
                                        {ticket.code}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {ticket.emailStatus ? (
                                        <span
                                          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold"
                                          style={{
                                            borderColor: ticket.emailStatus === "SENT" ? "rgba(31,174,74,0.30)" : "rgba(225,29,72,0.28)",
                                            background: ticket.emailStatus === "SENT" ? "var(--clr-success-50, #E9F9EE)" : "#FEE8EC",
                                            color: ticket.emailStatus === "SENT" ? "var(--clr-success-700, #117A30)" : "#9F1239",
                                          }}
                                        >
                                          <span
                                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                                            style={{ background: ticket.emailStatus === "SENT" ? "var(--clr-success-500, #1FAE4A)" : "#E11D48" }}
                                            aria-hidden="true"
                                          />
                                          {ticket.emailStatus === "SENT" ? "Email enviado" : "Email fallido"}
                                        </span>
                                      ) : (
                                        <span className="badge">Sin registro email</span>
                                      )}
                                      <a
                                        className="btn-secondary--sm inline-flex items-center gap-1.5"
                                        href={ticket.downloadUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                                        </svg>
                                        PDF
                                      </a>
                                    </div>
                                  </div>

                                  {(ticket.emailedAt || ticket.emailError) && (
                                    <div className="mt-2">
                                      {ticket.emailedAt && (
                                        <p className="text-[10.5px]" style={{ color: "var(--text-muted, #7A7E99)" }}>
                                          Último intento: {new Date(ticket.emailedAt).toLocaleString("es-AR")}
                                        </p>
                                      )}
                                      {ticket.emailError && (
                                        <p className="mt-0.5 text-[10.5px]" style={{ color: "#E11D48" }}>
                                          Error: {ticket.emailError}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="h-3" />
                              </div>
                            ))}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </SectionPanel>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 3 — CUPONES
        ════════════════════════════════════════════════════════════════════ */}
        <SectionPanel
          id="sec-coupons-heading"
          animClass="sc-sec-3"
          accentColor="linear-gradient(90deg, #10B981 0%, #34D399 50%, #6EE7B7 100%)"
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#10B981" }}>
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
          }
          title="Cupones con límite de uso"
          subtitle="Crea cupones para habilitar tickets COUPON_ONLY o campañas cerradas."
        >
          {loading ? (
            <SkeletonSection />
          ) : (
            <>
              {/* ── CREATE COUPON FORM ── */}
              <form onSubmit={onCreateCoupon}>
                <div className="mb-3">
                  <p className="sc-overline" style={{ color: "var(--text-muted, #7A7E99)" }}>Nuevo cupón</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="coupon-code" className="label">Código</label>
                    <input
                      id="coupon-code"
                      className="field"
                      style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.06em", fontWeight: 700 }}
                      value={couponCode}
                      onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                      placeholder="PROMO25"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="coupon-event" className="label">Evento</label>
                    <select
                      id="coupon-event"
                      className="field"
                      value={couponEventId}
                      onChange={(event) => setCouponEventId(event.target.value)}
                      required
                    >
                      {events.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="coupon-ticket-type" className="label">
                      Tipo de ticket
                      <span className="ml-1.5 text-[10px] font-normal" style={{ color: "var(--text-muted, #7A7E99)" }}>(opcional)</span>
                    </label>
                    <select
                      id="coupon-ticket-type"
                      className="field"
                      value={couponTicketTypeId}
                      onChange={(event) => setCouponTicketTypeId(event.target.value)}
                    >
                      <option value="">Todos los tipos del evento</option>
                      {(selectedCouponEvent?.ticketTypes ?? []).map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="coupon-max-uses" className="label">Límite de usos</label>
                    <input
                      id="coupon-max-uses"
                      className="field"
                      type="number"
                      min={1}
                      value={couponMaxUses}
                      onChange={(event) => setCouponMaxUses(Number(event.target.value))}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="coupon-discount-type" className="label">Tipo de descuento</label>
                    <select
                      id="coupon-discount-type"
                      className="field"
                      value={couponDiscountType}
                      onChange={(event) => setCouponDiscountType(event.target.value as "FIXED_PRICE" | "FIXED_DISCOUNT" | "PERCENT")}
                    >
                      <option value="PERCENT">Descuento porcentaje</option>
                      <option value="FIXED_DISCOUNT">Descuento fijo</option>
                      <option value="FIXED_PRICE">Precio fijo final</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="coupon-discount-value" className="label">{discountLabel}</label>
                    <input
                      id="coupon-discount-value"
                      className="field"
                      type="number"
                      min={couponDiscountType === "PERCENT" ? 1 : 0}
                      max={couponDiscountType === "PERCENT" ? 100 : undefined}
                      step={couponDiscountType === "PERCENT" ? 1 : 0.01}
                      value={couponDiscountValue}
                      onChange={(event) => setCouponDiscountValue(Number(event.target.value))}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="coupon-expires" className="label">
                      Vencimiento
                      <span className="ml-1.5 text-[10px] font-normal" style={{ color: "var(--text-muted, #7A7E99)" }}>(opcional)</span>
                    </label>
                    <input
                      id="coupon-expires"
                      className="field"
                      type="datetime-local"
                      value={couponExpiresAt}
                      onChange={(event) => setCouponExpiresAt(event.target.value)}
                      min={toLocalDateTimeInput(new Date())}
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto"
                      disabled={savingCoupon || !couponEventId}
                    >
                      {savingCoupon ? (
                        <>
                          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                          </svg>
                          Creando...
                        </>
                      ) : (
                        <>
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                          Crear cupón
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* ── COUPONS TABLE ── */}
              {coupons.length > 0 && (
                <div className="mt-8">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="sc-overline" style={{ color: "var(--text-muted, #7A7E99)" }}>
                      Cupones activos ({coupons.length})
                    </p>
                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold" style={{ color: "var(--text-muted, #7A7E99)" }}>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#10B981]" aria-hidden="true" />
                        %
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--brand-violet, #5B21B6)" }} aria-hidden="true" />
                        Fijo
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--brand-magenta, #EC2A8A)" }} aria-hidden="true" />
                        Precio
                      </span>
                    </div>
                  </div>

                  <div
                    className="overflow-hidden rounded-xl border"
                    style={{ borderColor: "var(--border-soft, #E5E7EF)" }}
                  >
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm" role="table">
                        <thead>
                          <tr
                            style={{
                              backgroundColor: "var(--bg-sunken, #F3F4F8)",
                              borderBottom: "1px solid var(--border-soft, #E5E7EF)",
                            }}
                          >
                            <th scope="col" className="whitespace-nowrap py-3 pl-6 pr-4 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--text-secondary, #4B4F6B)" }}>
                              Código
                            </th>
                            <th scope="col" className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--text-secondary, #4B4F6B)" }}>
                              Evento / Ticket
                            </th>
                            <th scope="col" className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--text-secondary, #4B4F6B)" }}>
                              Uso
                            </th>
                            <th scope="col" className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--text-secondary, #4B4F6B)" }}>
                              Descuento
                            </th>
                            <th scope="col" className="hidden whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.10em] md:table-cell" style={{ color: "var(--text-secondary, #4B4F6B)" }}>
                              Vence
                            </th>
                            <th scope="col" className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--text-secondary, #4B4F6B)" }}>
                              Estado
                            </th>
                            <th scope="col" className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--text-secondary, #4B4F6B)" }}>
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody style={{ borderTop: "1px solid var(--border-soft, #E5E7EF)" }}>
                          {coupons.map((coupon) => {
                            const used = coupon.reservedUses ?? coupon.usedCount;
                            const usagePct = coupon.maxUses > 0 ? Math.round((used / coupon.maxUses) * 100) : 0;
                            return (
                              <tr
                                key={coupon.id}
                                className="sc-coupon-row"
                                data-dtype={coupon.discountType ?? ""}
                                style={{ borderBottom: "1px solid var(--border-soft, #E5E7EF)" }}
                              >
                                {/* Code */}
                                <td className="py-3.5 pl-6 pr-4">
                                  <span
                                    className="font-bold"
                                    style={{
                                      fontFamily: "var(--font-mono)",
                                      letterSpacing: "0.04em",
                                      color: "var(--text-primary, #15162B)",
                                    }}
                                  >
                                    {coupon.code}
                                  </span>
                                </td>

                                {/* Event / ticket */}
                                <td className="px-4 py-3.5">
                                  <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary, #15162B)" }}>
                                    {coupon.event.name}
                                  </p>
                                  <p className="text-[11px]" style={{ color: "var(--text-muted, #7A7E99)" }}>
                                    {coupon.ticketType?.name ?? "Todos los tickets"}
                                  </p>
                                </td>

                                {/* Usage with mini bar */}
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="text-[12px] font-semibold"
                                      style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary, #4B4F6B)" }}
                                    >
                                      {used}/{coupon.maxUses}
                                    </span>
                                  </div>
                                  <div
                                    className="mt-1 h-[3px] w-16 overflow-hidden rounded-full"
                                    style={{ background: "var(--clr-arena-200, #E5E7EF)" }}
                                  >
                                    <div
                                      className="h-full rounded-full transition-all duration-500"
                                      style={{
                                        width: `${Math.min(usagePct, 100)}%`,
                                        background: usagePct > 80 ? "#E11D48" : usagePct > 50 ? "#F59E0B" : "#1FAE4A",
                                      }}
                                    />
                                  </div>
                                </td>

                                {/* Discount */}
                                <td className="px-4 py-3.5">
                                  <span
                                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold"
                                    style={{
                                      borderColor:
                                        coupon.discountType === "PERCENT"
                                          ? "rgba(16,185,129,0.30)"
                                          : coupon.discountType === "FIXED_DISCOUNT"
                                            ? "rgba(91,33,182,0.28)"
                                            : "rgba(236,42,138,0.28)",
                                      background:
                                        coupon.discountType === "PERCENT"
                                          ? "rgba(16,185,129,0.07)"
                                          : coupon.discountType === "FIXED_DISCOUNT"
                                            ? "rgba(91,33,182,0.06)"
                                            : "rgba(236,42,138,0.06)",
                                      color:
                                        coupon.discountType === "PERCENT"
                                          ? "#065F46"
                                          : coupon.discountType === "FIXED_DISCOUNT"
                                            ? "#4C1D95"
                                            : "var(--clr-coral-700, #9F1239)",
                                      fontFamily: "var(--font-mono)",
                                    }}
                                  >
                                    {coupon.discountType === "PERCENT"
                                      ? `${coupon.discountValue ?? 0}%`
                                      : coupon.discountType === "FIXED_DISCOUNT"
                                        ? `-${centsToCurrency(coupon.discountValue ?? 0)}`
                                        : coupon.discountType === "FIXED_PRICE"
                                          ? centsToCurrency(coupon.discountValue ?? 0)
                                          : "Sin desc."}
                                  </span>
                                </td>

                                {/* Expires */}
                                <td className="hidden px-4 py-3.5 md:table-cell">
                                  <span className="text-[11px]" style={{ color: "var(--text-secondary, #4B4F6B)" }}>
                                    {coupon.expiresAt
                                      ? new Date(coupon.expiresAt).toLocaleString("es-AR")
                                      : <span style={{ color: "var(--text-muted, #7A7E99)" }}>Sin vencimiento</span>}
                                  </span>
                                </td>

                                {/* Status */}
                                <td className="px-4 py-3.5">
                                  <span
                                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold"
                                    style={{
                                      borderColor: coupon.isActive ? "rgba(31,174,74,0.30)" : "var(--border-soft, #E5E7EF)",
                                      background: coupon.isActive ? "var(--clr-success-50, #E9F9EE)" : "var(--bg-sunken, #F3F4F8)",
                                      color: coupon.isActive ? "var(--clr-success-700, #117A30)" : "var(--text-muted, #7A7E99)",
                                    }}
                                  >
                                    {coupon.isActive ? (
                                      <span
                                        className="sc-dot-active inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                                        style={{ background: "var(--clr-success-500, #1FAE4A)" }}
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <span
                                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                                        style={{ background: "var(--clr-arena-400, #B0B4C8)" }}
                                        aria-hidden="true"
                                      />
                                    )}
                                    {coupon.isActive ? "Activo" : "Inactivo"}
                                  </span>
                                </td>

                                {/* Actions — icon-only 28×28 with data-tip tooltips */}
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-1">
                                    {/* Toggle active */}
                                    <button
                                      type="button"
                                      className={`sc-icon-btn ${coupon.isActive ? "sc-icon-btn-danger" : "sc-icon-btn-success"}`}
                                      data-tip={coupon.isActive ? "Desactivar" : "Activar"}
                                      onClick={() => void onToggleCoupon(coupon)}
                                      aria-label={coupon.isActive ? `Desactivar cupón ${coupon.code}` : `Activar cupón ${coupon.code}`}
                                    >
                                      {coupon.isActive ? (
                                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                          <circle cx="12" cy="12" r="10" />
                                          <path d="M15 9l-6 6M9 9l6 6" />
                                        </svg>
                                      ) : (
                                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                          <path d="M20 6L9 17l-5-5" />
                                        </svg>
                                      )}
                                    </button>

                                    {/* Adjust max uses */}
                                    <button
                                      type="button"
                                      className="sc-icon-btn"
                                      data-tip="Ajustar límite"
                                      onClick={() => void onUpdateMaxUses(coupon)}
                                      aria-label={`Ajustar límite de uso para ${coupon.code}`}
                                    >
                                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                      </svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {coupons.length === 0 && (
                <div
                  className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center"
                  style={{ borderColor: "rgba(16,185,129,0.25)" }}
                >
                  <svg
                    className="mb-3 h-12 w-12 opacity-20"
                    viewBox="0 0 48 48"
                    fill="none"
                    aria-hidden="true"
                    style={{ color: "#10B981" }}
                  >
                    <path d="M40.59 25.41l-15 15a3 3 0 01-4.24 0L3 22V4h18l19.59 19.59a3 3 0 010 4.24z" stroke="currentColor" strokeWidth="2" fill="none" />
                    <circle cx="11" cy="12" r="2" fill="currentColor" />
                  </svg>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--text-muted, #7A7E99)" }}>
                    Todavía no hay cupones creados.
                  </p>
                </div>
              )}
            </>
          )}
        </SectionPanel>

      </div>
    </>
  );
}
