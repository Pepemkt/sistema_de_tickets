import { NextResponse } from "next/server";
import { z } from "zod";
import { checkApiRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { requireViewerClientAccess } from "@/lib/event-scope";
import { commissionPercentToBps, DEFAULT_PLATFORM_COMMISSION_RATE_BPS } from "@/lib/platform-commission";

type Params = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";

const updateSchema = z.object({
  accessToken: z.string().trim().optional(),
  webhookSecret: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  commissionPercent: z.number().min(0).max(100).optional()
});

export async function PUT(request: Request, { params }: Params) {
  const auth = await checkApiRole(["ADMIN", "MANAGER"]);
  if (auth.response) return auth.response;

  const clientAdminDb = db as unknown as {
    client: {
      findUnique(args: { where: { id: string }; select: { id: true } }): Promise<{ id: string } | null>;
    };
    merchantAccount: {
      findUnique(args: {
        where: { clientId_provider: { clientId: string; provider: "MERCADOPAGO" } };
      }): Promise<{
        accessToken: string;
        webhookSecret: string | null;
        status: "ACTIVE" | "DISABLED";
        commissionRateBps: number;
      } | null>;
      upsert(args: {
        where: { clientId_provider: { clientId: string; provider: "MERCADOPAGO" } };
        create: {
          clientId: string;
          provider: "MERCADOPAGO";
          accessToken: string;
          webhookSecret: string | null;
          status: "ACTIVE" | "DISABLED";
          commissionRateBps: number;
        };
        update: {
          accessToken: string;
          webhookSecret: string | null;
          status: "ACTIVE" | "DISABLED";
          commissionRateBps: number;
        };
      }): Promise<{
        id: string;
        status: "ACTIVE" | "DISABLED";
        accessToken: string;
        webhookSecret: string | null;
        commissionRateBps: number;
        updatedAt: Date;
      }>;
    };
  };

  try {
    const viewer = auth.viewer!;
    const { id } = await params;
    await requireViewerClientAccess(viewer, id);

    const client = await clientAdminDb.client.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!client) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const data = updateSchema.parse(await request.json());
    if (viewer.role !== "ADMIN" && data.commissionPercent !== undefined) {
      throw new Error("Solo ADMIN puede configurar la comision del merchant");
    }

    const current = await clientAdminDb.merchantAccount.findUnique({
      where: {
        clientId_provider: {
          clientId: id,
          provider: "MERCADOPAGO"
        }
      }
    });

    const accessToken = data.accessToken === undefined ? current?.accessToken ?? "" : data.accessToken;
    const webhookSecret = data.webhookSecret === undefined ? current?.webhookSecret ?? null : data.webhookSecret || null;
    const status = data.status ?? current?.status ?? "ACTIVE";
    const commissionRateBps =
      viewer.role === "ADMIN" && data.commissionPercent !== undefined
        ? commissionPercentToBps(data.commissionPercent)
        : current?.commissionRateBps ?? DEFAULT_PLATFORM_COMMISSION_RATE_BPS;

    const merchant = await clientAdminDb.merchantAccount.upsert({
      where: {
        clientId_provider: {
          clientId: id,
          provider: "MERCADOPAGO"
        }
      },
      create: {
        clientId: id,
        provider: "MERCADOPAGO",
        accessToken,
        webhookSecret,
        status,
        commissionRateBps
      },
      update: {
        accessToken,
        webhookSecret,
        status,
        commissionRateBps
      }
    });

    return NextResponse.json({
      ok: true,
      merchantAccountId: merchant.id,
      status: merchant.status,
      commissionRateBps: merchant.commissionRateBps,
      hasAccessToken: Boolean(merchant.accessToken.trim()),
      hasWebhookSecret: Boolean(merchant.webhookSecret?.trim()),
      updatedAt: merchant.updatedAt.toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo guardar el merchant"
      },
      { status: 400 }
    );
  }
}
