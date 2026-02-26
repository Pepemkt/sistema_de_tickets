import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { normalizeTicketTemplate } from "@/lib/ticket-template";
import { TemplateEditor } from "@/components/template-editor";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EventTemplatePage({ params }: Props) {
  const { id } = await params;

  const event = await db.event.findUnique({
    where: { id },
    include: {
      ticketTypes: {
        orderBy: { priceCents: "asc" },
        take: 1
      }
    }
  });

  if (!event) {
    notFound();
  }

  return (
    <TemplateEditor
      eventId={event.id}
      eventName={event.name}
      venue={event.venue ?? "Lugar por confirmar"}
      startsAt={event.startsAt.toISOString()}
      ticketTypeName={event.ticketTypes[0]?.name ?? "General"}
      initialTemplate={normalizeTicketTemplate(event.templateJson)}
    />
  );
}
