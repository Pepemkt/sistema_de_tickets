import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createMercadoPagoCheckout,
  isSerializationConflict
} from "@/lib/application/payments/create-mercadopago-checkout";

export const runtime = "nodejs";

const schema = z.object({
  eventId: z.string().min(1),
  ticketTypeId: z.string().min(1),
  quantity: z.number().int().min(1).max(100),
  buyerName: z.string().min(2),
  buyerEmail: z.string().email(),
  buyerPhone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value?.trim() ? value.trim() : undefined))
    .refine((value) => !value || (value.length >= 6 && value.length <= 30 && /^[0-9+().\-\s]+$/.test(value)), "Telefono invalido"),
  couponCode: z.string().trim().max(40).optional()
});

export async function POST(request: Request) {
  try {
    const data = schema.parse(await request.json());
    const checkout = await createMercadoPagoCheckout(data);

    return NextResponse.json({
      orderId: checkout.orderId,
      initPoint: checkout.initPoint,
      commercialMode: checkout.mode
    });
  } catch (error) {
    if (isSerializationConflict(error)) {
      return NextResponse.json({ error: "Conflicto de concurrencia. Reintenta la compra." }, { status: 409 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo crear la orden"
      },
      { status: 400 }
    );
  }
}
