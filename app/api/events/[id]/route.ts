import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkApiRole } from "@/lib/api-auth";

type Params = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";

const updateTicketTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  price: z.number().min(0),
  stock: z.number().int().positive(),
  saleMode: z.enum(["PUBLIC", "COUPON_ONLY", "HIDDEN"]).optional().default("PUBLIC"),
  maxPerOrder: z.number().int().min(1).max(100).nullable().optional(),
  maxPerEmail: z.number().int().min(1).max(1000).nullable().optional()
});

const updateSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional().default(""),
  venue: z.string().min(2),
  startsAt: z.string().min(10),
  endsAt: z.string().optional(),
  ticketTypes: z.array(updateTicketTypeSchema).min(1)
});

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;

  const event = await db.event.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      venue: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      updatedAt: true,
      ticketTypes: {
        orderBy: { priceCents: "asc" },
        select: {
          id: true,
          name: true,
          priceCents: true,
          stock: true,
          saleMode: true,
          maxPerOrder: true,
          maxPerEmail: true,
          createdAt: true,
          updatedAt: true
        }
      }
    }
  });

  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  return NextResponse.json(event);
}

export async function PUT(request: Request, { params }: Params) {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const data = updateSchema.parse(await request.json());

    const startsAt = new Date(data.startsAt);
    const endsAt = data.endsAt ? new Date(data.endsAt) : null;

    if (Number.isNaN(startsAt.getTime())) {
      throw new Error("Fecha de inicio invalida");
    }

    if (endsAt && Number.isNaN(endsAt.getTime())) {
      throw new Error("Fecha de cierre invalida");
    }

    if (data.ticketTypes.some((item) => item.maxPerOrder && item.maxPerEmail && item.maxPerOrder > item.maxPerEmail)) {
      throw new Error("maxPerOrder no puede ser mayor a maxPerEmail");
    }

    const event = await db.$transaction(async (tx) => {
      const existingEvent = await tx.event.findUnique({
        where: { id },
        include: {
          ticketTypes: {
            include: {
              _count: {
                select: { tickets: true }
              }
            }
          }
        }
      });

      if (!existingEvent) {
        throw new Error("Evento no encontrado");
      }

      const existingMap = new Map(existingEvent.ticketTypes.map((item) => [item.id, item]));
      const incomingIds = new Set(data.ticketTypes.filter((item) => item.id).map((item) => item.id as string));

      for (const current of existingEvent.ticketTypes) {
        if (!incomingIds.has(current.id)) {
          if (current._count.tickets > 0) {
            throw new Error(`No se puede eliminar ${current.name} porque ya tiene ventas`);
          }
          await tx.ticketType.delete({ where: { id: current.id } });
        }
      }

      for (const type of data.ticketTypes) {
        if (type.id && existingMap.has(type.id)) {
          const sold = existingMap.get(type.id)!._count.tickets;
          if (type.stock < sold) {
            throw new Error(`El stock de ${type.name} no puede ser menor a ${sold} (vendidas)`);
          }

          await tx.ticketType.update({
            where: { id: type.id },
            data: {
              name: type.name,
              priceCents: Math.round(type.price * 100),
              stock: type.stock,
              saleMode: type.saleMode ?? "PUBLIC",
              maxPerOrder: type.maxPerOrder ?? null,
              maxPerEmail: type.maxPerEmail ?? null
            }
          });
        } else {
          await tx.ticketType.create({
            data: {
              eventId: existingEvent.id,
              name: type.name,
              priceCents: Math.round(type.price * 100),
              stock: type.stock,
              saleMode: type.saleMode ?? "PUBLIC",
              maxPerOrder: type.maxPerOrder ?? null,
              maxPerEmail: type.maxPerEmail ?? null
            }
          });
        }
      }

      return tx.event.update({
        where: { id: existingEvent.id },
        data: {
          name: data.name,
          description: data.description,
          venue: data.venue,
          startsAt,
          endsAt
        },
        include: {
          ticketTypes: {
            orderBy: { priceCents: "asc" },
            include: {
              _count: {
                select: { tickets: true }
              }
            }
          }
        }
      });
    });

    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo actualizar evento"
      },
      { status: 400 }
    );
  }
}
