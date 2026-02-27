export type CheckoutFeeItem = {
  id: string;
  name: string;
  mode: "FIXED" | "PERCENT";
  value: number;
  enabled: boolean;
};

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

export function normalizeCheckoutFeeItems(raw: unknown): CheckoutFeeItem[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const valueObj = item as Record<string, unknown>;
      const name = String(valueObj.name ?? "").trim();
      const mode = valueObj.mode === "PERCENT" ? "PERCENT" : valueObj.mode === "FIXED" ? "FIXED" : null;
      const value = Number(valueObj.value ?? 0);
      const enabled = valueObj.enabled !== false;
      if (!name || !mode || !Number.isFinite(value) || value < 0) return null;
      return {
        id: typeof valueObj.id === "string" && valueObj.id ? valueObj.id : randomId(),
        name,
        mode,
        value,
        enabled
      } satisfies CheckoutFeeItem;
    })
    .filter((item): item is CheckoutFeeItem => item !== null);
}

export function calculateCheckoutAmounts(subtotalCents: number, feeItems: CheckoutFeeItem[]) {
  const appliedItems = feeItems
    .filter((item) => item.enabled)
    .map((item) => {
      const amountCents = item.mode === "FIXED" ? Math.round(item.value * 100) : Math.round(subtotalCents * (item.value / 100));
      return {
        ...item,
        amountCents
      };
    });

  const feesTotalCents = appliedItems.reduce((sum, item) => sum + item.amountCents, 0);
  return {
    subtotalCents,
    feesTotalCents,
    totalCents: subtotalCents + feesTotalCents,
    appliedItems
  };
}
