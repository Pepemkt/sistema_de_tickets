import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLACEHOLDER_TOKENS = [
  "tu-proveedor",
  "tu-dominio",
  "reemplazar",
  "example.com",
  "smtp.tu-",
  "tickets@tu-"
];

function readOptionalString(name: string) {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  return value;
}

function ensureNotPlaceholder(name: string, value: string) {
  const normalized = value.toLowerCase();
  if (PLACEHOLDER_TOKENS.some((token) => normalized.includes(token))) {
    throw new Error(`${name} parece placeholder (${value}). Aborta sync para no pisar credenciales reales.`);
  }
}

function readOptionalInt(name: string) {
  const raw = readOptionalString(name);
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} invalido: ${raw}`);
  }
  return value;
}

function readOptionalBool(name: string) {
  const raw = readOptionalString(name);
  if (!raw) return undefined;
  const normalized = raw.toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`${name} invalido: ${raw}`);
}

async function main() {
  const updates: Record<string, unknown> = {};
  const allowSensitiveSync = process.env.SYNC_SENSITIVE_CONFIG === "true";

  if (!allowSensitiveSync) {
    console.log("SYNC_SENSITIVE_CONFIG!=true: se omite sincronizacion de credenciales MP/SMTP.");
    return;
  }

  const mercadoPagoAccessToken = readOptionalString("MERCADOPAGO_ACCESS_TOKEN");
  if (mercadoPagoAccessToken) {
    ensureNotPlaceholder("MERCADOPAGO_ACCESS_TOKEN", mercadoPagoAccessToken);
    updates.mercadoPagoAccessToken = mercadoPagoAccessToken;
  }

  const mercadoPagoWebhookSecret = readOptionalString("MERCADOPAGO_WEBHOOK_SECRET");
  if (mercadoPagoWebhookSecret) {
    ensureNotPlaceholder("MERCADOPAGO_WEBHOOK_SECRET", mercadoPagoWebhookSecret);
    updates.mercadoPagoWebhookSecret = mercadoPagoWebhookSecret;
  }

  const smtpHost = readOptionalString("SMTP_HOST");
  if (smtpHost) {
    ensureNotPlaceholder("SMTP_HOST", smtpHost);
    updates.smtpHost = smtpHost;
  }

  const smtpPort = readOptionalInt("SMTP_PORT");
  if (smtpPort !== undefined) updates.smtpPort = smtpPort;

  const smtpUser = readOptionalString("SMTP_USER");
  if (smtpUser) {
    ensureNotPlaceholder("SMTP_USER", smtpUser);
    updates.smtpUser = smtpUser;
  }

  const smtpPass = readOptionalString("SMTP_PASS");
  if (smtpPass) {
    ensureNotPlaceholder("SMTP_PASS", smtpPass);
    updates.smtpPass = smtpPass;
  }

  const smtpFrom = readOptionalString("SMTP_FROM");
  if (smtpFrom) {
    ensureNotPlaceholder("SMTP_FROM", smtpFrom);
    updates.smtpFrom = smtpFrom;
  }

  const smtpSecure = readOptionalBool("SMTP_SECURE");
  if (smtpSecure !== undefined) updates.smtpSecure = smtpSecure;

  if (smtpHost && (!smtpUser || !smtpPass || !smtpFrom)) {
    throw new Error("SMTP incompleto: si defines SMTP_HOST debes definir SMTP_USER, SMTP_PASS y SMTP_FROM.");
  }

  if (Object.keys(updates).length === 0) {
    console.log("No se encontraron variables de configuracion para sincronizar.");
    return;
  }

  const result = await prisma.platformConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      ...updates
    },
    update: updates
  });

  console.log("Config sincronizada. Campos actualizados:", Object.keys(updates).join(", "));
  console.log("updatedAt:", result.updatedAt.toISOString());
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
