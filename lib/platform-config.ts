import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { defaultEmailTemplate, normalizeEmailTemplate } from "@/lib/email-template";
import { buildEmailTemplateFromBuilder, defaultEmailTemplateBuilder, normalizeEmailTemplateBuilder } from "@/lib/email-template-builder";
import { CheckoutFeeItem, normalizeCheckoutFeeItems } from "@/lib/checkout-fees";

const DEFAULT_CONFIG_ID = "default";

export async function getPlatformConfig() {
  return db.platformConfig.findUnique({
    where: { id: DEFAULT_CONFIG_ID }
  });
}

export async function upsertMercadoPagoConfig(input: {
  mercadoPagoAccessToken?: string | null;
  mercadoPagoWebhookSecret?: string | null;
}) {
  return db.platformConfig.upsert({
    where: { id: DEFAULT_CONFIG_ID },
    create: {
      id: DEFAULT_CONFIG_ID,
      mercadoPagoAccessToken: input.mercadoPagoAccessToken ?? null,
      mercadoPagoWebhookSecret: input.mercadoPagoWebhookSecret ?? null
    },
    update: {
      mercadoPagoAccessToken: input.mercadoPagoAccessToken,
      mercadoPagoWebhookSecret: input.mercadoPagoWebhookSecret
    }
  });
}

export async function upsertSmtpConfig(input: {
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
  smtpFrom?: string | null;
  smtpSecure?: boolean | null;
}) {
  return db.platformConfig.upsert({
    where: { id: DEFAULT_CONFIG_ID },
    create: {
      id: DEFAULT_CONFIG_ID,
      smtpHost: input.smtpHost ?? null,
      smtpPort: input.smtpPort ?? null,
      smtpUser: input.smtpUser ?? null,
      smtpPass: input.smtpPass ?? null,
      smtpFrom: input.smtpFrom ?? null,
      smtpSecure: input.smtpSecure ?? null
    },
    update: {
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
      smtpUser: input.smtpUser,
      smtpPass: input.smtpPass,
      smtpFrom: input.smtpFrom,
      smtpSecure: input.smtpSecure
    }
  });
}

export async function upsertEmailTemplateConfig(input: {
  emailTemplateBuilder?: unknown;
  emailTemplateSubject?: string | null;
  emailTemplateHtml?: string | null;
}) {
  const emailTemplateBuilder =
    input.emailTemplateBuilder === undefined ? undefined : input.emailTemplateBuilder ?? Prisma.DbNull;

  return db.platformConfig.upsert({
    where: { id: DEFAULT_CONFIG_ID },
    create: {
      id: DEFAULT_CONFIG_ID,
      emailTemplateBuilder: emailTemplateBuilder ?? Prisma.DbNull,
      emailTemplateSubject: input.emailTemplateSubject ?? null,
      emailTemplateHtml: input.emailTemplateHtml ?? null
    },
    update: {
      emailTemplateBuilder,
      emailTemplateSubject: input.emailTemplateSubject,
      emailTemplateHtml: input.emailTemplateHtml
    }
  });
}

export async function upsertCheckoutFeeItems(input: { checkoutFeeItems?: CheckoutFeeItem[] }) {
  return db.platformConfig.upsert({
    where: { id: DEFAULT_CONFIG_ID },
    create: {
      id: DEFAULT_CONFIG_ID,
      checkoutFeeItems: (input.checkoutFeeItems ?? []) as Prisma.InputJsonValue
    },
    update: {
      checkoutFeeItems: input.checkoutFeeItems as Prisma.InputJsonValue
    }
  });
}

export async function resolveCheckoutFeeItems() {
  const config = await getPlatformConfig();
  return normalizeCheckoutFeeItems(config?.checkoutFeeItems);
}

export async function resolveMercadoPagoAccessToken() {
  const config = await getPlatformConfig();
  return config?.mercadoPagoAccessToken || process.env.MERCADOPAGO_ACCESS_TOKEN || "";
}

export async function resolveMercadoPagoWebhookSecret() {
  const config = await getPlatformConfig();
  return config?.mercadoPagoWebhookSecret || process.env.MERCADOPAGO_WEBHOOK_SECRET || "";
}

export async function resolveSmtpConfig() {
  const config = await getPlatformConfig();

  const host = config?.smtpHost || process.env.SMTP_HOST || "";
  const port = config?.smtpPort || Number(process.env.SMTP_PORT ?? "587");
  const user = config?.smtpUser || process.env.SMTP_USER || "";
  const pass = config?.smtpPass || process.env.SMTP_PASS || "";
  const from = config?.smtpFrom || process.env.SMTP_FROM || "";
  const envSecure =
    process.env.SMTP_SECURE === undefined
      ? null
      : ["1", "true", "yes", "on"].includes(process.env.SMTP_SECURE.toLowerCase());
  const resolvedSecure = config?.smtpSecure ?? envSecure ?? port === 465;
  const secure = port === 465 ? true : resolvedSecure;

  return {
    host,
    port,
    user,
    pass,
    from,
    secure,
    configured: Boolean(host && user && pass && from)
  };
}

export async function resolveEmailTemplateConfig() {
  const config = await getPlatformConfig();

  if (config?.emailTemplateSubject && config?.emailTemplateHtml) {
    return normalizeEmailTemplate({
      subject: config.emailTemplateSubject,
      html: config.emailTemplateHtml
    });
  }

  if (config?.emailTemplateBuilder) {
    const builder = normalizeEmailTemplateBuilder(config.emailTemplateBuilder);
    const built = buildEmailTemplateFromBuilder(builder);
    return normalizeEmailTemplate(built);
  }

  if (!config?.emailTemplateSubject || !config?.emailTemplateHtml) {
    const built = buildEmailTemplateFromBuilder(defaultEmailTemplateBuilder);
    return normalizeEmailTemplate(built);
  }

  return normalizeEmailTemplate({
    subject: config?.emailTemplateSubject ?? defaultEmailTemplate.subject,
    html: config?.emailTemplateHtml ?? defaultEmailTemplate.html
  });
}

export function resolveAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL no configurada");
  }

  let parsed: URL;
  try {
    parsed = new URL(appUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL debe ser una URL valida (http/https)");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL debe usar protocolo http o https");
  }

  return appUrl.replace(/\/+$/, "");
}
