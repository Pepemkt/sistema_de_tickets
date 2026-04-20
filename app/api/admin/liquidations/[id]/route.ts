import { NextResponse } from "next/server";
import { z } from "zod";
import { checkApiRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { requireViewerEventAccess } from "@/lib/event-scope";

type Params = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";

const transitionSchema = z.object({
  status: z.enum(["FINALIZED", "SETTLED", "CANCELLED", "DRAFT"])
});

type LiquidationStatus = "DRAFT" | "FINALIZED" | "SETTLED" | "CANCELLED";

type LiquidationDetail = {
  id: string;
  status: LiquidationStatus;
  clientId: string;
  eventId: string;
  merchantAccountId: string | null;
  grossCents: number;
  commissionCents: number;
  netCents: number;
  commissionRateBpsSnapshot: number;
  settledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  client: { id: string; name: string } | null;
  event: { id: string; name: string; slug: string } | null;
  merchantAccount: { id: string; provider: string; status: string } | null;
  items: Array<{
    id: string;
    orderId: string;
    paymentId: string | null;
    grossCents: number;
    commissionCents: number;
    netCents: number;
    createdAt: Date;
  }>;
};

type LiquidationReader = {
  liquidation: {
    findUnique(args: {
      where: { id: string };
      select: { id: true; eventId: true; status: true };
    }): Promise<{ id: string; eventId: string; status: LiquidationStatus } | null>;
    update(args: {
      where: { id: string };
      data: { status: LiquidationStatus; settledAt?: Date | null };
      select: { id: true; status: true; settledAt: true };
    }): Promise<{ id: string; status: LiquidationStatus; settledAt: Date | null }>;
  };
};

type LiquidationDetailReader = {
  liquidation: {
    findUnique(args: {
      where: { id: string };
      include: {
        client: { select: { id: true; name: true } };
        event: { select: { id: true; name: true; slug: true } };
        merchantAccount: { select: { id: true; provider: true; status: true } };
        items: { orderBy: { createdAt: "asc" } };
      };
    }): Promise<LiquidationDetail | null>;
  };
};

const allowedTransitions: Record<LiquidationStatus, LiquidationStatus[]> = {
  DRAFT: ["FINALIZED", "CANCELLED"],
  FINALIZED: ["SETTLED", "CANCELLED"],
  SETTLED: [],
  CANCELLED: []
};

export async function GET(_request: Request, { params }: Params) {
  const auth = await checkApiRole(["ADMIN", "MANAGER"]);
  if (auth.response) return auth.response;

  try {
    const viewer = auth.viewer!;
    const { id } = await params;

    const reader = db as unknown as LiquidationDetailReader;
    const liquidation = await reader.liquidation.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        event: { select: { id: true, name: true, slug: true } },
        merchantAccount: { select: { id: true, provider: true, status: true } },
        items: { orderBy: { createdAt: "asc" } }
      }
    });

    if (!liquidation) {
      return NextResponse.json({ error: "Liquidacion no encontrada" }, { status: 404 });
    }

    await requireViewerEventAccess(viewer, liquidation.eventId);

    return NextResponse.json({
      ok: true,
      liquidation: {
        ...liquidation,
        settledAt: liquidation.settledAt?.toISOString() ?? null,
        createdAt: liquidation.createdAt.toISOString(),
        updatedAt: liquidation.updatedAt.toISOString(),
        items: liquidation.items.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString()
        }))
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo leer la liquidacion" },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  const auth = await checkApiRole(["ADMIN", "MANAGER"]);
  if (auth.response) return auth.response;

  try {
    const viewer = auth.viewer!;
    const { id } = await params;
    const payload = transitionSchema.parse(await request.json());

    const reader = db as unknown as LiquidationReader;
    const liquidation = await reader.liquidation.findUnique({
      where: { id },
      select: { id: true, eventId: true, status: true }
    });

    if (!liquidation) {
      return NextResponse.json({ error: "Liquidacion no encontrada" }, { status: 404 });
    }

    await requireViewerEventAccess(viewer, liquidation.eventId);

    if (viewer.role !== "ADMIN" && payload.status === "SETTLED") {
      return NextResponse.json({ error: "Solo ADMIN puede marcar como liquidada" }, { status: 403 });
    }

    const allowed = allowedTransitions[liquidation.status];
    if (!allowed.includes(payload.status)) {
      return NextResponse.json(
        { error: `Transicion invalida: ${liquidation.status} -> ${payload.status}` },
        { status: 400 }
      );
    }

    const updated = await reader.liquidation.update({
      where: { id },
      data: {
        status: payload.status,
        settledAt: payload.status === "SETTLED" ? new Date() : null
      },
      select: { id: true, status: true, settledAt: true }
    });

    return NextResponse.json({
      ok: true,
      liquidation: {
        id: updated.id,
        status: updated.status,
        settledAt: updated.settledAt?.toISOString() ?? null
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la liquidacion" },
      { status: 400 }
    );
  }
}
