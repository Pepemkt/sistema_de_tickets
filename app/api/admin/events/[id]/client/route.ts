import { NextResponse } from "next/server";
import { z } from "zod";
import { checkApiRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { requireViewerEventAccess } from "@/lib/event-scope";

type Params = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";

const updateSchema = z.object({
  clientId: z.string().trim().min(1).nullable()
});

type EventClientWriter = {
  event: {
    update(args: {
      where: { id: string };
      data: { clientId: string | null };
      select: { id: true; clientId: true; client: { select: { id: true; name: true } } };
    }): Promise<{ id: string; clientId: string | null; client: { id: string; name: string } | null }>;
  };
  client: {
    findUnique(args: { where: { id: string }; select: { id: true } }): Promise<{ id: string } | null>;
  };
};

export async function PUT(request: Request, { params }: Params) {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    await requireViewerEventAccess(auth.viewer!, id);

    const payload = updateSchema.parse(await request.json());
    const writer = db as unknown as EventClientWriter;

    if (payload.clientId) {
      const client = await writer.client.findUnique({
        where: { id: payload.clientId },
        select: { id: true }
      });
      if (!client) {
        return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
      }
    }

    const updated = await writer.event.update({
      where: { id },
      data: { clientId: payload.clientId },
      select: {
        id: true,
        clientId: true,
        client: { select: { id: true, name: true } }
      }
    });

    return NextResponse.json({ ok: true, event: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo asignar el cliente" },
      { status: 400 }
    );
  }
}
