import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

export const runtime = "nodejs";
const LOGIN_WINDOW_MS = 1000 * 60 * 10;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_BLOCK_MS = 1000 * 60 * 15;

type LoginAttemptState = {
  firstAttemptAt: number;
  failedCount: number;
  blockedUntil?: number;
};

const globalForLoginLimiter = globalThis as typeof globalThis & {
  aiderbrandLoginLimiter?: Map<string, LoginAttemptState>;
};

function loginLimiterStore() {
  if (!globalForLoginLimiter.aiderbrandLoginLimiter) {
    globalForLoginLimiter.aiderbrandLoginLimiter = new Map();
  }
  return globalForLoginLimiter.aiderbrandLoginLimiter;
}

function loginAttemptKey(request: Request, username: string) {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const clientIp = forwardedFor.split(",")[0]?.trim() || "unknown-ip";
  return `${clientIp}:${username.toLowerCase().trim()}`;
}

function isLoginBlocked(key: string) {
  const entry = loginLimiterStore().get(key);
  if (!entry?.blockedUntil) {
    return false;
  }

  if (entry.blockedUntil <= Date.now()) {
    loginLimiterStore().delete(key);
    return false;
  }

  return true;
}

function registerFailedLogin(key: string) {
  const store = loginLimiterStore();
  const now = Date.now();
  const current = store.get(key);

  if (!current || now - current.firstAttemptAt > LOGIN_WINDOW_MS) {
    store.set(key, {
      firstAttemptAt: now,
      failedCount: 1
    });
    return;
  }

  const failedCount = current.failedCount + 1;
  store.set(key, {
    firstAttemptAt: current.firstAttemptAt,
    failedCount,
    blockedUntil: failedCount >= MAX_LOGIN_ATTEMPTS ? now + LOGIN_BLOCK_MS : undefined
  });
}

function clearFailedLogins(key: string) {
  loginLimiterStore().delete(key);
}

const schema = z.object({
  username: z.string().trim().min(3),
  password: z.string().min(4)
});

export async function POST(request: Request) {
  try {
    const data = schema.parse(await request.json());
    const limiterKey = loginAttemptKey(request, data.username);

    if (isLoginBlocked(limiterKey)) {
      return NextResponse.json({ error: "Demasiados intentos. Reintenta en unos minutos." }, { status: 429 });
    }

    const user = await db.user.findUnique({
      where: { username: data.username.toLowerCase() }
    });

    if (!user || !user.isActive) {
      registerFailedLogin(limiterKey);
      return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 });
    }

    const validPassword = await verifyPassword(data.password, user.passwordHash);
    if (!validPassword) {
      registerFailedLogin(limiterKey);
      return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 });
    }

    clearFailedLogins(limiterKey);
    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);

    return NextResponse.json({
      ok: true,
      user: {
        username: user.username,
        displayName: user.displayName,
        role: user.role
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo iniciar sesion"
      },
      { status: 400 }
    );
  }
}
