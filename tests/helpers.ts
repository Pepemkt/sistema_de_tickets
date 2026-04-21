import { PrismaClient } from "@prisma/client";

export const testDb = new PrismaClient();

const createdIds = {
  events: new Set<string>(),
  clients: new Set<string>(),
  ticketTypes: new Set<string>()
};

export function trackEvent(id: string) {
  createdIds.events.add(id);
}

export function trackClient(id: string) {
  createdIds.clients.add(id);
}

export function trackTicketType(id: string) {
  createdIds.ticketTypes.add(id);
}

export async function cleanupAll() {
  const eventIds = Array.from(createdIds.events);
  const clientIds = Array.from(createdIds.clients);

  if (eventIds.length > 0) {
    await testDb.liquidationItem.deleteMany({ where: { liquidation: { eventId: { in: eventIds } } } });
    await testDb.liquidation.deleteMany({ where: { eventId: { in: eventIds } } });
    await testDb.payment.deleteMany({ where: { order: { eventId: { in: eventIds } } } });
    await testDb.ticket.deleteMany({ where: { eventId: { in: eventIds } } });
    await testDb.emailDeliveryLog.deleteMany({ where: { eventId: { in: eventIds } } });
    await testDb.order.deleteMany({ where: { eventId: { in: eventIds } } });
    await testDb.ticketType.deleteMany({ where: { eventId: { in: eventIds } } });
    await testDb.eventManagerScope.deleteMany({ where: { eventId: { in: eventIds } } });
    await testDb.event.deleteMany({ where: { id: { in: eventIds } } });
  }

  if (clientIds.length > 0) {
    await testDb.merchantAccount.deleteMany({ where: { clientId: { in: clientIds } } });
    await (testDb as unknown as {
      client: { deleteMany(args: { where: { id: { in: string[] } } }): Promise<unknown> };
    }).client.deleteMany({ where: { id: { in: clientIds } } });
  }

  createdIds.events.clear();
  createdIds.clients.clear();
  createdIds.ticketTypes.clear();
}

export async function disconnect() {
  await testDb.$disconnect();
}

type ClientWriter = {
  client: { create(args: { data: { name: string }; select: { id: true } }): Promise<{ id: string }> };
};

export async function createTestClient(name: string) {
  const writer = testDb as unknown as ClientWriter;
  const client = await writer.client.create({ data: { name: `test-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }, select: { id: true } });
  trackClient(client.id);
  return client.id;
}

export async function createTestEvent(options: { clientId?: string | null; commissionRateBps?: number } = {}) {
  const rawId = Math.random().toString(36).slice(2, 8);
  const event = await testDb.event.create({
    data: {
      slug: `test-event-${Date.now()}-${rawId}`,
      name: `Test Event ${rawId}`,
      venue: "Test Venue",
      startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      platformCommissionRateBps: options.commissionRateBps ?? 500,
      clientId: options.clientId ?? null,
      ticketTypes: {
        create: [{ name: "General", priceCents: 10_000, stock: 1_000 }]
      }
    },
    select: {
      id: true,
      ticketTypes: { select: { id: true }, take: 1 }
    }
  });

  trackEvent(event.id);
  const ticketTypeId = event.ticketTypes[0]!.id;
  trackTicketType(ticketTypeId);
  return { eventId: event.id, ticketTypeId };
}

type OrderOptions = {
  eventId: string;
  ticketTypeId: string;
  totalCents: number;
  status?: "PENDING" | "PAID" | "CANCELLED";
  commercialModel?: "GLOBAL" | "DELEGATED";
  clientId?: string | null;
  merchantAccountId?: string | null;
  createApprovedPayment?: boolean;
};

export async function createTestOrder(options: OrderOptions) {
  const order = await testDb.order.create({
    data: {
      eventId: options.eventId,
      ticketTypeId: options.ticketTypeId,
      quantity: 1,
      totalCents: options.totalCents,
      subtotalCents: options.totalCents,
      buyerName: "Test Buyer",
      buyerEmail: `buyer-${Math.random().toString(36).slice(2, 6)}@test.com`,
      status: options.status ?? "PAID",
      commercialModel: options.commercialModel ?? "DELEGATED",
      clientId: options.clientId ?? null,
      merchantAccountId: options.merchantAccountId ?? null
    },
    select: { id: true }
  });

  if (options.createApprovedPayment !== false) {
    await testDb.payment.create({
      data: {
        orderId: order.id,
        provider: "MERCADOPAGO",
        providerPaymentId: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: "approved",
        source: "WEBHOOK",
        approvedAt: new Date()
      }
    });
  }

  return order.id;
}

type MerchantOptions = {
  clientId: string;
  status?: "ACTIVE" | "DISABLED";
  accessToken?: string;
  webhookSecret?: string | null;
  commissionRateBps?: number;
};

export async function createTestMerchantAccount(options: MerchantOptions) {
  const merchant = await testDb.merchantAccount.create({
    data: {
      clientId: options.clientId,
      provider: "MERCADOPAGO",
      accessToken: options.accessToken ?? `test-access-${Math.random().toString(36).slice(2, 8)}`,
      webhookSecret: options.webhookSecret ?? null,
      status: options.status ?? "ACTIVE",
      commissionRateBps: options.commissionRateBps ?? 500
    },
    select: { id: true }
  });
  return merchant.id;
}
