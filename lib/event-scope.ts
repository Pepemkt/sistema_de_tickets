import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";

type ViewerWithRole = {
  id: string;
  role: UserRole;
};

export function isEventScopedRole(role: UserRole) {
  return role === "MANAGER" || role === "SELLER" || role === "SCANNER";
}

export async function listManagedEventIds(userId: string) {
  const rows = await db.eventManagerScope.findMany({
    where: { userId },
    select: { eventId: true }
  });

  return rows.map((row) => row.eventId);
}

export async function getScopedEventIdsForViewer(viewer: ViewerWithRole) {
  if (!isEventScopedRole(viewer.role)) {
    return null;
  }

  return listManagedEventIds(viewer.id);
}

export async function viewerCanAccessEvent(viewer: ViewerWithRole, eventId: string) {
  if (!isEventScopedRole(viewer.role)) {
    return true;
  }

  const scopedIds = await getScopedEventIdsForViewer(viewer);
  if (!scopedIds) return true;
  return scopedIds.includes(eventId);
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
