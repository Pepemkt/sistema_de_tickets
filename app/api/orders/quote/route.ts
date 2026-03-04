import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { validateOnlinePurchase } from "@/lib/order-rules";
import { resolveCheckoutFeeItems } from "@/lib/platform-config";
import { calculateCheckoutAmounts } from "@/lib/checkout-fees";

export const runtime = "nodejs";

const schema = z.object({
  eventId: z.string().min(1),
  ticketTypeId: z.string().min(1),
  quantity: z.number().int().min(1).max(100),
  buyerEmail: z.string().trim().max(120).optional(),
  couponCode: z.string().trim().max(40).optional()
});

export async function POST(request: Request) {
  try {
    const data = schema.parse(await request.json());
    const normalizedEmail = data.buyerEmail?.trim().toLowerCase();
    const buyerEmailForQuote = normalizedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ? normalizedEmail : undefined;

    const validated = await db.$transaction((tx) =>
      validateOnlinePurchase(tx, {
        eventId: data.eventId,
        ticketTypeId: data.ticketTypeId,
        quantity: data.quantity,
        buyerEmail: buyerEmailForQuote,
        couponCode: data.couponCode
      })
    );

    const feeItems = await resolveCheckoutFeeItems();
    const amounts = calculateCheckoutAmounts(validated.discountedSubtotalCents, feeItems);

    return NextResponse.json({
      subtotalCents: validated.baseSubtotalCents,
      discountCents: validated.discountCents,
      discountedSubtotalCents: validated.discountedSubtotalCents,
      appliedItems: amounts.appliedItems,
      feesTotalCents: amounts.feesTotalCents,
      totalCents: amounts.totalCents,
      couponApplied: Boolean(validated.coupon)
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo cotizar la compra"
      },
      { status: 400 }
    );
  }
}
