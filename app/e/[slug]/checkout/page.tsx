import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PublicCheckout } from "@/components/public-checkout";
import { resolveCheckoutFeeItems } from "@/lib/platform-config";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PublicEventCheckoutPage({ params }: Props) {
  const { slug } = await params;
  const event = await db.event.findUnique({
    where: { slug },
    include: {
      ticketTypes: {
        orderBy: { priceCents: "asc" }
      }
    }
  });

  if (!event) notFound();
  const feeItems = await resolveCheckoutFeeItems();

  const visibleTicketTypes = event.ticketTypes.filter((type) => type.saleMode !== "HIDDEN");

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6">
      <div className="mx-auto mb-6 flex w-full max-w-6xl items-center justify-between">
        <Link href={`/e/${event.slug}`} className="btn-secondary">
          Volver al evento
        </Link>
        <p className="text-sm text-slate-500">Compra oficial</p>
      </div>
      <div className="mx-auto w-full max-w-6xl">
        <PublicCheckout
          eventId={event.id}
          eventName={event.name}
          eventDateText={new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(event.startsAt)}
          ticketTypes={visibleTicketTypes.map((type) => ({
            id: type.id,
            name: type.name,
            priceCents: type.priceCents,
            stock: type.stock,
            saleMode: type.saleMode,
            maxPerOrder: type.maxPerOrder
          }))}
          feeItems={feeItems}
        />
      </div>
    </div>
  );
}
