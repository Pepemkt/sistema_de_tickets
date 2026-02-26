import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkApiRole } from "@/lib/api-auth";
import { ticketTemplateSchema } from "@/lib/ticket-template";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, { params }: Params) {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const data = ticketTemplateSchema.parse(await request.json());

    const event = await db.event.update({
      where: { id },
      data: {
        templateJson: data
      }
    });

    return NextResponse.json({ ok: true, event });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo actualizar la plantilla"
      },
      { status: 400 }
    );
  }
}
