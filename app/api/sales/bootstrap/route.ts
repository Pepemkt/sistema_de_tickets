import { NextResponse } from "next/server";
import { checkApiRole } from "@/lib/api-auth";
import { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const auth = await checkApiRole(["ADMIN", "SELLER"]);
  if (auth.response) return auth.response;

  const [events, coupons] = await Promise.all([
    db.event.findMany({
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

