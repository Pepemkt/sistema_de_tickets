const RATE_LIMIT_GC_INTERVAL_MS = 60_000;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  aiderbrandRateLimitBuckets?: Map<string, RateLimitBucket>;
  aiderbrandRateLimitGcAt?: number;
};

function rateLimitStore() {
  if (!globalForRateLimit.aiderbrandRateLimitBuckets) {
    globalForRateLimit.aiderbrandRateLimitBuckets = new Map();
    globalForRateLimit.aiderbrandRateLimitGcAt = 0;
  }

  const now = Date.now();
  const nextGcAt = globalForRateLimit.aiderbrandRateLimitGcAt ?? 0;

  if (now >= nextGcAt) {
    for (const [key, bucket] of globalForRateLimit.aiderbrandRateLimitBuckets.entries()) {
      if (bucket.resetAt <= now) {
        globalForRateLimit.aiderbrandRateLimitBuckets.delete(key);
      }
    }

    globalForRateLimit.aiderbrandRateLimitGcAt = now + RATE_LIMIT_GC_INTERVAL_MS;
  }

  return globalForRateLimit.aiderbrandRateLimitBuckets;
}

export function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const store = rateLimitStore();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    };
  }

  current.count += 1;
  store.set(key, current);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

export function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const secFetchSite = request.headers.get("sec-fetch-site");

  if (!origin) {
    if (!secFetchSite) return true;
    return secFetchSite === "same-origin" || secFetchSite === "same-site" || secFetchSite === "none";
  }

  const requestOrigin = new URL(request.url).origin;
  if (origin === requestOrigin) {
    return true;
  }

  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredAppUrl) {
    return false;
  }

  try {
    return new URL(configuredAppUrl).origin === origin;
  } catch {
    return false;
  }
}
