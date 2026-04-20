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

export async function listManagedClientIds(userId: string) {
  const eventIds = await listManagedEventIds(userId);
  if (eventIds.length === 0) {
    return [];
  }

  const eventClientReader = db as unknown as {
    event: {
      findMany(args: {
        where: { id: { in: string[] }; clientId: { not: null } };
        select: { clientId: true };
      }): Promise<Array<{ clientId: string | null }>>;
    };
  };

  const rows = await eventClientReader.event.findMany({
    where: {
      id: { in: eventIds },
      clientId: { not: null }
    },
    select: { clientId: true }
  });

  return Array.from(new Set(rows.map((row) => row.clientId).filter((value): value is string => Boolean(value))));
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

export async function viewerCanAccessClient(viewer: ViewerWithRole, clientId: string) {
  if (!isEventScopedRole(viewer.role)) {
    return true;
  }

  const scopedClientIds = await listManagedClientIds(viewer.id);
  return scopedClientIds.includes(clientId);
}

export async function requireViewerClientAccess(
  viewer: ViewerWithRole,
  clientId: string,
  errorMessage = "Sin permisos para este cliente"
) {
  const allowed = await viewerCanAccessClient(viewer, clientId);
  if (!allowed) {
    throw new Error(errorMessage);
  }
}
