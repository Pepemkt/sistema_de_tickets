import Link from "next/link";

type Props = {
  searchParams?: Promise<{ event?: string | string[]; order?: string | string[] }>;
};

function resolveValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function SuccessPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const eventSlug = resolveValue(params.event);
  const orderId = resolveValue(params.order);
  const eventUrl = eventSlug ? `/e/${encodeURIComponent(eventSlug)}` : "/";

  return (
    <div className="min-h-screen bg-slate-200/50 px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="p-8 sm:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <span className="text-4xl text-emerald-600">✓</span>
          </div>
          <h1 className="mt-5 text-center text-5xl font-semibold text-slate-900">Pago exitoso</h1>
          <p className="mt-3 text-center text-slate-600">Recibimos tu pago. Estamos esperando confirmacion final para habilitar tus tickets.</p>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Numero de orden</p>
                <p className="text-3xl font-semibold text-slate-900">{orderId || "Pendiente"}</p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Pendiente</span>
            </div>
          </section>

          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Los tickets se habilitan cuando Mercado Pago confirme el cobro. Te los enviaremos por email.
          </p>

          <div className="mt-6 text-center">
            <Link href={eventUrl} className="text-sm font-semibold text-blue-700 hover:underline">
              Volver al evento
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
