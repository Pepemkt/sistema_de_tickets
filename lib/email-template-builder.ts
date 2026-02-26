export type EmailTemplateBuilderConfig = {
  subjectTemplate: string;
  brandName: string;
  badgeText: string;
  headline: string;
  greetingText: string;
  bodyText: string;
  detailsTitle: string;
  labelEvent: string;
  labelDate: string;
  labelVenue: string;
  labelTickets: string;
  labelTotal: string;
  labelOrder: string;
  supportText: string;
  footerText: string;
  accentColor: string;
  backgroundColor: string;
  panelColor: string;
  detailsPanelColor: string;
};

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

export const defaultEmailTemplateBuilder: EmailTemplateBuilderConfig = {
  subjectTemplate: "Tus entradas para {{eventName}}",
  brandName: "Aiderbrand Tickets",
  badgeText: "Compra confirmada",
  headline: "Tu compra fue aprobada",
  greetingText: "Hola {{buyerName}},",
  bodyText:
    "Tu pago fue aprobado y tus entradas para {{eventName}} ya estan emitidas. En este email van adjuntas en PDF con su QR unico para validacion en acceso.",
  detailsTitle: "Resumen de la compra",
  labelEvent: "Evento",
  labelDate: "Fecha",
  labelVenue: "Lugar",
  labelTickets: "Entradas",
  labelTotal: "Total",
  labelOrder: "Orden",
  supportText: "Si tenes dudas, responde a este email o escribinos a {{supportEmail}}.",
  footerText: "© {{year}} Aiderbrand. Todos los derechos reservados.",
  accentColor: "#1d4ed8",
  backgroundColor: "#f8fafc",
  panelColor: "#ffffff",
  detailsPanelColor: "#f8fafc"
};

function normalizeText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function normalizeColor(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  if (!HEX_COLOR_REGEX.test(normalized)) return fallback;
  return normalized;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textToHtml(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

export function normalizeEmailTemplateBuilder(input: unknown): EmailTemplateBuilderConfig {
  if (!input || typeof input !== "object") {
    return defaultEmailTemplateBuilder;
  }

  const maybe = input as Partial<EmailTemplateBuilderConfig>;
  const legacyIntro = typeof (input as { introText?: unknown }).introText === "string"
    ? String((input as { introText?: unknown }).introText).trim()
    : "";
  const [legacyGreeting = "", ...legacyBodyParts] = legacyIntro.split(/\n\s*\n/);
  const legacyBody = legacyBodyParts.join("\n\n").trim();

  return {
    subjectTemplate: normalizeText(maybe.subjectTemplate, defaultEmailTemplateBuilder.subjectTemplate),
    brandName: normalizeText(maybe.brandName, defaultEmailTemplateBuilder.brandName),
    badgeText: normalizeText(maybe.badgeText, defaultEmailTemplateBuilder.badgeText),
    headline: normalizeText(maybe.headline, defaultEmailTemplateBuilder.headline),
    greetingText: normalizeText(maybe.greetingText, legacyGreeting || defaultEmailTemplateBuilder.greetingText),
    bodyText: normalizeText(maybe.bodyText, legacyBody || defaultEmailTemplateBuilder.bodyText),
    detailsTitle: normalizeText(maybe.detailsTitle, defaultEmailTemplateBuilder.detailsTitle),
    labelEvent: normalizeText(maybe.labelEvent, defaultEmailTemplateBuilder.labelEvent),
    labelDate: normalizeText(maybe.labelDate, defaultEmailTemplateBuilder.labelDate),
    labelVenue: normalizeText(maybe.labelVenue, defaultEmailTemplateBuilder.labelVenue),
    labelTickets: normalizeText(maybe.labelTickets, defaultEmailTemplateBuilder.labelTickets),
    labelTotal: normalizeText(maybe.labelTotal, defaultEmailTemplateBuilder.labelTotal),
    labelOrder: normalizeText(maybe.labelOrder, defaultEmailTemplateBuilder.labelOrder),
    supportText: normalizeText(maybe.supportText, defaultEmailTemplateBuilder.supportText),
    footerText: normalizeText(maybe.footerText, defaultEmailTemplateBuilder.footerText),
    accentColor: normalizeColor(maybe.accentColor, defaultEmailTemplateBuilder.accentColor),
    backgroundColor: normalizeColor(maybe.backgroundColor, defaultEmailTemplateBuilder.backgroundColor),
    panelColor: normalizeColor(maybe.panelColor, defaultEmailTemplateBuilder.panelColor),
    detailsPanelColor: normalizeColor(maybe.detailsPanelColor, defaultEmailTemplateBuilder.detailsPanelColor)
  };
}

export function buildEmailTemplateFromBuilder(input: EmailTemplateBuilderConfig) {
  const builder = normalizeEmailTemplateBuilder(input);

  const subject = builder.subjectTemplate;
  const html = `
<div style="background:${builder.backgroundColor};padding:24px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:${builder.panelColor};border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="background:linear-gradient(135deg,#0f172a,${builder.accentColor});padding:28px 24px;color:#ffffff;">
        <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">${textToHtml(builder.brandName)}</p>
        <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;">${textToHtml(builder.badgeText)}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <h2 style="margin:0 0 14px;font-size:20px;color:#0f172a;">${textToHtml(builder.headline)}</h2>
        <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#1e293b;">${textToHtml(builder.greetingText)}</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1e293b;">${textToHtml(builder.bodyText)}</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;background:${builder.detailsPanelColor};border:1px solid #e2e8f0;border-radius:12px;">
          <tr><td style="padding:14px 16px 4px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#475569;">${textToHtml(builder.detailsTitle)}</td></tr>
          <tr><td style="padding:6px 16px;font-size:14px;color:#0f172a;"><strong>${textToHtml(builder.labelEvent)}:</strong> {{eventName}}</td></tr>
          <tr><td style="padding:6px 16px;font-size:14px;color:#0f172a;"><strong>${textToHtml(builder.labelDate)}:</strong> {{eventDate}}</td></tr>
          <tr><td style="padding:6px 16px;font-size:14px;color:#0f172a;"><strong>${textToHtml(builder.labelVenue)}:</strong> {{eventVenue}}</td></tr>
          <tr><td style="padding:6px 16px;font-size:14px;color:#0f172a;"><strong>${textToHtml(builder.labelTickets)}:</strong> {{ticketCount}}</td></tr>
          <tr><td style="padding:6px 16px;font-size:14px;color:#0f172a;"><strong>${textToHtml(builder.labelTotal)}:</strong> {{totalAmount}}</td></tr>
          <tr><td style="padding:6px 16px 14px;font-size:14px;color:#0f172a;"><strong>${textToHtml(builder.labelOrder)}:</strong> {{orderId}}</td></tr>
        </table>
        <p style="margin:0;font-size:13px;line-height:1.55;color:#475569;">${textToHtml(builder.supportText)}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 24px;background:#f1f5f9;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
        ${textToHtml(builder.footerText)}
      </td>
    </tr>
  </table>
</div>`.trim();

  return { subject, html };
}
