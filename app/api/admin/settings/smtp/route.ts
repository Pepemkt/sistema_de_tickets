import { NextResponse } from "next/server";
import { z } from "zod";
import { checkApiRole } from "@/lib/api-auth";
import { getPlatformConfig, resolveSmtpConfig, upsertSmtpConfig } from "@/lib/platform-config";

export const runtime = "nodejs";

const updateSchema = z.object({
  smtpHost: z.string().trim().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().trim().optional(),
  smtpPass: z.string().trim().optional(),
  smtpFrom: z.string().trim().optional(),
  smtpSecure: z.boolean().optional()
});

export async function GET() {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const config = await resolveSmtpConfig();
  const stored = await getPlatformConfig();

  return NextResponse.json({
    configured: config.configured,
    host: config.host,
    port: config.port,
    user: config.user,
    from: config.from,
    secure: config.secure,
    hasPassword: Boolean(stored?.smtpPass),
    updatedAt: stored?.updatedAt ?? null
  });
}

export async function PUT(request: Request) {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const data = updateSchema.parse(await request.json());
    const current = await getPlatformConfig();

    const next = {
      smtpHost: data.smtpHost === undefined ? current?.smtpHost ?? null : data.smtpHost || null,
      smtpPort: data.smtpPort === undefined ? current?.smtpPort ?? null : data.smtpPort,
      smtpUser: data.smtpUser === undefined ? current?.smtpUser ?? null : data.smtpUser || null,
      smtpPass: data.smtpPass === undefined ? current?.smtpPass ?? null : data.smtpPass || null,
      smtpFrom: data.smtpFrom === undefined ? current?.smtpFrom ?? null : data.smtpFrom || null,
      smtpSecure: data.smtpSecure === undefined ? current?.smtpSecure ?? null : data.smtpSecure
    };

    const config = await upsertSmtpConfig(next);
    const resolved = await resolveSmtpConfig();

    return NextResponse.json({
      ok: true,
      configured: resolved.configured,
      host: resolved.host,
      port: resolved.port,
      user: resolved.user,
      from: resolved.from,
      secure: resolved.secure,
      hasPassword: Boolean(config.smtpPass),
      updatedAt: config.updatedAt
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo guardar SMTP"
      },
      { status: 400 }
    );
  }
}
