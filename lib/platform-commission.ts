export const DEFAULT_PLATFORM_COMMISSION_RATE_BPS = 500;
export const MAX_PLATFORM_COMMISSION_RATE_BPS = 10_000;

export function normalizePlatformCommissionRateBps(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_PLATFORM_COMMISSION_RATE_BPS;
  }

  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }

  if (rounded > MAX_PLATFORM_COMMISSION_RATE_BPS) {
    return MAX_PLATFORM_COMMISSION_RATE_BPS;
  }

  return rounded;
}

export function commissionPercentToBps(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_PLATFORM_COMMISSION_RATE_BPS;
  }

  return normalizePlatformCommissionRateBps(Math.round(value * 100));
}

export function commissionBpsToPercent(value?: number | null) {
  return normalizePlatformCommissionRateBps(value) / 100;
}
