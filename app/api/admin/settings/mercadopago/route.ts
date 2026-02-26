import { NextResponse } from "next/server";
import { z } from "zod";
import { checkApiRole } from "@/lib/api-auth";
import {
  getPlatformConfig,
  resolveMercadoPagoAccessToken,
  resolveMercadoPagoWebhookSecret,
  upsertMercadoPagoConfig
} from "@/lib/platform-config";

export const runtime = "nodejs";

const updateSchema = z.object({
  mercadoPagoAccessToken: z.string().trim().optional(),
  mercadoPagoWebhookSecret: z.string().trim().optional()
});

export async function GET() {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const [config, accessToken, webhookSecret] = await Promise.all([
    getPlatformConfig(),
    resolveMercadoPagoAccessToken(),
    resolveMercadoPagoWebhookSecret()
  ]);
  const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || "";

  return NextResponse.json({
    hasAccessToken: Boolean(accessToken),
    hasWebhookSecret: Boolean(webhookSecret),
    hasPublicKey: Boolean(publicKey),
    publicKey,
    updatedAt: config?.updatedAt ?? null
  });
}

export async function PUT(request: Request) {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const data = updateSchema.parse(await request.json());
    const current = await getPlatformConfig();

    const resolvedAccessToken =
      data.mercadoPagoAccessToken === undefined
        ? current?.mercadoPagoAccessToken ?? null
        : data.mercadoPagoAccessToken || null;

    const resolvedWebhookSecret =
      data.mercadoPagoWebhookSecret === undefined
        ? current?.mercadoPagoWebhookSecret ?? null
        : data.mercadoPagoWebhookSecret || null;

    const config = await upsertMercadoPagoConfig({
      mercadoPagoAccessToken: resolvedAccessToken,
      mercadoPagoWebhookSecret: resolvedWebhookSecret
    });

    const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || "";

    return NextResponse.json({
      ok: true,
      hasAccessToken: Boolean(config.mercadoPagoAccessToken),
      hasWebhookSecret: Boolean(config.mercadoPagoWebhookSecret),
      hasPublicKey: Boolean(publicKey),
      publicKey,
      updatedAt: config.updatedAt
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo guardar configuracion"
      },
      { status: 400 }
    );
  }
}
