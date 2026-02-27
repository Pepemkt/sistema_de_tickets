import { createHash, randomBytes } from "crypto";
import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

const SESSION_COOKIE_NAME = "aiderbrand_session";
const SESSION_TTL_DAYS = 7;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type Viewer = {
  id: string;
  username: string;
  displayName: string | null;
  role: UserRole;
};

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt
    }
  });

  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0)
  });
}

export async function revokeSessionByToken(token: string) {
  await db.session.deleteMany({
    where: { tokenHash: hashToken(token) }
  });
}

export async function getCurrentViewer(): Promise<Viewer | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          isActive: true
        }
      }
    }
  });

  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    // No side effects here: this helper is used from Server Components,
    // and Next.js forbids mutating cookies during RSC render.
    return null;
  }

  return {
    id: session.user.id,
    username: session.user.username,
    displayName: session.user.displayName,
    role: session.user.role
  };
}

export async function requirePageRole(roles: UserRole[]) {
  const viewer = await getCurrentViewer();
  if (!viewer || !roles.includes(viewer.role)) {
    redirect("/login");
  }

  return viewer;
}

export async function requireAnyPageRole() {
  const viewer = await getCurrentViewer();
  if (!viewer) {
    redirect("/login");
  }

  return viewer;
}
