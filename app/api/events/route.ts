import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkApiRole } from "@/lib/api-auth";
import { defaultTicketTemplate } from "@/lib/ticket-template";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";

const ticketTypeSchema = z.object({
  name: z.string().min(2),
  price: z.number().min(0),
  stock: z.number().int().positive(),
  saleMode: z.enum(["PUBLIC", "COUPON_ONLY", "HIDDEN"]).optional().default("PUBLIC"),
  maxPerOrder: z.number().int().min(1).max(100).nullable().optional(),
  maxPerEmail: z.number().int().min(1).max(1000).nullable().optional()
});

const createSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional().default(""),
  venue: z.string().min(2),
  startsAt: z.string().min(10),
  endsAt: z.string().optional(),
  ticketTypes: z.array(ticketTypeSchema).min(1).optional(),
  ticketName: z.string().optional(),
  ticketPrice: z.number().optional(),
  stock: z.number().int().optional()
});

export async function GET() {
  const events = await db.event.findMany({
    include: {
      ticketTypes: {
        orderBy: { priceCents: "asc" }
      }
    },
    orderBy: { startsAt: "asc" }
  });

  return NextResponse.json(events);
}

export async function POST(request: Request) {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const data = createSchema.parse(await request.json());

    const startsAt = new Date(data.startsAt);
    const endsAt = data.endsAt ? new Date(data.endsAt) : null;

    if (Number.isNaN(startsAt.getTime())) {
      throw new Error("Fecha de inicio invalida");
    }

    if (endsAt && Number.isNaN(endsAt.getTime())) {
      throw new Error("Fecha de cierre invalida");
    }

    const ticketTypes: Array<z.infer<typeof ticketTypeSchema>> =
      data.ticketTypes && data.ticketTypes.length > 0
        ? data.ticketTypes
        : [
            {
              name: data.ticketName ?? "General",
              price: data.ticketPrice ?? 0,
              stock: data.stock ?? 100,
              saleMode: "PUBLIC",
              maxPerOrder: null,
              maxPerEmail: null
            }
          ];

    if (ticketTypes.some((item) => item.price < 0 || item.stock <= 0)) {
      throw new Error("Cada tipo de entrada debe tener stock valido y precio mayor o igual a 0");
    }

    if (ticketTypes.some((item) => item.maxPerOrder && item.maxPerEmail && item.maxPerOrder > item.maxPerEmail)) {
      throw new Error("maxPerOrder no puede ser mayor a maxPerEmail");
    }

    const slug = `${slugify(data.name)}-${Math.random().toString(36).slice(2, 7)}`;

    const event = await db.event.create({
      data: {
        slug,
        name: data.name,
        description: data.description,
        venue: data.venue,
        startsAt,
        endsAt,
        templateJson: defaultTicketTemplate,
        ticketTypes: {
          create: ticketTypes.map((item) => ({
            name: item.name,
            priceCents: Math.round(item.price * 100),
            stock: item.stock,
            saleMode: item.saleMode ?? "PUBLIC",
            maxPerOrder: item.maxPerOrder ?? null,
            maxPerEmail: item.maxPerEmail ?? null
          }))
        }
      },
      include: { ticketTypes: true }
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error creando evento"
      },
      { status: 400 }
    );
  }
}
