import { NextResponse } from "next/server";
import { z } from "zod";
import { checkApiRole } from "@/lib/api-auth";
import { normalizeCheckoutFeeItems } from "@/lib/checkout-fees";
import { getPlatformConfig, upsertCheckoutFeeItems } from "@/lib/platform-config";

export const runtime = "nodejs";

const feeItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(60),
  mode: z.enum(["FIXED", "PERCENT"]),
  value: z.number().min(0),
  enabled: z.boolean().optional().default(true)
});

const updateSchema = z.object({
  items: z.array(feeItemSchema).max(20)
});

export async function GET() {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const config = await getPlatformConfig();
  return NextResponse.json({
    items: normalizeCheckoutFeeItems(config?.checkoutFeeItems),
    updatedAt: config?.updatedAt ?? null
  });
}

export async function PUT(request: Request) {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const data = updateSchema.parse(await request.json());
    const normalizedItems = normalizeCheckoutFeeItems(data.items);
    const config = await upsertCheckoutFeeItems({ checkoutFeeItems: normalizedItems });
    return NextResponse.json({
      ok: true,
      items: normalizeCheckoutFeeItems(config.checkoutFeeItems),
      updatedAt: config.updatedAt
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron guardar los cargos de checkout" },
      { status: 400 }
    );
  }
}
