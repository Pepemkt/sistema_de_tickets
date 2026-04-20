import { after, afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildLiquidationForEvent } from "../lib/application/liquidations/build-liquidation";
import {
  cleanupAll,
  createTestClient,
  createTestEvent,
  createTestMerchantAccount,
  createTestOrder,
  disconnect,
  testDb
} from "./helpers";

describe("buildLiquidationForEvent", () => {
  afterEach(async () => {
    await cleanupAll();
  });

  after(async () => {
    await disconnect();
  });

  it("computes gross/commission/net at 5% for PAID DELEGATED orders and shares merchantAccountId", async () => {
    const clientId = await createTestClient("builder-happy");
    const merchantAccountId = await createTestMerchantAccount({ clientId });
    const { eventId, ticketTypeId } = await createTestEvent({ clientId, commissionRateBps: 500 });

    await createTestOrder({ eventId, ticketTypeId, totalCents: 10_000, clientId, merchantAccountId });
    await createTestOrder({ eventId, ticketTypeId, totalCents: 25_000, clientId, merchantAccountId });
    await createTestOrder({ eventId, ticketTypeId, totalCents: 7_777, clientId, merchantAccountId });

    const draft = await buildLiquidationForEvent(eventId);

    assert.equal(draft.clientId, clientId);
    assert.equal(draft.eventId, eventId);
    assert.equal(draft.commissionRateBpsSnapshot, 500);
    assert.equal(draft.grossCents, 42_777);
    assert.equal(draft.commissionCents, 500 + 1_250 + 389);
    assert.equal(draft.netCents, draft.grossCents - draft.commissionCents);
    assert.equal(draft.merchantAccountId, merchantAccountId);
    assert.equal(draft.items.length, 3);
    for (const item of draft.items) {
      assert.ok(item.paymentId, "expected approved payment to be linked");
      assert.equal(item.netCents, item.grossCents - item.commissionCents);
    }
  });

  it("excludes orders whose status is not PAID", async () => {
    const clientId = await createTestClient("builder-pending");
    const merchantAccountId = await createTestMerchantAccount({ clientId });
    const { eventId, ticketTypeId } = await createTestEvent({ clientId });

    await createTestOrder({ eventId, ticketTypeId, totalCents: 10_000, clientId, merchantAccountId });
    await createTestOrder({
      eventId,
      ticketTypeId,
      totalCents: 99_999,
      clientId,
      merchantAccountId,
      status: "PENDING",
      createApprovedPayment: false
    });
    await createTestOrder({
      eventId,
      ticketTypeId,
      totalCents: 99_999,
      clientId,
      merchantAccountId,
      status: "CANCELLED",
      createApprovedPayment: false
    });

    const draft = await buildLiquidationForEvent(eventId);

    assert.equal(draft.items.length, 1);
    assert.equal(draft.grossCents, 10_000);
  });

  it("excludes orders whose commercialModel is not DELEGATED", async () => {
    const clientId = await createTestClient("builder-global");
    const merchantAccountId = await createTestMerchantAccount({ clientId });
    const { eventId, ticketTypeId } = await createTestEvent({ clientId });

    await createTestOrder({ eventId, ticketTypeId, totalCents: 15_000, clientId, merchantAccountId });
    await createTestOrder({
      eventId,
      ticketTypeId,
      totalCents: 50_000,
      commercialModel: "GLOBAL",
      clientId: null,
      merchantAccountId: null
    });

    const draft = await buildLiquidationForEvent(eventId);

    assert.equal(draft.items.length, 1);
    assert.equal(draft.grossCents, 15_000);
  });

  it("excludes orders already present in existing liquidations (DRAFT/FINALIZED/SETTLED)", async () => {
    const clientId = await createTestClient("builder-existing");
    const merchantAccountId = await createTestMerchantAccount({ clientId });
    const { eventId, ticketTypeId } = await createTestEvent({ clientId });

    const alreadyInDraft = await createTestOrder({ eventId, ticketTypeId, totalCents: 10_000, clientId, merchantAccountId });
    const alreadyFinalized = await createTestOrder({ eventId, ticketTypeId, totalCents: 20_000, clientId, merchantAccountId });
    const alreadySettled = await createTestOrder({ eventId, ticketTypeId, totalCents: 30_000, clientId, merchantAccountId });
    await createTestOrder({ eventId, ticketTypeId, totalCents: 40_000, clientId, merchantAccountId });

    await testDb.liquidation.create({
      data: {
        eventId,
        clientId,
        merchantAccountId,
        status: "DRAFT",
        commissionRateBpsSnapshot: 500,
        grossCents: 10_000,
        commissionCents: 500,
        netCents: 9_500,
        items: { create: [{ orderId: alreadyInDraft, grossCents: 10_000, commissionCents: 500, netCents: 9_500 }] }
      }
    });

    await testDb.liquidation.create({
      data: {
        eventId,
        clientId,
        merchantAccountId,
        status: "FINALIZED",
        commissionRateBpsSnapshot: 500,
        grossCents: 20_000,
        commissionCents: 1_000,
        netCents: 19_000,
        items: { create: [{ orderId: alreadyFinalized, grossCents: 20_000, commissionCents: 1_000, netCents: 19_000 }] }
      }
    });

    await testDb.liquidation.create({
      data: {
        eventId,
        clientId,
        merchantAccountId,
        status: "SETTLED",
        commissionRateBpsSnapshot: 500,
        grossCents: 30_000,
        commissionCents: 1_500,
        netCents: 28_500,
        settledAt: new Date(),
        items: { create: [{ orderId: alreadySettled, grossCents: 30_000, commissionCents: 1_500, netCents: 28_500 }] }
      }
    });

    const draft = await buildLiquidationForEvent(eventId);

    assert.equal(draft.items.length, 1);
    assert.equal(draft.grossCents, 40_000);
    assert.equal(draft.commissionCents, 2_000);
    assert.equal(draft.netCents, 38_000);
  });

  it("re-includes orders whose previous liquidation was CANCELLED", async () => {
    const clientId = await createTestClient("builder-cancelled");
    const merchantAccountId = await createTestMerchantAccount({ clientId });
    const { eventId, ticketTypeId } = await createTestEvent({ clientId });

    const recycledOrder = await createTestOrder({ eventId, ticketTypeId, totalCents: 12_345, clientId, merchantAccountId });

    await testDb.liquidation.create({
      data: {
        eventId,
        clientId,
        merchantAccountId,
        status: "CANCELLED",
        commissionRateBpsSnapshot: 500,
        grossCents: 12_345,
        commissionCents: 617,
        netCents: 11_728,
        items: { create: [{ orderId: recycledOrder, grossCents: 12_345, commissionCents: 617, netCents: 11_728 }] }
      }
    });

    const draft = await buildLiquidationForEvent(eventId);

    assert.equal(draft.items.length, 1);
    assert.equal(draft.items[0]!.orderId, recycledOrder);
    assert.equal(draft.grossCents, 12_345);
  });

  it("uses event commission rate and ignores MerchantAccount.commissionRateBps", async () => {
    const clientId = await createTestClient("builder-rate-precedence");
    const merchantAccountId = await createTestMerchantAccount({ clientId, commissionRateBps: 1_500 });
    const { eventId, ticketTypeId } = await createTestEvent({ clientId, commissionRateBps: 300 });

    await createTestOrder({ eventId, ticketTypeId, totalCents: 100_000, clientId, merchantAccountId });

    const draft = await buildLiquidationForEvent(eventId);

    assert.equal(draft.commissionRateBpsSnapshot, 300);
    assert.equal(draft.commissionCents, 3_000);
  });

  it("throws when event has no client", async () => {
    const { eventId } = await createTestEvent({ clientId: null });

    await assert.rejects(() => buildLiquidationForEvent(eventId), /cliente delegado/);
  });
});
