"use client";

import type { AnalyticsStep } from "@/lib/analytics";

const SESSION_STORAGE_KEY = "_pvs";
const DUPLICATE_TTL_MS = 15000;

type TrackAnalyticsStepInput = {
  step: AnalyticsStep;
  eventSlug: string;
  transport?: "fetch" | "beacon";
};

function buildSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getOrCreateSessionId(): string {
  try {
    const current = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (current) return current;

    const next = buildSessionId();
    sessionStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return "unknown";
  }
}

function getCurrentPath() {
  try {
    return window.location.pathname || "";
  } catch {
    return "";
  }
}

function getReferrerHost() {
  try {
    if (!document.referrer) return "";
    return new URL(document.referrer).host || "";
  } catch {
    return "";
  }
}

function getDeviceType() {
  try {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/ipad|tablet|playbook|silk/.test(userAgent)) return "tablet";
    if (/mobile|android|iphone|ipod/.test(userAgent)) return "mobile";
    return "desktop";
  } catch {
    return "unknown";
  }
}

function shouldSuppressDuplicate(signature: string) {
  try {
    const key = `${SESSION_STORAGE_KEY}:evt:${signature}`;
    const now = Date.now();
    const previous = Number(sessionStorage.getItem(key) ?? "0");

    if (previous && now - previous < DUPLICATE_TTL_MS) {
      return true;
    }

    sessionStorage.setItem(key, String(now));
    return false;
  } catch {
    return false;
  }
}

export function trackAnalyticsStep({ step, eventSlug, transport = "fetch" }: TrackAnalyticsStepInput) {
  if (!eventSlug) return;

  const sessionId = getOrCreateSessionId();
  const pathname = getCurrentPath();
  const referrerHost = getReferrerHost();
  const deviceType = getDeviceType();
  const duplicateSignature = [sessionId, eventSlug, step, pathname].join(":");

  if (shouldSuppressDuplicate(duplicateSignature)) {
    return;
  }

  const payload = JSON.stringify({
    sessionId,
    step,
    eventSlug,
    pathname,
    referrerHost,
    deviceType
  });

  if (transport === "beacon" && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const body = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/analytics/pageview", body);
    return;
  }

  fetch("/api/analytics/pageview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true
  }).catch(() => {
    // Analytics must stay best-effort and never affect the user flow.
  });
}
