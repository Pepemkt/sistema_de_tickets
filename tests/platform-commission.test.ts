import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  commissionBpsToPercent,
  commissionPercentToBps,
  normalizePlatformCommissionRateBps,
  DEFAULT_PLATFORM_COMMISSION_RATE_BPS,
  MAX_PLATFORM_COMMISSION_RATE_BPS
} from "../lib/platform-commission";

describe("platform-commission", () => {
  describe("normalizePlatformCommissionRateBps", () => {
    it("default for non-finite values", () => {
      assert.equal(normalizePlatformCommissionRateBps(undefined), DEFAULT_PLATFORM_COMMISSION_RATE_BPS);
      assert.equal(normalizePlatformCommissionRateBps(null), DEFAULT_PLATFORM_COMMISSION_RATE_BPS);
      assert.equal(normalizePlatformCommissionRateBps(Number.NaN), DEFAULT_PLATFORM_COMMISSION_RATE_BPS);
    });

    it("clamps negatives to 0", () => {
      assert.equal(normalizePlatformCommissionRateBps(-100), 0);
    });

    it("clamps values above the maximum", () => {
      assert.equal(normalizePlatformCommissionRateBps(15_000), MAX_PLATFORM_COMMISSION_RATE_BPS);
    });

    it("rounds fractional bps", () => {
      assert.equal(normalizePlatformCommissionRateBps(499.4), 499);
      assert.equal(normalizePlatformCommissionRateBps(499.5), 500);
    });
  });

  describe("commissionPercentToBps", () => {
    it("converts percent to basis points", () => {
      assert.equal(commissionPercentToBps(5), 500);
      assert.equal(commissionPercentToBps(12.5), 1_250);
    });

    it("falls back to default on invalid input", () => {
      assert.equal(commissionPercentToBps(null), DEFAULT_PLATFORM_COMMISSION_RATE_BPS);
      assert.equal(commissionPercentToBps(Number.POSITIVE_INFINITY), DEFAULT_PLATFORM_COMMISSION_RATE_BPS);
    });
  });

  describe("commissionBpsToPercent", () => {
    it("round-trips with commissionPercentToBps", () => {
      assert.equal(commissionBpsToPercent(commissionPercentToBps(5)), 5);
      assert.equal(commissionBpsToPercent(commissionPercentToBps(7.25)), 7.25);
    });

    it("applies normalization to the input", () => {
      assert.equal(commissionBpsToPercent(-500), 0);
      assert.equal(commissionBpsToPercent(20_000), MAX_PLATFORM_COMMISSION_RATE_BPS / 100);
    });
  });
});
