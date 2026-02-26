import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionCookie, revokeSessionByToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("aiderbrand_session")?.value;

  if (token) {
    await revokeSessionByToken(token);
  }

  await clearSessionCookie();

  return NextResponse.json({ ok: true });
}
