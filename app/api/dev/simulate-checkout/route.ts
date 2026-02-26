import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkApiRole } from "@/lib/api-auth";
import { generateTicketsForPaidOrder } from "@/lib/tickets";
import { sendOrderTicketsEmail } from "@/lib/email";
import { validateOnlinePurchase } from "@/lib/order-rules";

export const runtime = "nodejs";

const schema = z.object({
  eventId: z.string().min(1),
  ticketTypeId: z.string().min(1),
  quantity: z.number().int().min(1).max(100),
  buyerName: z.string().min(2),
  buyerEmail: z.string().email(),
  couponCode: z.string().trim().max(40).optional(),
  sendEmail: z.boolean().optional().default(true)
});

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_SIMULATIONS !== "true") {
    return NextResponse.json({ error: "Simulaciones deshabilitadas" }, { status: 403 });
  }

  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const data = schema.parse(await request.json());

    const order = await db.$transaction(async (tx) => {
      const validated = await validateOnlinePurchase(tx, {
        eventId: data.eventId,
        ticketTypeId: data.ticketTypeId,
        quantity: data.quantity,
        buyerEmail: data.buyerEmail,
        couponCode: data.couponCode
      });

      if (validated.coupon) {
        const updatedCoupon = await tx.coupon.updateMany({
          where: {
            id: validated.coupon.id,
            isActive: true,
            usedCount: { lt: validated.coupon.maxUses }
          },
          data: {
            usedCount: { increment: 1 }
          }
        });

        if (updatedCoupon.count === 0) {
          throw new Error("El cupon alcanzo su limite de uso");
        }
      }

      return tx.order.create({
        data: {
          eventId: data.eventId,
          ticketTypeId: data.ticketTypeId,
          quantity: data.quantity,
          totalCents: validated.ticketType.priceCents * data.quantity,
          buyerName: data.buyerName,
          buyerEmail: validated.normalizedEmail,
          couponId: validated.coupon?.id ?? null
        }
      });
    });

    await generateTicketsForPaidOrder(order.id, `SIM-${randomUUID().slice(0, 8)}`);

    let emailSent = false;
    let emailError: string | null = null;

    if (data.sendEmail) {
      try {
        await sendOrderTicketsEmail(order.id);
        emailSent = true;
      } catch (error) {
        emailError = error instanceof Error ? error.message : "No se pudo enviar email";
      }
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      previewPath: `/admin/orders/${order.id}/preview`,
      emailSent,
      emailError
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo simular la compra"
      },
      { status: 400 }
    );
  }
}
