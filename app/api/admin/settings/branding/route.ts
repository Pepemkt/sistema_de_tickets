import { NextResponse } from "next/server";
import { checkApiRole } from "@/lib/api-auth";
import { normalizeBrandingLogo, readBrandingConfig, writeBrandingConfig } from "@/lib/branding";

export const runtime = "nodejs";

export async function GET() {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const config = await readBrandingConfig();
  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as { sidebarLogoUrl?: unknown };
    const config = await writeBrandingConfig({
      sidebarLogoUrl: normalizeBrandingLogo(payload?.sidebarLogoUrl)
    });

    return NextResponse.json({ ok: true, ...config });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo guardar branding"
      },
      { status: 400 }
    );
  }
}

