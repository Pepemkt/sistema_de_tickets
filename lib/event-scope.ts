import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";

type ViewerWithRole = {
  id: string;
  role: UserRole;
};

export function isManagerRole(role: UserRole) {
  return role === "MANAGER";
}

export async function listManagedEventIds(userId: string) {
  const rows = await db.eventManagerScope.findMany({
    where: { userId },
    select: { eventId: true }
  });

  return rows.map((row) => row.eventId);
}

export async function getScopedEventIdsForViewer(viewer: ViewerWithRole) {
  if (!isManagerRole(viewer.role)) {
    return null;
  }

  return listManagedEventIds(viewer.id);
}

export async function viewerCanAccessEvent(viewer: ViewerWithRole, eventId: string) {
  if (!isManagerRole(viewer.role)) {
    return true;
  }

  const scope = await db.eventManagerScope.findUnique({
    where: {
      userId_eventId: {
        userId: viewer.id,
        eventId
      }
    },
    select: { id: true }
  });

  return Boolean(scope);
}

export async function requireViewerEventAccess(
  viewer: ViewerWithRole,
  eventId: string,
  errorMessage = "Sin permisos para este evento"
) {
  const allowed = await viewerCanAccessEvent(viewer, eventId);
  if (!allowed) {
    throw new Error(errorMessage);
  }
}

