import { NextResponse } from "next/server";
import { checkApiRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { buildLiquidationForEvent } from "@/lib/application/liquidations/build-liquidation";
import { requireViewerEventAccess } from "@/lib/event-scope";

type Params = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";

type LiquidationCreate = {
  data: {
    clientId: string;
    eventId: string;
    merchantAccountId: string | null;
    grossCents: number;
    commissionCents: number;
    netCents: number;
    commissionRateBpsSnapshot: number;
    status: "DRAFT";
    items: {
      create: Array<{
        orderId: string;
        paymentId: string | null;
        grossCents: number;
        commissionCents: number;
        netCents: number;
      }>;
    };
  };
  select: { id: true };
};

type LiquidationWriter = {
  liquidation: {
    create(args: LiquidationCreate): Promise<{ id: string }>;
  };
};

export async function GET(_request: Request, { params }: Params) {
  const auth = await checkApiRole(["ADMIN", "MANAGER"]);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    await requireViewerEventAccess(auth.viewer!, id);
    const draft = await buildLiquidationForEvent(id);
    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo calcular la liquidacion" },
      { status: 400 }
    );
  }
}

export async function POST(_request: Request, { params }: Params) {
  const auth = await checkApiRole(["ADMIN", "MANAGER"]);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    await requireViewerEventAccess(auth.viewer!, id);

    const draft = await buildLiquidationForEvent(id);
    if (draft.items.length === 0) {
      return NextResponse.json({ error: "No hay ordenes nuevas para liquidar" }, { status: 400 });
    }

    const writer = db as unknown as LiquidationWriter;
    const created = await writer.liquidation.create({
      data: {
        clientId: draft.clientId,
        eventId: draft.eventId,
        merchantAccountId: draft.merchantAccountId,
        grossCents: draft.grossCents,
        commissionCents: draft.commissionCents,
        netCents: draft.netCents,
        commissionRateBpsSnapshot: draft.commissionRateBpsSnapshot,
        status: "DRAFT",
        items: {
          create: draft.items.map((item) => ({
            orderId: item.orderId,
            paymentId: item.paymentId,
            grossCents: item.grossCents,
            commissionCents: item.commissionCents,
            netCents: item.netCents
          }))
        }
      },
      select: { id: true }
    });

    return NextResponse.json({ ok: true, liquidationId: created.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la liquidacion" },
      { status: 400 }
    );
  }
}
