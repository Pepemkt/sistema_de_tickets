import Link from "next/link";

type Props = {
  searchParams: { event?: string | string[] } | Promise<{ event?: string | string[] }>;
};

function resolveEventSlug(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function FailurePage({ searchParams }: Props) {
  const params = await searchParams;
  const eventSlug = resolveEventSlug(params.event);
  const eventUrl = eventSlug ? `/e/${encodeURIComponent(eventSlug)}` : null;

  return (
    <section className="panel p-7">
      <h1 className="section-title text-red-700">Pago rechazado</h1>
      <p className="mt-2 text-slate-700">No se pudo completar la operacion. Puedes volver al evento e intentarlo nuevamente.</p>
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
