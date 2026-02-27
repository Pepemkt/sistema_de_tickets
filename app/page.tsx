import { db } from "@/lib/db";
import { requireAnyPageRole } from "@/lib/auth";
import { EventsPanel } from "@/components/events-panel";

export default async function HomePage() {
  const viewer = await requireAnyPageRole();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const events = await db.event.findMany({
    orderBy: { startsAt: "asc" },
    include: {
      ticketTypes: {
        orderBy: { priceCents: "asc" }
      }
    }
  });

  return <EventsPanel viewerRole={viewer.role} appUrl={appUrl} events={events} />;
}
