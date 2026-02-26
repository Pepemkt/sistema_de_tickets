import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { checkApiRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const createSchema = z.object({
  code: z.string().trim().min(4).max(40).regex(/^[A-Za-z0-9_-]+$/, "El codigo solo puede tener letras, numeros, _ o -"),
  eventId: z.string().min(1),
  ticketTypeId: z.string().optional().nullable(),
  maxUses: z.number().int().min(1).max(100000),
  expiresAt: z.string().datetime().optional().nullable()
});

export async function GET() {
  const auth = await checkApiRole(["ADMIN", "SELLER"]);
  if (auth.response) return auth.response;

  const coupons = await db.coupon.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      event: {
        select: { id: true, name: true }
      },
      ticketType: {
        select: { id: true, name: true }
      }
    }
  });

  return NextResponse.json({ coupons });
}

export async function POST(request: Request) {
  const auth = await checkApiRole(["ADMIN", "SELLER"]);
  if (auth.response) return auth.response;

  try {
    const data = createSchema.parse(await request.json());

    const code = data.code.trim().toUpperCase();
    const event = await db.event.findUnique({
      where: { id: data.eventId },
      select: { id: true }
    });

    if (!event) {
      throw new Error("Evento no encontrado");
    }

    if (data.ticketTypeId) {
      const ticketType = await db.ticketType.findUnique({
        where: { id: data.ticketTypeId },
        select: { eventId: true }
      });

      if (!ticketType || ticketType.eventId !== data.eventId) {
        throw new Error("Tipo de entrada invalido para el evento");
      }
    }

    const coupon = await db.coupon.create({
      data: {
        code,
        eventId: data.eventId,
        ticketTypeId: data.ticketTypeId ?? null,
        maxUses: data.maxUses,
        usedCount: 0,
        isActive: true,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null
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

    return NextResponse.json({ coupon }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un cupon con ese codigo" }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo crear cupon"
      },
      { status: 400 }
    );
  }
}
