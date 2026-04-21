import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PublicCheckout } from "@/components/public-checkout";
import { resolveCheckoutFeeItems } from "@/lib/platform-config";
import { VisitTracker } from "@/components/visit-tracker";

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
  if (event.status === "DRAFT") notFound();
  const feeItems = await resolveCheckoutFeeItems();

  const visibleTicketTypes = event.ticketTypes.filter((type) => type.saleMode !== "HIDDEN");
  const isActive = event.status === "ACTIVE";

  return (
    <>
      <style>{`
        @keyframes page-in {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .page-in { animation: page-in 0.5s var(--ease-tactile) both; }
        .page-in-2 { animation: page-in 0.5s var(--ease-tactile) 0.1s both; }
      `}</style>

      <div className="min-h-screen bg-page">
        <VisitTracker step="checkout" eventSlug={slug} />

        {/* Top gradient accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-[color:var(--brand-violet)] via-[color:var(--brand-magenta)] to-coral-300" />

        {/* Header */}
        <header className="border-b border-soft bg-surface/80 backdrop-blur-sm">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <Link
                href={`/e/${event.slug}`}
                className="group flex items-center gap-1.5 text-body-s font-semibold text-[color:var(--brand-violet)] transition-colors hover:text-[color:var(--brand-violet-deep)]"
              >
                <svg className="h-4 w-4 transition-transform duration-base group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Volver al evento
              </Link>
              <span className="hidden h-4 w-px bg-soft sm:block" />
              <span className="hidden text-caption text-muted sm:block">{event.name}</span>
            </div>
            <div className="flex items-center gap-1.5 text-caption text-muted">
              <svg className="h-3.5 w-3.5 text-success-500" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
              </svg>
              Compra segura
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
          {isActive ? (
            <div className="page-in">
              <PublicCheckout
                eventId={event.id}
                eventSlug={event.slug}
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
          ) : (
            <div className="page-in mx-auto max-w-xl rounded-2xl border border-warning-500/30 bg-warning-50 p-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning-500/15">
                <svg className="h-6 w-6 text-warning-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="font-display text-title-m font-bold text-warning-700">Checkout no habilitado</h1>
              <p className="mt-2 text-body-s text-warning-700/80">Este evento esta en estado Proximamente. La venta online aun no comenzo.</p>
              <Link href={`/e/${event.slug}`} className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-warning-500/40 bg-white px-5 py-2 text-body-s font-semibold text-warning-700 transition hover:bg-warning-50">
                Ver el evento
              </Link>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
