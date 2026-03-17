export const ANALYTICS_STEP_META = {
  event_page: {
    label: "Pagina del evento",
    color: "bg-blue-500",
    rank: 1,
    progressionRank: 1,
    terminal: false
  },
  checkout: {
    label: "Checkout",
    color: "bg-indigo-500",
    rank: 2,
    progressionRank: 2,
    terminal: false
  },
  checkout_started: {
    label: "Comenzo el formulario",
    color: "bg-violet-500",
    rank: 3,
    progressionRank: 3,
    terminal: false
  },
  checkout_submit: {
    label: "Intento pagar",
    color: "bg-cyan-500",
    rank: 4,
    progressionRank: 4,
    terminal: false
  },
  checkout_redirect: {
    label: "Redireccion a Mercado Pago",
    color: "bg-sky-500",
    rank: 5,
    progressionRank: 5,
    terminal: false
  },
  success: {
    label: "Pago exitoso",
    color: "bg-emerald-500",
    rank: 6,
    progressionRank: 5,
    terminal: true
  },
  pending: {
    label: "Pago pendiente",
    color: "bg-amber-400",
    rank: 6,
    progressionRank: 5,
    terminal: true
  },
  failure: {
    label: "Pago rechazado",
    color: "bg-rose-500",
    rank: 6,
    progressionRank: 5,
    terminal: true
  },
  checkout_error: {
    label: "Error creando la orden",
    color: "bg-orange-500",
    rank: 4,
    progressionRank: 4,
    terminal: false
  }
} as const;

export type AnalyticsStep = keyof typeof ANALYTICS_STEP_META;

export const ANALYTICS_STEPS = Object.keys(ANALYTICS_STEP_META) as AnalyticsStep[];

export const PRIMARY_FUNNEL_STEPS: AnalyticsStep[] = [
  "event_page",
  "checkout",
  "checkout_started",
  "checkout_submit",
  "checkout_redirect",
  "success"
];

export const SESSION_STATUS_META = {
  active: {
    label: "Activa",
    badgeClass: "bg-blue-100 text-blue-700"
  },
  abandoned: {
    label: "Abandono",
    badgeClass: "bg-rose-100 text-rose-700"
  },
  success: {
    label: "Convertida",
    badgeClass: "bg-emerald-100 text-emerald-700"
  },
  pending: {
    label: "Pendiente",
    badgeClass: "bg-amber-100 text-amber-700"
  },
  failure: {
    label: "Rechazada",
    badgeClass: "bg-rose-100 text-rose-700"
  },
  checkout_error: {
    label: "Error",
    badgeClass: "bg-orange-100 text-orange-700"
  }
} as const;

export type AnalyticsSessionStatus = keyof typeof SESSION_STATUS_META;

export function isAnalyticsStep(value: string): value is AnalyticsStep {
  return value in ANALYTICS_STEP_META;
}

export function getAnalyticsStepMeta(step: AnalyticsStep) {
  return ANALYTICS_STEP_META[step];
}

export function getAnalyticsStepRank(step: AnalyticsStep) {
  return ANALYTICS_STEP_META[step].rank;
}

export function getAnalyticsProgressionRank(step: AnalyticsStep) {
  return ANALYTICS_STEP_META[step].progressionRank;
}

export function isTerminalAnalyticsStep(step: AnalyticsStep) {
  return ANALYTICS_STEP_META[step].terminal;
}

export function getAnalyticsVisitKey(sessionId: string, eventSlug: string) {
  return `${sessionId}::${eventSlug}`;
}

export function formatAnalyticsSessionLabel(sessionId: string) {
  const normalized = sessionId.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase();
  return `S-${normalized || "ANON"}`;
}
