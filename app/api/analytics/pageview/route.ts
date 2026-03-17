import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAnalyticsStep } from "@/lib/analytics";

const DEDUPE_WINDOW_MS = 10000;

function normalizeOptionalString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, step, eventSlug, pathname, referrerHost, deviceType } = body ?? {};

    if (
      typeof sessionId !== "string" || !sessionId.trim() ||
      typeof step !== "string" || !isAnalyticsStep(step) ||
      typeof eventSlug !== "string" || !eventSlug.trim()
    ) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const normalizedSessionId = sessionId.trim().slice(0, 120);
    const normalizedEventSlug = eventSlug.trim().slice(0, 120);
    const normalizedPathname = normalizeOptionalString(pathname, 240);
    const normalizedReferrerHost = normalizeOptionalString(referrerHost, 180);
    const normalizedDeviceType = normalizeOptionalString(deviceType, 32);
    const dedupeAfter = new Date(Date.now() - DEDUPE_WINDOW_MS);

    const existing = await db.pageView.findFirst({
      where: {
        sessionId: normalizedSessionId,
        eventSlug: normalizedEventSlug,
        step,
        pathname: normalizedPathname,
        createdAt: { gte: dedupeAfter }
      },
      select: { id: true }
    });

    if (existing) {
      return NextResponse.json({ ok: true, deduped: true });
    }

    await db.pageView.create({
      data: {
        sessionId: normalizedSessionId,
        step,
        eventSlug: normalizedEventSlug,
        pathname: normalizedPathname,
        referrerHost: normalizedReferrerHost,
        deviceType: normalizedDeviceType
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[analytics/pageview] error:", err);
    // Always return 200 to not interrupt the user experience
    return NextResponse.json({ ok: false });
  }
}
