import { db } from "@/lib/db";
import { requireAnyPageRole } from "@/lib/auth";
import { EventsPanel } from "@/components/events-panel";
import { getScopedEventIdsForViewer } from "@/lib/event-scope";

export default async function HomePage() {
  const viewer = await requireAnyPageRole();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const scopedEventIds = await getScopedEventIdsForViewer(viewer);

  const events = await db.event.findMany({
    where: scopedEventIds ? { id: { in: scopedEventIds } } : undefined,
    orderBy: { startsAt: "asc" },
    include: {
      ticketTypes: {
        orderBy: { priceCents: "asc" }
      }
    }
  });

  return <EventsPanel viewerRole={viewer.role} appUrl={appUrl} events={events} />;
}
