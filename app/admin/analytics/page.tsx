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
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
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
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-title-m font-semibold text-primary">Analytics UX</h1>
            <p className="muted mt-1">
              Recorridos anonimos por sesion y evento. Una visita queda marcada como abandono si no llega a un estado final y queda inactiva por mas de 30 minutos.
            </p>
          </div>
          <Link href="/admin" className="btn-secondary">
            Volver al dashboard
          </Link>
        </div>

        <form className="mt-5 grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <label className="space-y-1">
            <span className="label">Evento</span>
            <select name="event" defaultValue={selectedEventSlug} className="field">
              <option value="">Todos los eventos</option>
              {availableEvents.map((event) => (
                <option key={event.id} value={event.slug}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="label">Rango</span>
            <select name="range" defaultValue={range.value} className="field">
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary">
              Aplicar
            </button>
            <Link href="/admin/analytics" className="btn-secondary">
              Reset
            </Link>
          </div>
        </form>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="panel p-4">
          <p className="text-overline text-secondary">Visitas</p>
          <p className="mt-1 text-title-l font-semibold text-primary">{journeys.length.toLocaleString("es-AR")}</p>
          <p className="mt-1 text-caption text-secondary">{range.label}</p>
        </article>
        <article className="panel p-4">
          <p className="text-overline text-secondary">Llegan al checkout</p>
          <p className="mt-1 text-title-l font-semibold text-primary">{checkoutReachedJourneys.toLocaleString("es-AR")}</p>
          <p className="mt-1 text-caption text-secondary">{checkoutRate}% del total</p>
        </article>
        <article className="panel p-4">
          <p className="text-overline text-secondary">Intentan pagar</p>
          <p className="mt-1 text-title-l font-semibold text-primary">{submitJourneys.toLocaleString("es-AR")}</p>
          <p className="mt-1 text-caption text-secondary">{submitRate}% del total</p>
        </article>
        <article className="panel p-4">
          <p className="text-overline text-secondary">Convertidas</p>
          <p className="mt-1 text-title-l font-semibold text-success-700">{convertedJourneys.toLocaleString("es-AR")}</p>
          <p className="mt-1 text-caption text-secondary">{conversionRate}% del total</p>
        </article>
        <article className="panel p-4">
          <p className="text-overline text-secondary">Abandonos</p>
          <p className="mt-1 text-title-l font-semibold text-danger-700">{abandonedJourneys.toLocaleString("es-AR")}</p>
          <p className="mt-1 text-caption text-secondary">{activeJourneys.toLocaleString("es-AR")} visitas activas</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <article className="panel p-5">
          <h2 className="text-body-l font-semibold text-primary">Embudo UX</h2>
          <p className="muted mt-1">Cuenta cuantas visitas alcanzan cada hito del flujo de compra.</p>

          {journeys.length === 0 ? (
            <p className="muted mt-4">Todavia no hay recorridos para mostrar en este filtro.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {funnelRows.map((row) => (
                <div key={row.step} className="grid grid-cols-[170px_1fr_90px_90px] items-center gap-3">
                  <span className="text-caption font-medium text-secondary">{row.label}</span>
                  <div className="h-4 overflow-hidden rounded-full bg-sunken">
                    <div
                      className="h-4 rounded-full bg-forest-600 transition-all"
                      style={{ width: `${Math.max((row.sessions / maxFunnelSessions) * 100, row.sessions > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  <span className="text-right text-body-s font-semibold text-primary">{row.sessions.toLocaleString("es-AR")}</span>
                  <span className="text-right text-caption text-secondary">
                    {row.dropOffPct === null ? "entrada" : `-${row.dropOffPct}%`}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-sm border border-soft bg-sunken p-3 text-caption text-secondary">
            El embudo usa una visita unica por combinacion <span className="font-semibold text-primary">sesion + evento</span>, para no mezclar recorridos de distintos eventos en un mismo navegador.
          </div>
        </article>

        <article className="panel p-5">
          <h2 className="text-body-l font-semibold text-primary">Estado final de las visitas</h2>
          <p className="muted mt-1">Distribucion del ultimo estado visto por cada sesion.</p>

          <div className="mt-5 space-y-3">
            {statusRows.length === 0 ? (
              <p className="muted">Sin estados registrados todavia.</p>
            ) : (
              statusRows.map((row) => (
                <div key={row.status} className="flex items-center justify-between rounded-sm border border-soft px-3 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.badgeClass}`}>{row.label}</span>
                  <span className="text-body-s font-semibold text-primary">{row.count.toLocaleString("es-AR")}</span>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="panel p-5 xl:col-span-1">
          <h2 className="text-body-l font-semibold text-primary">Puntos de fuga</h2>
          <p className="muted mt-1">En que paso terminan las visitas abandonadas.</p>

          <div className="mt-5 space-y-3">
            {abandonmentRows.length === 0 ? (
              <p className="muted">Todavia no se detectaron abandonos en este filtro.</p>
            ) : (
              abandonmentRows.map((row) => (
                <div key={row.step} className="flex items-center justify-between rounded-sm border border-soft px-3 py-2.5">
                  <div>
                    <p className="text-body-s font-semibold text-primary">{row.label}</p>
                    <p className="text-caption text-secondary">{row.pct}% del total</p>
                  </div>
                  <span className="rounded-full bg-danger-500 px-2 py-0.5 text-xs font-semibold text-onprimary">{row.count}</span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel p-5 xl:col-span-1">
          <h2 className="text-body-l font-semibold text-primary">Dispositivos</h2>
          <p className="muted mt-1">Comparativo de volumen y conversion por tipo de dispositivo.</p>

          <div className="mt-5 space-y-3">
            {deviceRows.length === 0 ? (
              <p className="muted">Sin datos de dispositivo disponibles.</p>
            ) : (
              deviceRows.map((row) => (
                <div key={row.deviceType} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getDeviceBadgeClass(row.deviceType)}`}>
                      {getDeviceLabel(row.deviceType)}
                    </span>
                    <span className="text-caption text-secondary">
                      {row.sessions.toLocaleString("es-AR")} visitas · {row.conversionPct}% conv.
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-sunken">
                    <div
                      className="h-3 rounded-full bg-forest-600"
                      style={{ width: `${Math.max((row.sessions / maxDeviceSessions) * 100, row.sessions > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel p-5 xl:col-span-1">
          <h2 className="text-body-l font-semibold text-primary">Origenes de trafico</h2>
          <p className="muted mt-1">Referrer host de entrada por sesion. El trafico sin referrer aparece como Directo.</p>

          <div className="mt-5 space-y-3">
            {referrerRows.length === 0 ? (
              <p className="muted">Sin referrers registrados todavia.</p>
            ) : (
              referrerRows.map((row) => (
                <div key={row.label} className="grid grid-cols-[1fr_80px] items-center gap-3">
                  <div>
                    <p className="truncate text-body-s font-medium text-primary">{row.label}</p>
                    <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-sunken">
                      <div
                        className="h-2.5 rounded-full bg-forest-600"
                        style={{ width: `${Math.max((row.count / maxReferrerSessions) * 100, row.count > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-right text-body-s font-semibold text-primary">{row.count.toLocaleString("es-AR")}</span>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="panel p-5">
        <h2 className="text-body-l font-semibold text-primary">Sesiones recientes</h2>
        <p className="muted mt-1">Ultimos recorridos capturados. Cada tarjeta representa una visita anonima a un evento.</p>

        {journeys.length === 0 ? (
          <p className="muted mt-4">Aun no se registraron visitas en el rango seleccionado.</p>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {journeys.slice(0, SESSION_LIST_LIMIT).map((journey) => {
              const statusMeta = SESSION_STATUS_META[journey.status];

              return (
                <article key={journey.key} className="rounded-md border border-soft bg-sunken p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-overline text-secondary">{formatAnalyticsSessionLabel(journey.sessionId)}</p>
                      <h3 className="text-base font-semibold text-primary">{journey.eventName}</h3>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}>{statusMeta.label}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${getDeviceBadgeClass(journey.deviceType)}`}>
                      {getDeviceLabel(journey.deviceType)}
                    </span>
                    <span className="rounded-full bg-surface px-2 py-0.5 font-medium text-secondary">
                      {getReferrerLabel(journey.referrerHost, appHost)}
                    </span>
                    {journey.landingPath ? <span className="rounded-full bg-surface px-2 py-0.5 font-medium text-secondary">Entro por {journey.landingPath}</span> : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {journey.timeline.map((step, index) => {
                      const stepMeta = getAnalyticsStepMeta(step);
                      return (
                        <span key={`${journey.key}:${step}:${index}`} className={`rounded-full px-2 py-0.5 text-xs font-semibold text-onprimary ${stepMeta.color}`}>
                          {stepMeta.label}
                        </span>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid gap-2 text-body-s text-secondary sm:grid-cols-2">
                    <p>
                      Inicio: <span className="font-semibold text-primary">{dateTimeFormatter.format(journey.firstSeen)}</span>
                    </p>
                    <p>
                      Ultima actividad: <span className="font-semibold text-primary">{dateTimeFormatter.format(journey.lastSeen)}</span>
                    </p>
                    <p>
                      Duracion: <span className="font-semibold text-primary">{formatDuration(journey.durationMs)}</span>
                    </p>
                    <p>
                      Ultimo paso: <span className="font-semibold text-primary">{getAnalyticsStepMeta(journey.lastStep).label}</span>
                    </p>
                  </div>

                  {journey.lastPath ? (
                    <p className="mt-3 text-caption text-secondary">
                      Ultima ruta vista: <span className="font-semibold text-primary">{journey.lastPath}</span>
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <article className="panel p-5">
          <h2 className="text-body-l font-semibold text-primary">Conversion por evento</h2>
          <p className="muted mt-1">Comparativo rapido entre visitas, avance en checkout, conversion y abandono.</p>

          <div className="mt-4 space-y-4">
            {eventJourneyRows.length === 0 ? (
              <p className="muted">No hay eventos dentro del filtro seleccionado.</p>
            ) : (
              eventJourneyRows.map((row) => (
                <article key={row.slug} className="rounded-md border border-soft p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-primary">{row.name}</h3>
                    <span className="text-body-s font-semibold text-secondary">{row.sessions.toLocaleString("es-AR")} visitas</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-body-s text-secondary sm:grid-cols-4">
                    <p>Checkout: <span className="font-semibold text-primary">{row.checkoutRate}%</span></p>
                    <p>Intento pago: <span className="font-semibold text-primary">{row.submit.toLocaleString("es-AR")}</span></p>
                    <p>Conversion: <span className="font-semibold text-success-700">{row.conversionRate}%</span></p>
                    <p>Abandono: <span className="font-semibold text-danger-700">{row.abandonmentRate}%</span></p>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="panel p-5">
          <h2 className="text-body-l font-semibold text-primary">Ventas por dia</h2>
          <p className="muted mt-1">Ingresos aprobados dentro del rango seleccionado.</p>

          <div className="mt-4 space-y-2">
            {salesByDay.length === 0 ? (
              <p className="muted">Aun no hay ventas pagadas.</p>
            ) : (
              salesByDay.map((day) => (
                <div key={day.date} className="grid grid-cols-[110px_1fr_120px] items-center gap-3">
                  <span className="text-caption text-secondary">{day.date}</span>
                  <div className="h-3 rounded-full bg-sunken">
                    <div className="h-3 rounded-full bg-forest-600" style={{ width: `${Math.max((day.total / maxDay) * 100, 2)}%` }} />
                  </div>
                  <span className="text-right text-body-s font-medium text-primary">{centsToCurrency(day.total)}</span>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="panel p-5">
        <h2 className="text-body-l font-semibold text-primary">Rendimiento comercial</h2>
        <p className="muted mt-1">Ingresos y tickets comerciales dentro del filtro actual. Las invitaciones quedan fuera de este bloque.</p>

        <div className="mt-4 space-y-4">
          {commercialRows.length === 0 ? (
            <p className="muted">No hay eventos para analizar comercialmente.</p>
          ) : (
            commercialRows.map((row) => (
              <article key={row.id} className="rounded-md border border-soft p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-primary">{row.name}</h3>
                  <p className="text-body-s font-semibold text-forest-700">{centsToCurrency(row.revenue)}</p>
                </div>

                <div className="mt-3 h-3 rounded-full bg-sunken">
                  <div className="h-3 rounded-full bg-forest-600" style={{ width: `${Math.max((row.revenue / maxRevenue) * 100, row.revenue > 0 ? 2 : 0)}%` }} />
                </div>

                <div className="mt-3 grid gap-2 text-body-s text-secondary md:grid-cols-3">
                  <p>Tickets vendidos: <span className="font-semibold text-primary">{row.sold}</span></p>
                  <p>Asistentes: <span className="font-semibold text-primary">{row.attended}</span></p>
                  <p>Asistencia: <span className="font-semibold text-primary">{row.attendanceRate}%</span></p>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
