import { after, afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveMercadoPagoContextForEvent } from "../lib/application/payments/resolve-mercadopago-context";
import {
  cleanupAll,
  createTestClient,
  createTestEvent,
  createTestMerchantAccount,
  disconnect
} from "./helpers";

describe("resolveMercadoPagoContextForEvent", () => {
  afterEach(async () => {
    await cleanupAll();
  });

  after(async () => {
    await disconnect();
  });

  it("returns DELEGATED context when event has client with an active merchant account", async () => {
    const clientId = await createTestClient("ctx-delegated");
    const merchantAccountId = await createTestMerchantAccount({
      clientId,
      accessToken: "delegated-access-token",
      webhookSecret: "delegated-secret",
      commissionRateBps: 700
    });
    const { eventId } = await createTestEvent({ clientId, commissionRateBps: 700 });

    const context = await resolveMercadoPagoContextForEvent(eventId);

    assert.equal(context.mode, "DELEGATED");
    assert.equal(context.clientId, clientId);
    assert.equal(context.merchantAccountId, merchantAccountId);
    assert.equal(context.accessToken, "delegated-access-token");
    assert.equal(context.webhookSecret, "delegated-secret");
    assert.equal(context.commissionRateBps, 700);
    assert.equal(context.configured, true);
    assert.equal(context.snapshot.mode, "DELEGATED");
    assert.equal(context.snapshot.merchantAccountId, merchantAccountId);
  });

  it("falls back to GLOBAL context when event has no client", async () => {
    const { eventId } = await createTestEvent({ clientId: null });

    const context = await resolveMercadoPagoContextForEvent(eventId);

    assert.equal(context.mode, "GLOBAL");
    assert.equal(context.clientId, undefined);
    assert.equal(context.merchantAccountId, undefined);
    assert.equal(context.snapshot.mode, "GLOBAL");
    assert.equal(context.snapshot.clientId, null);
    assert.equal(context.snapshot.merchantAccountId, null);
  });

  it("falls back to GLOBAL context when client has no ACTIVE merchant account", async () => {
    const clientId = await createTestClient("ctx-disabled");
    await createTestMerchantAccount({ clientId, status: "DISABLED" });
    const { eventId } = await createTestEvent({ clientId });

    const context = await resolveMercadoPagoContextForEvent(eventId);

    assert.equal(context.mode, "GLOBAL");
    assert.equal(context.merchantAccountId, undefined);
  });

  it("throws when the event does not exist", async () => {
    await assert.rejects(() => resolveMercadoPagoContextForEvent("evt-missing-id"), /Evento no encontrado/);
  });
});
