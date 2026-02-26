import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { EventForm } from "@/components/event-form";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditEventPage({ params }: Props) {
  const { id } = await params;

  const event = await db.event.findUnique({
    where: { id },
    include: {
      ticketTypes: {
        orderBy: { priceCents: "asc" },
        include: {
          _count: {
            select: { tickets: true }
          }
        }
      }
    }
  });

  if (!event) {
    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
  const publicPath = `/e/${event.slug}`;
  const publicEventUrl = baseUrl ? `${baseUrl}${publicPath}` : publicPath;

  return (
    <section className="panel p-6">
      <h2 className="section-title">Editar evento</h2>
      <p className="muted mt-1">Actualiza contenidos, fechas y estrategia de precios.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Link href={`/admin/events/${event.id}/template`} className="btn-secondary">
          Editar diseno de tickets (PDF)
        </Link>
        <Link href={publicPath} className="btn-secondary" target="_blank" rel="noopener noreferrer">
          Abrir pagina publica de compra
        </Link>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Link compartible</p>
        <p className="mt-1 break-all text-sm text-slate-700">{publicEventUrl}</p>
      </div>

      <div className="mt-6">
        <EventForm
          mode="edit"
          eventId={event.id}
          initial={{
            name: event.name,
            description: event.description ?? "",
            venue: event.venue ?? "",
            startsAt: event.startsAt.toISOString(),
            endsAt: event.endsAt ? event.endsAt.toISOString() : "",
            ticketTypes: event.ticketTypes.map((item) => ({
              id: item.id,
              name: item.name,
              price: item.priceCents / 100,
              stock: item.stock,
              saleMode: item.saleMode,
              maxPerOrder: item.maxPerOrder ?? null,
              maxPerEmail: item.maxPerEmail ?? null,
              soldCount: item._count.tickets
            }))
          }}
        />
      </div>
    </section>
  );
}
