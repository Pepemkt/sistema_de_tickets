import { NextResponse } from "next/server";
import { checkApiRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

type Params = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;

    const result = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        select: {
          id: true,
          couponId: true
        }
      });

      if (!order) {
        return null;
      }

      const attendedCount = await tx.ticket.count({
        where: {
          orderId: order.id,
          attendedAt: { not: null }
        }
      });

      if (attendedCount > 0) {
        throw new Error("No se puede eliminar una orden con tickets ya validados en acceso");
      }

      const deletedTickets = await tx.ticket.deleteMany({
        where: { orderId: order.id }
      });

      await tx.order.delete({
        where: { id: order.id }
      });

      if (order.couponId) {
        await tx.coupon.updateMany({
          where: {
            id: order.couponId,
            usedCount: { gt: 0 }
          },
          data: {
            usedCount: { decrement: 1 }
          }
        });
      }

      return {
        orderId: order.id,
        deletedTickets: deletedTickets.count
      };
    });

    if (!result) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo eliminar la orden"
      },
      { status: 400 }
    );
  }
}
