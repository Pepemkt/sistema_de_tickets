export const ANALYTICS_STEP_META = {
  event_page: {
    label: "Pagina del evento",
    color: "bg-forest-500",
    rank: 1,
    progressionRank: 1,
    terminal: false
  },
  checkout: {
    label: "Checkout",
    color: "bg-forest-500",
    rank: 2,
    progressionRank: 2,
    terminal: false
  },
  checkout_started: {
    label: "Comenzo el formulario",
    color: "bg-forest-500",
    rank: 3,
    progressionRank: 3,
    terminal: false
  },
  checkout_submit: {
    label: "Intento pagar",
    color: "bg-forest-500",
    rank: 4,
    progressionRank: 4,
    terminal: false
  },
  checkout_redirect: {
    label: "Redireccion a Mercado Pago",
    color: "bg-forest-500",
    rank: 5,
    progressionRank: 5,
    terminal: false
  },
  success: {
    label: "Pago exitoso",
    color: "bg-success-500",
    rank: 6,
    progressionRank: 5,
    terminal: true
  },
  pending: {
    label: "Pago pendiente",
    color: "bg-warning-700",
    rank: 6,
    progressionRank: 5,
    terminal: true
  },
  failure: {
    label: "Pago rechazado",
    color: "bg-danger-500",
    rank: 6,
    progressionRank: 5,
    terminal: true
  },
  checkout_error: {
    label: "Error creando la orden",
    color: "bg-danger-500",
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
    badgeClass: "bg-info-50 text-info-700"
  },
  abandoned: {
    label: "Abandono",
    badgeClass: "bg-danger-50 text-danger-700"
  },
  success: {
    label: "Convertida",
    badgeClass: "bg-success-50 text-success-700"
  },
  pending: {
    label: "Pendiente",
    badgeClass: "bg-warning-50 text-warning-700"
  },
  failure: {
    label: "Rechazada",
    badgeClass: "bg-danger-50 text-danger-700"
  },
  checkout_error: {
    label: "Error",
    badgeClass: "bg-danger-50 text-danger-700"
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
