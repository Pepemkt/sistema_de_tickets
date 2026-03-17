import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { checkApiRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getScopedEventIdsForViewer } from "@/lib/event-scope";
import { ORDER_KIND } from "@/lib/order-kind";

export const runtime = "nodejs";

export async function GET() {
  const auth = await checkApiRole(["ADMIN", "MANAGER", "SELLER"]);
  if (auth.response) return auth.response;
  const viewer = auth.viewer!;
  const scopedEventIds = await getScopedEventIdsForViewer(viewer);

  const [events, coupons, invitations] = await Promise.all([
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
    }),
    db.order.findMany({
      where: {
        ...(scopedEventIds ? { eventId: { in: scopedEventIds } } : {}),
        kind: ORDER_KIND.INVITATION
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        buyerName: true,
        createdAt: true,
        quantity: true,
        event: {
          select: {
            name: true
          }
        },
        ticketType: {
          select: {
            name: true
          }
        },
        tickets: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            code: true,
            attendeeName: true,
            attendeeEmail: true
          }
        },
        emailDeliveries: {
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            recipientEmail: true,
            status: true,
            errorMessage: true,
            createdAt: true
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
    })),
    invitations: invitations.map((invitation) => {
      const latestDeliveryByEmail = new Map<string, (typeof invitation.emailDeliveries)[number]>();

      for (const delivery of invitation.emailDeliveries) {
        if (!latestDeliveryByEmail.has(delivery.recipientEmail)) {
          latestDeliveryByEmail.set(delivery.recipientEmail, delivery);
        }
      }

      return {
        orderId: invitation.id,
        issuedBy: invitation.buyerName,
        createdAt: invitation.createdAt,
        quantity: invitation.quantity,
        eventName: invitation.event.name,
        ticketTypeName: invitation.ticketType.name,
        tickets: invitation.tickets.map((ticket) => {
          const delivery = latestDeliveryByEmail.get(ticket.attendeeEmail);

          return {
            ...ticket,
            downloadUrl: `/api/admin/orders/${encodeURIComponent(invitation.id)}/ticket/${encodeURIComponent(ticket.id)}/pdf`,
            emailStatus: delivery?.status ?? null,
            emailError: delivery?.errorMessage ?? null,
            emailedAt: delivery?.createdAt ?? null
          };
        })
      };
    })
  });
}
