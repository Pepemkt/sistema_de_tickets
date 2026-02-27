import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkApiRole } from "@/lib/api-auth";
import { hashPassword } from "@/lib/password";
import { defaultTicketTemplate } from "@/lib/ticket-template";

export const runtime = "nodejs";

export async function POST() {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;
  const createDemoUsers = process.env.SEED_CREATE_DEMO_USERS === "true";

  const event = await db.event.create({
    data: {
      slug: `demo-${Date.now()}`,
      name: "Festival Demo",
      description: "Evento de prueba para validar flujo de compra y tickets",
      venue: "Buenos Aires",
      startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
      templateJson: defaultTicketTemplate,
      ticketTypes: {
        create: [
          {
            name: "General",
            priceCents: 18000,
            stock: 500
          },
          {
            name: "VIP",
            priceCents: 45000,
            stock: 150
          }
        ]
      }
    },
    include: { ticketTypes: true }
  });

  if (createDemoUsers) {
    await db.user.upsert({
      where: { username: "seller" },
      create: {
        username: "seller",
        displayName: "Ventas",
        passwordHash: await hashPassword("seller1234"),
        role: "SELLER"
      },
      update: {}
    });

    await db.user.upsert({
      where: { username: "scanner" },
      create: {
        username: "scanner",
        displayName: "Check-in",
        passwordHash: await hashPassword("scanner1234"),
        role: "SCANNER"
      },
      update: {}
    });
  }

  return NextResponse.json({ event, demoUsersCreated: createDemoUsers }, { status: 201 });
}
