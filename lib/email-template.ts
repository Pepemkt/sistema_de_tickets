import { buildEmailTemplateFromBuilder, defaultEmailTemplateBuilder } from "@/lib/email-template-builder";

type EmailTemplateInput = {
  subject: string;
  html: string;
};

type EmailTemplateVariables = {
  buyerName: string;
  buyerEmail: string;
  eventName: string;
  eventDate: string;
  eventVenue: string;
  orderId: string;
  quantity: string;
  ticketCount: string;
  totalAmount: string;
  supportEmail: string;
  year: string;
};

const TOKEN_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export const EMAIL_TEMPLATE_TOKENS = [
  "buyerName",
  "buyerEmail",
  "eventName",
  "eventDate",
  "eventVenue",
  "orderId",
  "quantity",
  "ticketCount",
  "totalAmount",
  "supportEmail",
  "year"
] as const;

export const defaultEmailTemplate: EmailTemplateInput = buildEmailTemplateFromBuilder(defaultEmailTemplateBuilder);

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function normalizeEmailTemplate(template: unknown): EmailTemplateInput {
  if (!template || typeof template !== "object") {
    return defaultEmailTemplate;
  }

  const maybe = template as Partial<EmailTemplateInput>;

  const subject = typeof maybe.subject === "string" && maybe.subject.trim()
    ? maybe.subject.trim()
    : defaultEmailTemplate.subject;

  const html = typeof maybe.html === "string" && maybe.html.trim()
    ? maybe.html.trim()
    : defaultEmailTemplate.html;

  return { subject, html };
}

export function buildEmailTemplateVariables(input: {
  buyerName: string;
  buyerEmail: string;
  eventName: string;
  startsAt: Date;
  venue: string | null;
  orderId: string;
  quantity: number;
  ticketCount: number;
  totalCents: number;
  supportEmail: string;
}) {
  const date = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(new Date(input.startsAt));

  const totalAmount = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS"
  }).format(input.totalCents / 100);

  const vars: EmailTemplateVariables = {
    buyerName: input.buyerName,
    buyerEmail: input.buyerEmail,
    eventName: input.eventName,
    eventDate: date,
    eventVenue: input.venue || "A confirmar",
    orderId: input.orderId,
    quantity: String(input.quantity),
    ticketCount: String(input.ticketCount),
    totalAmount,
    supportEmail: input.supportEmail,
    year: String(new Date().getFullYear())
  };

  return vars;
}

export function renderEmailTemplate(template: EmailTemplateInput, variables: EmailTemplateVariables) {
  const replaceToken = (value: string, escapeValues: boolean) =>
    value.replace(TOKEN_REGEX, (_, token: string) => {
      const key = token as keyof EmailTemplateVariables;
      if (!(key in variables)) return "";
      const tokenValue = variables[key];
      return escapeValues ? escapeHtml(tokenValue) : tokenValue;
    });

  return {
    subject: replaceToken(template.subject, false),
    html: replaceToken(template.html, true)
  };
}
