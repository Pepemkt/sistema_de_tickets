import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function readOptionalString(name: string) {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  return value;
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

  const mercadoPagoAccessToken = readOptionalString("MERCADOPAGO_ACCESS_TOKEN");
  if (mercadoPagoAccessToken) updates.mercadoPagoAccessToken = mercadoPagoAccessToken;

  const mercadoPagoWebhookSecret = readOptionalString("MERCADOPAGO_WEBHOOK_SECRET");
  if (mercadoPagoWebhookSecret) updates.mercadoPagoWebhookSecret = mercadoPagoWebhookSecret;

  const smtpHost = readOptionalString("SMTP_HOST");
  if (smtpHost) updates.smtpHost = smtpHost;

  const smtpPort = readOptionalInt("SMTP_PORT");
  if (smtpPort !== undefined) updates.smtpPort = smtpPort;

  const smtpUser = readOptionalString("SMTP_USER");
  if (smtpUser) updates.smtpUser = smtpUser;

  const smtpPass = readOptionalString("SMTP_PASS");
  if (smtpPass) updates.smtpPass = smtpPass;

  const smtpFrom = readOptionalString("SMTP_FROM");
  if (smtpFrom) updates.smtpFrom = smtpFrom;

  const smtpSecure = readOptionalBool("SMTP_SECURE");
  if (smtpSecure !== undefined) updates.smtpSecure = smtpSecure;

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
