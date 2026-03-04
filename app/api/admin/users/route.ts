import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkApiRole } from "@/lib/api-auth";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";

function roleSupportsEventAssignments(role: "ADMIN" | "MANAGER" | "SELLER" | "SCANNER") {
  return role === "MANAGER" || role === "SELLER" || role === "SCANNER";
}

const createSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/),
  displayName: z.string().max(60).optional(),
  password: z.string().min(6).max(100),
  role: z.enum(["ADMIN", "MANAGER", "SELLER", "SCANNER"]),
  managedEventIds: z.array(z.string().min(1)).optional().default([])
});

export async function GET() {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const [users, events] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { sessions: true }
        },
        managedEventRefs: {
          select: {
            eventId: true
          }
        }
      }
    }),
    db.event.findMany({
      orderBy: [{ startsAt: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        startsAt: true
      }
    })
  ]);

  return NextResponse.json({
    users: users.map((user) => ({
      ...user,
      managedEventIds: user.managedEventRefs.map((item) => item.eventId)
    })),
    events
  });
}

export async function POST(request: Request) {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const data = createSchema.parse(await request.json());
    const managedEventIds = Array.from(new Set(data.managedEventIds));

    if (managedEventIds.length > 0 && !roleSupportsEventAssignments(data.role)) {
      throw new Error("Solo MANAGER, SELLER o SCANNER pueden tener eventos asignados");
    }

    if (managedEventIds.length > 0) {
      const existingEvents = await db.event.count({
        where: { id: { in: managedEventIds } }
      });

      if (existingEvents !== managedEventIds.length) {
        throw new Error("Hay eventos asignados que no existen");
      }
    }

    const user = await db.user.create({
      data: {
        username: data.username.toLowerCase(),
        displayName: data.displayName || null,
        passwordHash: await hashPassword(data.password),
        role: data.role,
        managedEventRefs:
          roleSupportsEventAssignments(data.role) && managedEventIds.length > 0
            ? {
                create: managedEventIds.map((eventId) => ({
                  eventId
                }))
              }
            : undefined
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        managedEventRefs: {
          select: {
            eventId: true
          }
        }
      }
    });

    return NextResponse.json(
      {
        user: {
          ...user,
          managedEventIds: user.managedEventRefs.map((item) => item.eventId)
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo crear usuario"
      },
      { status: 400 }
    );
  }
}
