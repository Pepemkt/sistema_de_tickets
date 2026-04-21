import Link from "next/link";
import { VisitTracker } from "@/components/visit-tracker";

type Props = {
  searchParams?: Promise<{ event?: string | string[] }>;
};

function resolveEventSlug(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function PendingPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const eventSlug = resolveEventSlug(params.event);
  const eventUrl = eventSlug ? `/e/${encodeURIComponent(eventSlug)}` : null;

  return (
    <section className="panel p-7">
      <VisitTracker step="pending" eventSlug={eventSlug} />
      <h1 className="section-title text-warning-700">Pago pendiente</h1>
      <p className="mt-2 text-secondary">Tu pago esta en revision. Emitiremos las entradas cuando el cobro pase a estado aprobado.</p>
      {eventUrl ? (
        <div className="mt-5">
          <Link href={eventUrl} className="btn-primary">
            Volver al evento
          </Link>
        </div>
      ) : null}
    </section>
  );
}
