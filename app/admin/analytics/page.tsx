import Link from "next/link";
import type { OrderKind } from "@prisma/client";
import { db } from "@/lib/db";
import { isCommercialOrderKind } from "@/lib/order-kind";
import { centsToCurrency } from "@/lib/utils";
import { requirePageRole } from "@/lib/auth";
import { getScopedEventIdsForViewer } from "@/lib/event-scope";
import {
  type AnalyticsSessionStatus,
  type AnalyticsStep,
  PRIMARY_FUNNEL_STEPS,
  SESSION_STATUS_META,
  formatAnalyticsSessionLabel,
  getAnalyticsProgressionRank,
  getAnalyticsStepMeta,
  getAnalyticsVisitKey,
  isAnalyticsStep
} from "@/lib/analytics";

const ACTIVE_WINDOW_MS = 1000 * 60 * 30;
const SESSION_LIST_LIMIT = 18;

const RANGE_OPTIONS = [
  { value: "1d", label: "24 horas" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "90d", label: "90 días" },
  { value: "all", label: "Todo" }
] as const;

type RangeKey = (typeof RANGE_OPTIONS)[number]["value"];

type SearchParams = Record<string, string | string[] | undefined>;

type AnalyticsEventRow = {
  sessionId: string;
  eventSlug: string;
  step: AnalyticsStep;
  createdAt: Date;
  pathname: string | null;
  referrerHost: string | null;
  deviceType: string | null;
};

type JourneySummary = {
  key: string;
  sessionId: string;
  eventSlug: string;
  eventName: string;
  firstSeen: Date;
  lastSeen: Date;
  lastStep: AnalyticsStep;
  timeline: AnalyticsStep[];
  status: AnalyticsSessionStatus;
  progressionRank: number;
  landingPath: string | null;
  lastPath: string | null;
  referrerHost: string | null;
  deviceType: string;
  durationMs: number;
};

function resolveSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function resolveRange(rangeParam: string) {
  const selected = RANGE_OPTIONS.find((option) => option.value === rangeParam) ?? RANGE_OPTIONS[1];
  const now = new Date();
  const since = (() => {
    switch (selected.value as RangeKey) {
      case "1d":
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case "7d":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "30d":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case "90d":
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case "all":
      default:
        return null;
    }
  })();

  return { ...selected, since };
}

