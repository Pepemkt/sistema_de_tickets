import { NextResponse } from "next/server";
import { checkApiRole } from "@/lib/api-auth";
import { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getScopedEventIdsForViewer } from "@/lib/event-scope";

export const runtime = "nodejs";

export async function GET() {
  const auth = await checkApiRole(["ADMIN", "MANAGER", "SELLER"]);
  if (auth.response) return auth.response;
  const viewer = auth.viewer!;
  const scopedEventIds = await getScopedEventIdsForViewer(viewer);

  const [events, coupons] = await Promise.all([
    db.event.findMany({
      where: scopedEventIds ? { id: { in: scopedEventIds } } : undefined,
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        name: true,
        startsAt: true,
        venue: true,
        ticketTypes: {
          orderBy: { priceCents: "asc" },
          select: {
            id: true,
            name: true,
            priceCents: true,
            stock: true,
            saleMode: true,
            maxPerOrder: true,
            maxPerEmail: true
          }
        }
      }
    }),
    db.coupon.findMany({
      where: scopedEventIds ? { eventId: { in: scopedEventIds } } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        code: true,
        eventId: true,
        ticketTypeId: true,
        maxUses: true,
        usedCount: true,
        isActive: true,
        expiresAt: true,
        discountType: true,
        discountValue: true,
        createdAt: true,
        event: {
          select: {
            name: true
          }
        },
        ticketType: {
          select: {
            name: true
          }
        }
      }
    })
  ]);

  const couponUsage = await db.order.groupBy({
    by: ["couponId"],
    where: {
      ...(scopedEventIds ? { eventId: { in: scopedEventIds } } : {}),
      couponId: { not: null },
      status: { in: [OrderStatus.PENDING, OrderStatus.PAID] }
    },
    _count: { _all: true }
  });

  const usageMap = new Map(couponUsage.map((item) => [item.couponId ?? "", item._count._all]));

  return NextResponse.json({
    events,
    coupons: coupons.map((coupon) => ({
      ...coupon,
      reservedUses: usageMap.get(coupon.id) ?? coupon.usedCount
    }))
  });
}
