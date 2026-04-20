import { MerchantAccountStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizePlatformCommissionRateBps } from "@/lib/platform-commission";
import { resolveGlobalMercadoPagoConfig } from "@/lib/platform-config";

type JsonObject = Record<string, unknown>;

export type MercadoPagoSnapshot = {
  mode: "GLOBAL" | "DELEGATED";
  clientId: string | null;
  merchantAccountId: string | null;
  commissionRateBps: number;
  provider: "MERCADOPAGO";
};

export type MercadoPagoContext = {
  mode: "GLOBAL" | "DELEGATED";
  clientId?: string;
  merchantAccountId?: string;
  accessToken: string;
  webhookSecret: string | null;
  commissionRateBps: number;
  configured: boolean;
  snapshot: MercadoPagoSnapshot;
};

type MerchantAccountRecord = {
  id: string;
  clientId: string;
  accessToken: string;
  webhookSecret: string | null;
  commissionRateBps: number;
};

function normalizeSecret(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function normalizeToken(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function parseSnapshot(snapshot: Prisma.JsonValue | null | undefined): Partial<MercadoPagoSnapshot> {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return {};
  }

  const value = snapshot as JsonObject;
  return {
    mode: value.mode === "DELEGATED" ? "DELEGATED" : value.mode === "GLOBAL" ? "GLOBAL" : undefined,
    clientId: typeof value.clientId === "string" ? value.clientId : null,
    merchantAccountId: typeof value.merchantAccountId === "string" ? value.merchantAccountId : null,
    commissionRateBps:
      typeof value.commissionRateBps === "number" ? normalizePlatformCommissionRateBps(value.commissionRateBps) : undefined,
    provider: value.provider === "MERCADOPAGO" ? "MERCADOPAGO" : undefined
  };
}

function buildSnapshot(input: {
  mode: "GLOBAL" | "DELEGATED";
  clientId?: string | null;
  merchantAccountId?: string | null;
  commissionRateBps?: number | null;
}): MercadoPagoSnapshot {
  return {
    mode: input.mode,
    clientId: input.clientId ?? null,
    merchantAccountId: input.merchantAccountId ?? null,
    commissionRateBps: normalizePlatformCommissionRateBps(input.commissionRateBps),
    provider: "MERCADOPAGO"
  };
}

async function buildGlobalContext(commissionRateBps?: number | null): Promise<MercadoPagoContext> {
  const globalConfig = await resolveGlobalMercadoPagoConfig();
  const snapshot = buildSnapshot({ mode: "GLOBAL", commissionRateBps });

  return {
    mode: "GLOBAL",
    accessToken: normalizeToken(globalConfig.accessToken),
    webhookSecret: normalizeSecret(globalConfig.webhookSecret),
    commissionRateBps: snapshot.commissionRateBps,
    configured: globalConfig.configured,
    snapshot
  };
}

function buildDelegatedContext(account: MerchantAccountRecord, commissionRateBps?: number | null): MercadoPagoContext {
  const snapshot = buildSnapshot({
    mode: "DELEGATED",
    clientId: account.clientId,
    merchantAccountId: account.id,
    commissionRateBps: commissionRateBps ?? account.commissionRateBps
  });

  const accessToken = normalizeToken(account.accessToken);

  return {
    mode: "DELEGATED",
    clientId: account.clientId,
    merchantAccountId: account.id,
    accessToken,
    webhookSecret: normalizeSecret(account.webhookSecret),
    commissionRateBps: snapshot.commissionRateBps,
    configured: Boolean(accessToken),
    snapshot
  };
}

export async function resolveMercadoPagoContextForEvent(eventId: string): Promise<MercadoPagoContext> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      clientId: true,
      platformCommissionRateBps: true,
      client: {
        select: {
          merchantAccounts: {
            where: { provider: "MERCADOPAGO", status: MerchantAccountStatus.ACTIVE },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: {
              id: true,
              clientId: true,
              accessToken: true,
              webhookSecret: true,
              commissionRateBps: true
            }
          }
        }
      }
    }
  });

  if (!event) {
    throw new Error("Evento no encontrado");
  }

  const account = event.client?.merchantAccounts[0];
  if (event.clientId && account) {
    return buildDelegatedContext(account, event.platformCommissionRateBps);
  }

  return buildGlobalContext(event.platformCommissionRateBps);
}

export async function resolveMercadoPagoContextForOrder(orderId: string): Promise<MercadoPagoContext> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      clientId: true,
      merchantAccountId: true,
      commercialModel: true,
      platformCommissionRateBps: true,
      merchantSnapshot: true,
      merchantAccount: {
        select: {
          id: true,
          clientId: true,
          accessToken: true,
          webhookSecret: true,
          commissionRateBps: true,
          status: true
        }
      },
      event: {
        select: {
          id: true,
          clientId: true,
          platformCommissionRateBps: true,
          client: {
            select: {
              merchantAccounts: {
                where: { provider: "MERCADOPAGO", status: MerchantAccountStatus.ACTIVE },
                orderBy: { createdAt: "asc" },
                take: 1,
                select: {
                  id: true,
                  clientId: true,
                  accessToken: true,
                  webhookSecret: true,
                  commissionRateBps: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!order) {
    throw new Error("Orden no encontrada");
  }

  const parsedSnapshot = parseSnapshot(order.merchantSnapshot);

  if (order.merchantAccount && order.merchantAccount.status === MerchantAccountStatus.ACTIVE) {
    return buildDelegatedContext(order.merchantAccount, parsedSnapshot.commissionRateBps ?? order.platformCommissionRateBps);
  }

  const fallbackAccount = order.event.client?.merchantAccounts[0];
  if (order.clientId && fallbackAccount) {
    return buildDelegatedContext(fallbackAccount, parsedSnapshot.commissionRateBps ?? order.platformCommissionRateBps);
  }

  return buildGlobalContext(parsedSnapshot.commissionRateBps ?? order.platformCommissionRateBps);
}

export async function listMercadoPagoContextCandidates(orderIdHint?: string) {
  const candidates: MercadoPagoContext[] = [];

  if (orderIdHint) {
    try {
      candidates.push(await resolveMercadoPagoContextForOrder(orderIdHint));
    } catch {
      // Ignore missing hints and continue with broader lookup.
    }
  }

  const accounts = await db.merchantAccount.findMany({
    where: { provider: "MERCADOPAGO", status: MerchantAccountStatus.ACTIVE },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      clientId: true,
      accessToken: true,
      webhookSecret: true,
      commissionRateBps: true
    }
  });

  for (const account of accounts) {
    candidates.push(buildDelegatedContext(account));
  }

  candidates.push(await buildGlobalContext());

  const deduped = new Map<string, MercadoPagoContext>();
  for (const candidate of candidates) {
    const key = `${candidate.mode}:${candidate.merchantAccountId ?? "global"}:${candidate.accessToken}`;
    if (!deduped.has(key)) {
      deduped.set(key, candidate);
    }
  }

  return Array.from(deduped.values()).filter((candidate) => candidate.configured);
}

export async function listMercadoPagoWebhookSecretCandidates() {
  const contexts = await listMercadoPagoContextCandidates();
  return Array.from(new Set(contexts.map((context) => context.webhookSecret).filter((value): value is string => Boolean(value))));
}

export function serializeMercadoPagoSnapshot(snapshot: MercadoPagoSnapshot): Prisma.InputJsonValue {
  return snapshot as Prisma.InputJsonValue;
}