function groupSalesByDay(orders: Array<{ createdAt: Date; totalCents: number; status: string; kind: OrderKind }>) {
  const totals = new Map<string, number>();

  for (const order of orders) {
    if (order.status !== "PAID" || !isCommercialOrderKind(order.kind)) continue;
    const key = new Date(order.createdAt).toISOString().slice(0, 10);
    totals.set(key, (totals.get(key) ?? 0) + order.totalCents);
  }

  return Array.from(totals.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getSessionStatus(lastStep: AnalyticsStep, lastSeen: Date, now: Date): AnalyticsSessionStatus {
  if (lastStep === "success" || lastStep === "pending" || lastStep === "failure" || lastStep === "checkout_error") {
    return lastStep;
  }

  if (now.getTime() - lastSeen.getTime() > ACTIVE_WINDOW_MS) {
    return "abandoned";
  }

  return "active";
}

function buildTimeline(steps: AnalyticsStep[]) {
  const timeline: AnalyticsStep[] = [];

  for (const step of steps) {
    if (timeline[timeline.length - 1] !== step) {
      timeline.push(step);
    }
  }

  return timeline;
}

function normalizeDevice(deviceType: string | null) {
  if (deviceType === "desktop" || deviceType === "mobile" || deviceType === "tablet") {
    return deviceType;
  }
  return "unknown";
}

function getDeviceLabel(deviceType: string) {
  if (deviceType === "desktop") return "Desktop";
  if (deviceType === "mobile") return "Mobile";
  if (deviceType === "tablet") return "Tablet";
  return "Desconocido";
}

function getDeviceBadgeClass(deviceType: string) {
  if (deviceType === "desktop") return "bg-arena-200 text-primary";
  if (deviceType === "mobile") return "bg-info-50 text-info-700";
  if (deviceType === "tablet") return "bg-coral-50 text-coral-700";
  return "bg-sunken text-secondary";
}

function formatDuration(durationMs: number) {
  if (durationMs < 60 * 1000) return "<1 min";

  const totalMinutes = Math.round(durationMs / (60 * 1000));
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function buildJourneys(pageViews: AnalyticsEventRow[], eventNameBySlug: Map<string, string>, now: Date) {
  const sorted = [...pageViews].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const grouped = new Map<
    string,
    {
      sessionId: string;
      eventSlug: string;
      eventName: string;
      events: AnalyticsEventRow[];
    }
  >();

  for (const row of sorted) {
    const key = getAnalyticsVisitKey(row.sessionId, row.eventSlug);
    const current = grouped.get(key);

    if (current) {
      current.events.push(row);
      continue;
    }

    grouped.set(key, {
      sessionId: row.sessionId,
      eventSlug: row.eventSlug,
      eventName: eventNameBySlug.get(row.eventSlug) ?? row.eventSlug,
      events: [row]
    });
  }

  return Array.from(grouped.entries())
    .map(([key, group]) => {
      const events = group.events;
      const first = events[0];
      const last = events[events.length - 1];
      const timeline = buildTimeline(events.map((event) => event.step));
      const progressionRank = events.reduce((max, event) => Math.max(max, getAnalyticsProgressionRank(event.step)), 0);
      const firstReferrerHost = events.find((event) => event.referrerHost)?.referrerHost ?? null;
      const firstPath = events.find((event) => event.pathname)?.pathname ?? null;
      const lastPath = [...events].reverse().find((event) => event.pathname)?.pathname ?? null;
      const deviceType = normalizeDevice(events.find((event) => event.deviceType)?.deviceType ?? null);

      return {
        key,
        sessionId: group.sessionId,
        eventSlug: group.eventSlug,
        eventName: group.eventName,
        firstSeen: first.createdAt,
        lastSeen: last.createdAt,
        lastStep: last.step,
        timeline,
        progressionRank,
        referrerHost: firstReferrerHost,
        landingPath: firstPath,
        lastPath,
        deviceType,
        status: getSessionStatus(last.step, last.createdAt, now),
        durationMs: Math.max(last.createdAt.getTime() - first.createdAt.getTime(), 0)
      } satisfies JourneySummary;
    })
    .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
}

function getReferrerLabel(referrerHost: string | null, appHost: string | null) {
  if (!referrerHost) return "Directo";
  if (appHost && referrerHost === appHost) return "Interno";
  return referrerHost;
}

function getSafeAppHost() {
  try {
    const raw = process.env.NEXT_PUBLIC_APP_URL;
    if (!raw) return null;
    return new URL(raw).host;
  } catch {
    return null;
  }
}

function formatRelativeTime(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD} d`;
}

type Props = {
  searchParams?: Promise<SearchParams>;
};

export default async function AnalyticsPage({ searchParams }: Props) {
  const viewer = await requirePageRole(["ADMIN", "MANAGER"]);
  const scopedEventIds = await getScopedEventIdsForViewer(viewer);
  const baseEventWhere = scopedEventIds ? { id: { in: scopedEventIds } } : undefined;
  const params = (await searchParams) ?? {};
  const range = resolveRange(resolveSearchParam(params.range));
  const selectedEventSlugParam = resolveSearchParam(params.event);
  const appHost = getSafeAppHost();
  const now = new Date();

  const availableEvents = await db.event.findMany({
    where: baseEventWhere,
    orderBy: [{ startsAt: "desc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true
    }
  });

  const availableEventIds = availableEvents.map((event) => event.id);
  const availableEventSlugs = availableEvents.map((event) => event.slug);
  const selectedEventSlug = availableEventSlugs.includes(selectedEventSlugParam) ? selectedEventSlugParam : "";

  const filteredEvents = selectedEventSlug ? availableEvents.filter((event) => event.slug === selectedEventSlug) : availableEvents;
  const filteredEventIds = filteredEvents.map((event) => event.id);
  const filteredEventSlugs = filteredEvents.map((event) => event.slug);
  const eventNameBySlug = new Map(availableEvents.map((event) => [event.slug, event.name]));

  const orderWhere = {
    ...(filteredEventIds.length > 0 ? { eventId: { in: filteredEventIds } } : baseEventWhere ? { eventId: { in: availableEventIds } } : {}),
    ...(range.since ? { createdAt: { gte: range.since } } : {})
  };

  const attendedTicketWhere = {
    ...(filteredEventIds.length > 0 ? { eventId: { in: filteredEventIds } } : baseEventWhere ? { eventId: { in: availableEventIds } } : {}),
    ...(range.since ? { attendedAt: { gte: range.since } } : { NOT: { attendedAt: null } })
  };

  const pageViewWhere = {
    ...(filteredEventSlugs.length > 0 ? { eventSlug: { in: filteredEventSlugs } } : baseEventWhere ? { eventSlug: { in: availableEventSlugs } } : {}),
    ...(range.since ? { createdAt: { gte: range.since } } : {})
  };

  const [orders, attendedTickets, pageViews] = await Promise.all([
    db.order.findMany({
      where: orderWhere,
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        totalCents: true,
        status: true,
        eventId: true,
        quantity: true,
        kind: true
      }
    }),
    db.ticket.findMany({
      where: attendedTicketWhere,
      select: {
        eventId: true
      }
    }),
    db.pageView.findMany({
      where: pageViewWhere,
      orderBy: { createdAt: "desc" },
      select: {
        sessionId: true,
        eventSlug: true,
        step: true,
        createdAt: true,
        pathname: true,
        referrerHost: true,
        deviceType: true
      }
    })
  ]);

  const normalizedPageViews = pageViews.reduce<AnalyticsEventRow[]>((rows, row) => {
    if (!isAnalyticsStep(row.step)) return rows;

    rows.push({
      sessionId: row.sessionId,
      eventSlug: row.eventSlug,
      step: row.step,
      createdAt: row.createdAt,
      pathname: row.pathname,
      referrerHost: row.referrerHost,
      deviceType: row.deviceType
    });

    return rows;
  }, []);

  const journeys = buildJourneys(normalizedPageViews, eventNameBySlug, now);
  const activeJourneys = journeys.filter((journey) => journey.status === "active").length;
  const abandonedJourneys = journeys.filter((journey) => journey.status === "abandoned").length;
  const convertedJourneys = journeys.filter((journey) => journey.status === "success").length;
  const checkoutReachedJourneys = journeys.filter((journey) => journey.progressionRank >= 2).length;
  const submitJourneys = journeys.filter((journey) => journey.progressionRank >= 4).length;
  const conversionRate = journeys.length > 0 ? Math.round((convertedJourneys / journeys.length) * 100) : 0;
  const checkoutRate = journeys.length > 0 ? Math.round((checkoutReachedJourneys / journeys.length) * 100) : 0;
  const submitRate = journeys.length > 0 ? Math.round((submitJourneys / journeys.length) * 100) : 0;

  const funnelRows = PRIMARY_FUNNEL_STEPS.map((step, index) => {
    const sessions =
      step === "success"
        ? journeys.filter((journey) => journey.status === "success").length
        : journeys.filter((journey) => journey.progressionRank >= getAnalyticsProgressionRank(step)).length;

    const previousSessions = index > 0 ? PRIMARY_FUNNEL_STEPS[index - 1] : null;
    const previousCount =
      previousSessions === null
        ? null
        : previousSessions === "success"
          ? journeys.filter((journey) => journey.status === "success").length
          : journeys.filter((journey) => journey.progressionRank >= getAnalyticsProgressionRank(previousSessions)).length;

    const dropOffPct =
      previousCount && previousCount > 0
        ? Math.max(0, Math.round(((previousCount - sessions) / previousCount) * 100))
        : null;

    return {
      step,
      sessions,
      dropOffPct,
      ...getAnalyticsStepMeta(step)
    };
  });

  const maxFunnelSessions = Math.max(...funnelRows.map((row) => row.sessions), 1);

  const statusRows = Object.entries(SESSION_STATUS_META)
    .map(([status, meta]) => ({
      status: status as AnalyticsSessionStatus,
      label: meta.label,
      badgeClass: meta.badgeClass,
      count: journeys.filter((journey) => journey.status === status).length
    }))
    .filter((row) => row.count > 0);

  const abandonmentRows = Array.from(
    journeys
      .filter((journey) => journey.status === "abandoned")
      .reduce((map, journey) => {
        map.set(journey.lastStep, (map.get(journey.lastStep) ?? 0) + 1);
        return map;
      }, new Map<AnalyticsStep, number>())
      .entries()
  )
    .map(([step, count]) => ({
      step,
      count,
      pct: journeys.length > 0 ? Math.round((count / journeys.length) * 100) : 0,
      ...getAnalyticsStepMeta(step)
    }))
    .sort((a, b) => b.count - a.count);

  const deviceRows = ["desktop", "mobile", "tablet", "unknown"]
    .map((deviceType) => {
      const sessions = journeys.filter((journey) => journey.deviceType === deviceType).length;
      const converted = journeys.filter((journey) => journey.deviceType === deviceType && journey.status === "success").length;

      return {
        deviceType,
        sessions,
        converted,
        conversionPct: sessions > 0 ? Math.round((converted / sessions) * 100) : 0
      };
    })
    .filter((row) => row.sessions > 0);

  const maxDeviceSessions = Math.max(...deviceRows.map((row) => row.sessions), 1);

  const referrerRows = Array.from(
    journeys.reduce((map, journey) => {
      const label = getReferrerLabel(journey.referrerHost, appHost);
      map.set(label, (map.get(label) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const maxReferrerSessions = Math.max(...referrerRows.map((row) => row.count), 1);

  const eventJourneyRows = filteredEvents
    .map((event) => {
      const eventJourneys = journeys.filter((journey) => journey.eventSlug === event.slug);
      const sessions = eventJourneys.length;
      const checkout = eventJourneys.filter((journey) => journey.progressionRank >= 2).length;
      const submit = eventJourneys.filter((journey) => journey.progressionRank >= 4).length;
      const converted = eventJourneys.filter((journey) => journey.status === "success").length;
      const abandoned = eventJourneys.filter((journey) => journey.status === "abandoned").length;

      return {
        slug: event.slug,
        name: event.name,
        sessions,
        checkout,
        submit,
        converted,
        abandoned,
        checkoutRate: sessions > 0 ? Math.round((checkout / sessions) * 100) : 0,
        conversionRate: sessions > 0 ? Math.round((converted / sessions) * 100) : 0,
        abandonmentRate: sessions > 0 ? Math.round((abandoned / sessions) * 100) : 0
      };
    })
    .sort((a, b) => b.sessions - a.sessions || b.converted - a.converted);

  const salesByDay = groupSalesByDay(orders).slice(-20);
  const maxDay = Math.max(...salesByDay.map((day) => day.total), 1);

  const attendanceByEventId = attendedTickets.reduce((map, ticket) => {
    map.set(ticket.eventId, (map.get(ticket.eventId) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  const commercialRows = filteredEvents
    .map((event) => {
      const eventOrders = orders.filter(
        (order) => order.eventId === event.id && order.status === "PAID" && isCommercialOrderKind(order.kind)
      );
      const sold = eventOrders.reduce((sum, order) => sum + order.quantity, 0);
      const revenue = eventOrders.reduce((sum, order) => sum + order.totalCents, 0);
      const attended = attendanceByEventId.get(event.id) ?? 0;

      return {
        id: event.id,
        name: event.name,
        sold,
        revenue,
        attended,
        attendanceRate: sold > 0 ? Math.round((attended / sold) * 100) : 0
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.sold - a.sold);

  const maxRevenue = Math.max(...commercialRows.map((row) => row.revenue), 1);
  const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

  return (
    <>
      {/* ─── CSS-ONLY ANIMATIONS — server component safe ─────────────────────── */}
      <style>{`
@keyframes an-fade-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes an-stat-in {
  from { opacity: 0; transform: translateY(12px) scale(0.94); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes an-bar-grow {
  from { width: 0 !important; }
}
@keyframes an-row-in {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes an-pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.8); }
}

/* Header */
.an-header { animation: an-fade-up 0.6s var(--ease-tactile, cubic-bezier(.22,1,.36,1)) 0.02s both; }

/* KPI cards */
.an-kpi { animation: an-stat-in 0.5s var(--ease-spring, cubic-bezier(.34,1.56,.64,1)) both; }
.an-kpi:nth-child(1) { animation-delay: 0.06s; }
.an-kpi:nth-child(2) { animation-delay: 0.11s; }
.an-kpi:nth-child(3) { animation-delay: 0.16s; }
.an-kpi:nth-child(4) { animation-delay: 0.21s; }
.an-kpi:nth-child(5) { animation-delay: 0.26s; }
.an-kpi {
  transition: transform 0.2s var(--ease-tactile, cubic-bezier(.22,1,.36,1)),
              box-shadow 0.2s var(--ease-tactile, cubic-bezier(.22,1,.36,1)),
              border-color 0.15s ease;
}
.an-kpi:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(21,22,43,0.09);
}

/* Section panels */
.an-panel { animation: an-fade-up 0.55s var(--ease-tactile, cubic-bezier(.22,1,.36,1)) both; }
.an-panel-1 { animation-delay: 0.32s; }
.an-panel-2 { animation-delay: 0.38s; }
.an-panel-3 { animation-delay: 0.44s; }
.an-panel-4 { animation-delay: 0.50s; }
.an-panel-5 { animation-delay: 0.56s; }
.an-panel-6 { animation-delay: 0.62s; }
.an-panel-7 { animation-delay: 0.68s; }
.an-panel-8 { animation-delay: 0.74s; }

/* Bars */
.an-bar { animation: an-bar-grow 0.9s var(--ease-tactile, cubic-bezier(.22,1,.36,1)) 0.5s both; }

/* Table rows */
.an-trow { animation: an-fade-up 0.3s var(--ease-tactile, cubic-bezier(.22,1,.36,1)) both; }
.an-trow:nth-child(1)  { animation-delay: 0.60s; }
.an-trow:nth-child(2)  { animation-delay: 0.63s; }
.an-trow:nth-child(3)  { animation-delay: 0.66s; }
.an-trow:nth-child(4)  { animation-delay: 0.69s; }
.an-trow:nth-child(5)  { animation-delay: 0.72s; }
.an-trow:nth-child(6)  { animation-delay: 0.75s; }
.an-trow:nth-child(7)  { animation-delay: 0.78s; }
.an-trow:nth-child(8)  { animation-delay: 0.81s; }
.an-trow:nth-child(9)  { animation-delay: 0.84s; }
.an-trow:nth-child(10) { animation-delay: 0.87s; }
.an-trow:nth-child(11) { animation-delay: 0.90s; }
.an-trow:nth-child(12) { animation-delay: 0.93s; }

/* Pulse dot */
.an-dot-pulse { animation: an-pulse-dot 2.2s ease-in-out infinite; }

/* Gradient number text */
.an-grad-num {
  background: var(--grad-hero);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Toolbar form inputs */
.an-toolbar-select {
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 30px;
}

/* Dense table */
.an-dense-table { width: 100%; border-collapse: collapse; }
.an-dense-table th {
  padding: 7px 10px;
  text-align: left;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.10em;
  color: var(--text-secondary, #4B4F6B);
  background: var(--bg-sunken, #F1F2F6);
  border-bottom: 1px solid var(--border-soft, #E5E7EF);
  white-space: nowrap;
}
.an-dense-table th.right { text-align: right; }
.an-dense-table td {
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-primary, #15162B);
  border-bottom: 1px solid var(--border-soft, #E5E7EF);
  vertical-align: middle;
  white-space: nowrap;
}
.an-dense-table td.right { text-align: right; }
.an-dense-table td.mono {
  font-family: var(--font-mono, ui-monospace);
  font-size: 11px;
  color: var(--text-secondary, #4B4F6B);
}
.an-dense-table td.muted { color: var(--text-secondary, #4B4F6B); }
.an-dense-table tbody tr:hover { background: var(--bg-sunken, #F1F2F6); }
.an-dense-table tbody tr:last-child td { border-bottom: none; }

/* Session status pills */
.an-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 9999px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
  border-width: 1px;
  border-style: solid;
}
.an-pill-green  { background: rgba(31,174,74,0.08);  border-color: rgba(31,174,74,0.22);  color: #117A30; }
.an-pill-red    { background: rgba(225,29,72,0.07);  border-color: rgba(225,29,72,0.20);  color: #9F1239; }
.an-pill-amber  { background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.22); color: #9B5F17; }
.an-pill-blue   { background: rgba(59,130,246,0.08); border-color: rgba(59,130,246,0.20); color: #312E81; }
.an-pill-gray   { background: var(--bg-sunken,#F1F2F6); border-color: var(--border-soft,#E5E7EF); color: var(--text-secondary,#4B4F6B); }
.an-pill-violet { background: rgba(109,40,217,0.07); border-color: rgba(109,40,217,0.20); color: #4C1D95; }

/* Icon action button with tooltip */
.an-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #4B4F6B);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  position: relative;
}
.an-action-btn:hover { background: var(--bg-sunken, #F1F2F6); color: var(--brand-violet, #5B21B6); }
.an-action-btn[title]:hover::after {
  content: attr(title);
  position: absolute;
  bottom: calc(100% + 6px);
  right: 0;
  background: #15162B;
  color: #fff;
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
  padding: 3px 8px;
  border-radius: 4px;
  pointer-events: none;
  z-index: 10;
}

/* Range segmented control */
.an-range-seg {
  display: inline-flex;
  gap: 1px;
  background: var(--border-soft, #E5E7EF);
  border-radius: 8px;
  padding: 2px;
}
.an-range-seg a {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #4B4F6B);
  text-decoration: none;
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
}
.an-range-seg a:hover { background: var(--bg-surface, #fff); color: var(--text-primary, #15162B); }
.an-range-seg a.active {
  background: var(--bg-surface, #fff);
  color: var(--brand-violet, #5B21B6);
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(21,22,43,0.10);
}

/* Chart bar column */
.an-col-bar { display: flex; align-items: flex-end; gap: 3px; height: 80px; }
.an-col-bar-item {
  flex: 1;
  min-width: 0;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(180deg, #8B5CF6 0%, #6D28D9 100%);
  transition: opacity 0.15s;
}
.an-col-bar-item.hi { background: linear-gradient(180deg, #EC4899 0%, #8B5CF6 100%); }
.an-col-bar-item:hover { opacity: 0.8; }
      `}</style>

      <div className="space-y-5">

        {/* ── HERO BAR ─────────────────────────────────────────────────────────── */}
        <header className="an-header">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--brand-magenta)" }}>
                ANALYTICS
              </p>
              <h1 className="mt-0.5 font-display text-[1.6rem] font-extrabold leading-tight tracking-tight text-primary">
                Analytics UX
              </h1>
              <p className="mt-0.5 text-[12px] text-secondary">
                Recorridos anónimos por sesión · {range.label} · abandono = sin actividad por +30 min
              </p>
            </div>

            {/* Right: date-range segmented + event filter */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Event quick select */}
              <form className="flex items-center gap-1.5">
                <select
                  name="event"
                  defaultValue={selectedEventSlug}
                  className="an-toolbar-select rounded-lg border border-[color:var(--border-soft)] bg-surface px-3 py-1.5 text-[12px] font-medium text-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-violet)]/30"
                >
                  <option value="">Todos los eventos</option>
                  {availableEvents.map((event) => (
                    <option key={event.id} value={event.slug}>
                      {event.name}
                    </option>
                  ))}
                </select>
                <input type="hidden" name="range" value={range.value} />
                <button type="submit" className="btn-primary--sm !px-3">Aplicar</button>
              </form>

              {/* Range segmented control */}
              <nav className="an-range-seg" aria-label="Rango de tiempo">
                {RANGE_OPTIONS.map((opt) => {
                  const href = selectedEventSlug
                    ? `/admin/analytics?range=${opt.value}&event=${selectedEventSlug}`
                    : `/admin/analytics?range=${opt.value}`;
                  return (
                    <a
                      key={opt.value}
                      href={href}
                      className={range.value === opt.value ? "active" : ""}
                    >
                      {opt.label}
                    </a>
                  );
                })}
              </nav>
            </div>
          </div>
        </header>

        {/* ── KPI ROW (5 cards, compact) ───────────────────────────────────────── */}
        <section className="grid gap-2.5 sm:grid-cols-3 xl:grid-cols-5" aria-label="Métricas de sesiones">

          {/* Visitas */}
          <article className="an-kpi rounded-xl border border-[color:var(--border-soft)] bg-surface p-3.5 shadow-[var(--shadow-xs)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Visitas</p>
            <p className="mt-1.5 font-display text-[1.5rem] font-extrabold leading-none tracking-tight text-primary tabular-nums">
              {journeys.length.toLocaleString("es-AR")}
            </p>
            <p className="mt-1 text-[11px] text-secondary">{range.label}</p>
          </article>

          {/* Al checkout */}
          <article className="an-kpi rounded-xl border border-[color:var(--border-soft)] bg-surface p-3.5 shadow-[var(--shadow-xs)]" style={{ borderTopWidth: "2px", borderTopColor: "var(--brand-magenta)" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Al checkout</p>
            <p className="mt-1.5 font-display text-[1.5rem] font-extrabold leading-none tracking-tight tabular-nums" style={{ color: "var(--brand-magenta)" }}>
              {checkoutReachedJourneys.toLocaleString("es-AR")}
            </p>
            <p className="mt-1 text-[11px] text-secondary">{checkoutRate}% del total</p>
          </article>

          {/* Intentan pagar */}
          <article className="an-kpi rounded-xl border border-[color:var(--border-soft)] bg-surface p-3.5 shadow-[var(--shadow-xs)]" style={{ borderTopWidth: "2px", borderTopColor: "var(--brand-magenta)" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Intentan pagar</p>
            <p className="mt-1.5 font-display text-[1.5rem] font-extrabold leading-none tracking-tight tabular-nums" style={{ color: "var(--brand-magenta)" }}>
              {submitJourneys.toLocaleString("es-AR")}
            </p>
            <p className="mt-1 text-[11px] text-secondary">{submitRate}% del total</p>
          </article>

          {/* Convertidas */}
          <article className="an-kpi rounded-xl border border-[color:var(--border-soft)] bg-surface p-3.5 shadow-[var(--shadow-xs)]" style={{ borderTopWidth: "2px", borderTopColor: "var(--clr-success-500)" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Convertidas</p>
            <p className="mt-1.5 font-display text-[1.5rem] font-extrabold leading-none tracking-tight tabular-nums text-success-700">
              {convertedJourneys.toLocaleString("es-AR")}
            </p>
            <p className="mt-1 text-[11px] text-secondary">{conversionRate}% conversión</p>
          </article>

          {/* Abandonos */}
          <article className="an-kpi rounded-xl border border-[color:var(--border-soft)] bg-surface p-3.5 shadow-[var(--shadow-xs)]" style={{ borderTopWidth: "2px", borderTopColor: "var(--clr-danger-500)" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Abandonos</p>
            <p className="mt-1.5 font-display text-[1.5rem] font-extrabold leading-none tracking-tight tabular-nums text-danger-700">
              {abandonedJourneys.toLocaleString("es-AR")}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-secondary">
              <span className="an-dot-pulse inline-block h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
              {activeJourneys.toLocaleString("es-AR")} activas ahora
            </p>
          </article>
        </section>

        {/* ── CHARTS ROW: Embudo + Ventas por día (side-by-side) ──────────────── */}
        <section className="an-panel an-panel-1 grid gap-4 xl:grid-cols-2">

          {/* Embudo UX */}
          <article className="rounded-xl border border-[color:var(--border-soft)] bg-surface shadow-[var(--shadow-xs)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border-soft)]">
              <div>
                <h2 className="font-display text-[13px] font-bold text-primary">Embudo UX</h2>
                <p className="text-[11px] text-secondary">Visitas que alcanzan cada hito</p>
              </div>
              <span className="an-pill an-pill-gray">{range.label}</span>
            </div>

            {journeys.length === 0 ? (
              <p className="px-4 py-6 text-[12px] text-secondary">Sin datos para este filtro.</p>
            ) : (
              <div className="px-4 py-3 space-y-2">
                {funnelRows.map((row, i) => (
                  <div key={row.step} className="grid items-center gap-2" style={{ gridTemplateColumns: "130px 1fr 48px 56px" }}>
                    <span className="truncate text-[11px] font-medium text-secondary">{row.label}</span>
                    <div className="h-[5px] overflow-hidden rounded-full bg-[color:var(--bg-sunken)]">
                      <div
                        className="an-bar h-[5px] rounded-full"
                        style={{
                          width: `${Math.max((row.sessions / maxFunnelSessions) * 100, row.sessions > 0 ? 2 : 0)}%`,
                          background: i === funnelRows.length - 1
                            ? "var(--clr-success-500)"
                            : i === 0
                              ? "var(--grad-hero)"
                              : "linear-gradient(90deg,#8B5CF6,#6D28D9)",
                          opacity: 1 - i * 0.08
                        }}
                      />
                    </div>
                    <span className="text-right font-display text-[12px] font-bold text-primary tabular-nums">{row.sessions.toLocaleString("es-AR")}</span>
                    <span className={`text-right text-[11px] font-semibold tabular-nums ${
                      row.dropOffPct === null ? "text-secondary" :
                      row.dropOffPct > 40 ? "text-danger-600" :
                      row.dropOffPct > 15 ? "text-warning-600" : "text-secondary"
                    }`}>
                      {row.dropOffPct === null ? "entrada" : `−${row.dropOffPct}%`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>

          {/* Ventas por día */}
          <article className="rounded-xl border border-[color:var(--border-soft)] bg-surface shadow-[var(--shadow-xs)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border-soft)]">
              <div>
                <h2 className="font-display text-[13px] font-bold text-primary">Ventas por día</h2>
                <p className="text-[11px] text-secondary">Ingresos aprobados · {range.label}</p>
              </div>
              <span className="an-pill an-pill-violet">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                Ingresos
              </span>
            </div>

            {salesByDay.length === 0 ? (
              <p className="px-4 py-6 text-[12px] text-secondary">Aún no hay ventas pagadas.</p>
            ) : (
              <div className="px-4 py-3">
                {/* Mini column chart */}
                <div className="an-col-bar mb-2">
                  {salesByDay.slice(-14).map((day, i, arr) => {
                    const pct = Math.max((day.total / maxDay) * 100, 2);
                    const isMax = day.total === maxDay;
                    return (
                      <div
                        key={day.date}
                        className={`an-col-bar-item${isMax ? " hi" : ""}`}
                        style={{ height: `${pct}%` }}
                        title={`${day.date}: ${centsToCurrency(day.total)}`}
                      />
                    );
                  })}
                </div>
                {/* List: last 6 days */}
                <div className="space-y-1.5 mt-3">
                  {salesByDay.slice(-6).map((day) => (
                    <div key={day.date} className="grid items-center gap-2" style={{ gridTemplateColumns: "76px 1fr 96px" }}>
                      <span className="font-mono text-[10px] text-secondary">{day.date}</span>
                      <div className="h-[4px] overflow-hidden rounded-full bg-[color:var(--bg-sunken)]">
                        <div
                          className="an-bar h-[4px] rounded-full"
                          style={{
                            width: `${Math.max((day.total / maxDay) * 100, 2)}%`,
                            background: "var(--grad-hero)"
                          }}
                        />
                      </div>
                      <span className="text-right font-display text-[12px] font-bold text-primary tabular-nums">{centsToCurrency(day.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
        </section>

        {/* ── SOURCES STRIP + STATUS + DEVICES (compact 3-col) ────────────────── */}
        <section className="an-panel an-panel-2 grid gap-4 xl:grid-cols-3">

          {/* Orígenes de tráfico */}
          <article className="rounded-xl border border-[color:var(--border-soft)] bg-surface shadow-[var(--shadow-xs)]">
            <div className="px-4 py-3 border-b border-[color:var(--border-soft)]">
              <h2 className="font-display text-[13px] font-bold text-primary">Orígenes</h2>
              <p className="text-[11px] text-secondary">Top 5 fuentes de tráfico</p>
            </div>
            <div className="px-4 py-3 space-y-2">
              {referrerRows.length === 0 ? (
                <p className="text-[12px] text-secondary">Sin referrers registrados.</p>
              ) : (
                referrerRows.slice(0, 5).map((row) => (
                  <div key={row.label} className="grid items-center gap-2" style={{ gridTemplateColumns: "1fr 44px" }}>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-primary">{row.label}</p>
                      <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-[color:var(--bg-sunken)]">
                        <div
                          className="an-bar h-[3px] rounded-full"
                          style={{
                            width: `${Math.max((row.count / maxReferrerSessions) * 100, row.count > 0 ? 4 : 0)}%`,
                            background: "linear-gradient(90deg,#1FAE4A,#4ade80)"
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-right font-display text-[12px] font-bold text-primary tabular-nums">{row.count.toLocaleString("es-AR")}</span>
                  </div>
                ))
              )}
            </div>
          </article>

          {/* Estado final */}
          <article className="rounded-xl border border-[color:var(--border-soft)] bg-surface shadow-[var(--shadow-xs)]">
            <div className="px-4 py-3 border-b border-[color:var(--border-soft)]">
              <h2 className="font-display text-[13px] font-bold text-primary">Estado final</h2>
              <p className="text-[11px] text-secondary">Distribución por último estado</p>
            </div>
            <div className="px-4 py-3 space-y-1.5">
              {statusRows.length === 0 ? (
                <p className="text-[12px] text-secondary">Sin estados registrados.</p>
              ) : (
                statusRows.map((row) => (
                  <div key={row.status} className="flex items-center justify-between py-1">
                    <span className={`an-pill ${row.badgeClass}`}>{row.label}</span>
                    <span className="font-display text-[13px] font-bold text-primary tabular-nums">{row.count.toLocaleString("es-AR")}</span>
                  </div>
                ))
              )}
            </div>
          </article>

          {/* Dispositivos */}
          <article className="rounded-xl border border-[color:var(--border-soft)] bg-surface shadow-[var(--shadow-xs)]">
            <div className="px-4 py-3 border-b border-[color:var(--border-soft)]">
              <h2 className="font-display text-[13px] font-bold text-primary">Dispositivos</h2>
              <p className="text-[11px] text-secondary">Volumen y conversión</p>
            </div>
            <div className="px-4 py-3 space-y-2.5">
              {deviceRows.length === 0 ? (
                <p className="text-[12px] text-secondary">Sin datos de dispositivo.</p>
              ) : (
                deviceRows.map((row) => (
                  <div key={row.deviceType} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`an-pill ${getDeviceBadgeClass(row.deviceType)}`}>
                        {getDeviceLabel(row.deviceType)}
                      </span>
                      <span className="text-[11px] text-secondary tabular-nums">
                        {row.sessions.toLocaleString("es-AR")} · <span className="font-semibold text-primary">{row.conversionPct}%</span>
                      </span>
                    </div>
                    <div className="h-[3px] overflow-hidden rounded-full bg-[color:var(--bg-sunken)]">
                      <div
                        className="an-bar h-[3px] rounded-full"
                        style={{
                          width: `${Math.max((row.sessions / maxDeviceSessions) * 100, row.sessions > 0 ? 4 : 0)}%`,
                          background: "var(--grad-hero)"
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>

        {/* ── SESIONES RECIENTES — DENSE TABLE ─────────────────────────────────── */}
        <section className="an-panel an-panel-3 rounded-xl border border-[color:var(--border-soft)] bg-surface shadow-[var(--shadow-xs)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border-soft)]">
            <div>
              <h2 className="font-display text-[13px] font-bold text-primary">Sesiones recientes</h2>
              <p className="text-[11px] text-secondary">Últimos recorridos capturados — vista compacta</p>
            </div>
            {journeys.length > 0 && (
              <span className="an-pill an-pill-gray">
                {Math.min(journeys.length, SESSION_LIST_LIMIT)} de {journeys.length.toLocaleString("es-AR")}
              </span>
            )}
          </div>

          {journeys.length === 0 ? (
            <p className="px-4 py-8 text-[12px] text-secondary">Aún no se registraron visitas en el rango seleccionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="an-dense-table">
                <thead>
                  <tr>
                    <th>Sesión ID</th>
                    <th>Evento</th>
                    <th>Estado</th>
                    <th>Dispositivo</th>
                    <th>Origen</th>
                    <th>Último paso</th>
                    <th>Duración</th>
                    <th className="right">Última act.</th>
                    <th className="right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {journeys.slice(0, SESSION_LIST_LIMIT).map((journey) => {
                    const statusMeta = SESSION_STATUS_META[journey.status];
                    const stepMeta = getAnalyticsStepMeta(journey.lastStep);
                    const relTime = formatRelativeTime(journey.lastSeen, now);
                    const fullTime = dateTimeFormatter.format(journey.lastSeen);

                    // Map status to pill class
                    let statusPillClass = "an-pill-gray";
                    if (journey.status === "success") statusPillClass = "an-pill-green";
                    else if (journey.status === "abandoned") statusPillClass = "an-pill-red";
                    else if (journey.status === "active") statusPillClass = "an-pill-amber";
                    else if (journey.status === "failure" || journey.status === "checkout_error") statusPillClass = "an-pill-red";
                    else if (journey.status === "pending") statusPillClass = "an-pill-blue";

                    // Device pill
                    let devicePillClass = "an-pill-gray";
                    if (journey.deviceType === "mobile") devicePillClass = "an-pill-blue";
                    else if (journey.deviceType === "tablet") devicePillClass = "an-pill-violet";

                    return (
                      <tr key={journey.key} className="an-trow">
                        <td className="mono">{journey.sessionId.slice(-8)}</td>
                        <td className="max-w-[160px] truncate text-[12px]">{journey.eventName}</td>
                        <td>
                          <span className={`an-pill ${statusPillClass}`}>
                            {journey.status === "active" && (
                              <span className="an-dot-pulse inline-block h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                            )}
                            {statusMeta.label}
                          </span>
                        </td>
                        <td>
                          <span className={`an-pill ${devicePillClass}`}>{getDeviceLabel(journey.deviceType)}</span>
                        </td>
                        <td className="muted max-w-[120px] truncate">{getReferrerLabel(journey.referrerHost, appHost)}</td>
                        <td className="muted">{stepMeta.label}</td>
                        <td className="muted tabular-nums">{formatDuration(journey.durationMs)}</td>
                        <td className="right muted tabular-nums">
                          <span title={fullTime}>{relTime}</span>
                        </td>
                        <td className="right">
                          <button
                            className="an-action-btn"
                            title="Ver recorrido"
                            aria-label="Ver recorrido completo"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── FUNNEL / ABANDONO + CONVERSIÓN POR EVENTO (2-col grid) ─────────── */}
        <section className="an-panel an-panel-4 grid gap-4 xl:grid-cols-2">

          {/* Puntos de fuga */}
          <article className="rounded-xl border border-[color:var(--border-soft)] bg-surface shadow-[var(--shadow-xs)]">
            <div className="px-4 py-3 border-b border-[color:var(--border-soft)]">
              <h2 className="font-display text-[13px] font-bold text-primary">Puntos de fuga</h2>
              <p className="text-[11px] text-secondary">En qué paso terminan las sesiones abandonadas</p>
            </div>
            <div className="px-4 py-3 space-y-1.5">
              {abandonmentRows.length === 0 ? (
                <p className="text-[12px] text-secondary">No se detectaron abandonos.</p>
              ) : (
                abandonmentRows.map((row) => (
                  <div key={row.step} className="flex items-center justify-between py-1">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-primary">{row.label}</p>
                      <p className="text-[10px] text-secondary">{row.pct}% del total</p>
                    </div>
                    <span className="ml-3 shrink-0 rounded-full bg-danger-500 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
                      {row.count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>

          {/* Conversión por evento */}
          <article className="rounded-xl border border-[color:var(--border-soft)] bg-surface shadow-[var(--shadow-xs)]">
            <div className="px-4 py-3 border-b border-[color:var(--border-soft)]">
              <h2 className="font-display text-[13px] font-bold text-primary">Conversión por evento</h2>
              <p className="text-[11px] text-secondary">Visitas, checkout, conversión y abandono</p>
            </div>
            <div className="divide-y divide-[color:var(--border-soft)]">
              {eventJourneyRows.length === 0 ? (
                <p className="px-4 py-6 text-[12px] text-secondary">No hay eventos en el filtro.</p>
              ) : (
                eventJourneyRows.map((row) => (
                  <div key={row.slug} className="px-4 py-2.5 hover:bg-[color:var(--bg-sunken)] transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-[12px] font-semibold text-primary truncate">{row.name}</p>
                      <span className="shrink-0 text-[11px] text-secondary tabular-nums">{row.sessions.toLocaleString("es-AR")} vis.</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]">
                      <span className="text-secondary">Checkout <span className="font-bold text-primary">{row.checkoutRate}%</span></span>
                      <span className="text-secondary">Conversión <span className="font-bold text-success-700">{row.conversionRate}%</span></span>
                      <span className="text-secondary">Abandono <span className="font-bold text-danger-600">{row.abandonmentRate}%</span></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>

        {/* ── RENDIMIENTO COMERCIAL ────────────────────────────────────────────── */}
        <section className="an-panel an-panel-5 rounded-xl border border-[color:var(--border-soft)] bg-surface shadow-[var(--shadow-xs)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border-soft)]">
            <div>
              <h2 className="font-display text-[13px] font-bold text-primary">Rendimiento comercial</h2>
              <p className="text-[11px] text-secondary">Ingresos y tickets dentro del filtro · invitaciones excluidas</p>
            </div>
          </div>

          {commercialRows.length === 0 ? (
            <p className="px-4 py-6 text-[12px] text-secondary">No hay eventos para analizar comercialmente.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="an-dense-table">
                <thead>
                  <tr>
                    <th>Evento</th>
                    <th className="right">Ingresos</th>
                    <th>Barra</th>
                    <th className="right">Tickets</th>
                    <th className="right">Asistentes</th>
                    <th className="right">Asistencia</th>
                  </tr>
                </thead>
                <tbody>
                  {commercialRows.map((row) => (
                    <tr key={row.id} className="an-trow">
                      <td className="font-semibold max-w-[200px] truncate">{row.name}</td>
                      <td className="right">
                        <span className="an-grad-num font-display text-[13px] font-extrabold tabular-nums">{centsToCurrency(row.revenue)}</span>
                      </td>
                      <td className="w-[120px]">
                        <div className="h-[4px] overflow-hidden rounded-full bg-[color:var(--bg-sunken)]">
                          <div
                            className="an-bar h-[4px] rounded-full"
                            style={{
                              width: `${Math.max((row.revenue / maxRevenue) * 100, row.revenue > 0 ? 4 : 0)}%`,
                              background: "var(--grad-hero)"
                            }}
                          />
                        </div>
                      </td>
                      <td className="right muted tabular-nums">{row.sold}</td>
                      <td className="right muted tabular-nums">{row.attended}</td>
                      <td className="right">
                        <span className={`font-bold tabular-nums text-[12px] ${row.attendanceRate >= 70 ? "text-success-700" : row.attendanceRate >= 40 ? "text-warning-700" : "text-secondary"}`}>
                          {row.attendanceRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </>
  );
}
