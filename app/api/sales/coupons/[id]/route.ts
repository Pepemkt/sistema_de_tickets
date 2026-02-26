import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { checkApiRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  maxUses: z.number().int().min(1).max(100000).optional(),
  expiresAt: z.string().datetime().nullable().optional()
});

export async function PATCH(request: Request, { params }: Params) {
  const auth = await checkApiRole(["ADMIN", "SELLER"]);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const data = patchSchema.parse(await request.json());

    const coupon = await db.coupon.findUnique({
      where: { id },
      select: { usedCount: true }
    });

    if (!coupon) {
      throw new Error("Cupon no encontrado");
    }

    const reservedUses = await db.order.count({
      where: {
        couponId: id,
        status: { in: [OrderStatus.PENDING, OrderStatus.PAID] }
      }
    });

    const minAllowedUses = Math.max(coupon.usedCount, reservedUses);
    if (data.maxUses !== undefined && data.maxUses < minAllowedUses) {
      throw new Error(`maxUses no puede ser menor a usos actuales (${minAllowedUses})`);
    }

    const updated = await db.coupon.update({
      where: { id },
      data: {
        isActive: data.isActive,
        maxUses: data.maxUses,
        expiresAt: data.expiresAt === undefined ? undefined : data.expiresAt ? new Date(data.expiresAt) : null
      },
      include: {
        event: {
          select: { id: true, name: true }
        },
        ticketType: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json({ coupon: updated });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo actualizar cupon"
      },
      { status: 400 }
    );
  }
}
