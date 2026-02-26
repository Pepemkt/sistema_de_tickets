import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkApiRole } from "@/lib/api-auth";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";

const createSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/),
  displayName: z.string().max(60).optional(),
  password: z.string().min(6).max(100),
  role: z.enum(["ADMIN", "SELLER", "SCANNER"])
});

export async function GET() {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const users = await db.user.findMany({
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
      }
    }
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const data = createSchema.parse(await request.json());

    const user = await db.user.create({
      data: {
        username: data.username.toLowerCase(),
        displayName: data.displayName || null,
        passwordHash: await hashPassword(data.password),
        role: data.role
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo crear usuario"
      },
      { status: 400 }
    );
  }
}
