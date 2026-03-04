import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { checkApiRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { requireViewerEventAccess } from "@/lib/event-scope";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  maxUses: z.number().int().min(1).max(100000).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  discountType: z.enum(["FIXED_PRICE", "FIXED_DISCOUNT", "PERCENT"]).optional(),
  discountValue: z.number().int().min(0).max(100000000).optional()
});

export async function PATCH(request: Request, { params }: Params) {
  const auth = await checkApiRole(["ADMIN", "MANAGER", "SELLER"]);
  if (auth.response) return auth.response;
  const viewer = auth.viewer!;

  try {
    const { id } = await params;
    const data = patchSchema.parse(await request.json());
    if (data.discountType !== undefined && data.discountValue === undefined) {
      throw new Error("Debes indicar un valor para el tipo de descuento");
    }

    const coupon = await db.coupon.findUnique({
      where: { id },
      select: { usedCount: true, eventId: true, discountType: true }
    });

    if (!coupon) {
      throw new Error("Cupon no encontrado");
    }

    await requireViewerEventAccess(viewer, coupon.eventId);

    const resolvedDiscountType = data.discountType ?? coupon.discountType;
    if (data.discountValue !== undefined && !resolvedDiscountType) {
      throw new Error("Debes definir un tipo de descuento para actualizar el valor");
    }

    if (resolvedDiscountType === "PERCENT" && data.discountValue !== undefined && (data.discountValue < 1 || data.discountValue > 100)) {
      throw new Error("El descuento porcentual debe estar entre 1 y 100");
    }

    if (resolvedDiscountType === "FIXED_DISCOUNT" && data.discountValue !== undefined && data.discountValue < 1) {
      throw new Error("El descuento fijo debe ser mayor a 0");
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
        expiresAt: data.expiresAt === undefined ? undefined : data.expiresAt ? new Date(data.expiresAt) : null,
        discountType: data.discountType ?? undefined,
        discountValue: data.discountValue
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
