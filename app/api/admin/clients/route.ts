import { NextResponse } from "next/server";
import { z } from "zod";
import { checkApiRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getScopedEventIdsForViewer } from "@/lib/event-scope";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120)
});

type ClientWriter = {
  client: {
    create(args: { data: { name: string }; select: { id: true; name: true } }): Promise<{ id: string; name: string }>;
    findMany(args: {
      where?: { events: { some: { id: { in: string[] } } } };
      orderBy: { name: "asc" };
      select: { id: true; name: true };
    }): Promise<Array<{ id: string; name: string }>>;
  };
};

export async function GET() {
  const auth = await checkApiRole(["ADMIN", "MANAGER"]);
  if (auth.response) return auth.response;

  const viewer = auth.viewer!;
  const scopedEventIds = await getScopedEventIdsForViewer(viewer);

  const reader = db as unknown as ClientWriter;
  const clients = await reader.client.findMany({
    where: scopedEventIds ? { events: { some: { id: { in: scopedEventIds } } } } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });

  return NextResponse.json({ ok: true, clients });
}

export async function POST(request: Request) {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const { name } = createSchema.parse(await request.json());
    const writer = db as unknown as ClientWriter;
    const client = await writer.client.create({
      data: { name },
      select: { id: true, name: true }
    });
    return NextResponse.json({ ok: true, client });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el cliente" },
      { status: 400 }
    );
  }
}
