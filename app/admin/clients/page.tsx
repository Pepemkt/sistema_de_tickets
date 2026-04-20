import Link from "next/link";
import { requirePageRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getScopedEventIdsForViewer } from "@/lib/event-scope";

export default async function AdminClientsPage() {
  const viewer = await requirePageRole(["ADMIN", "MANAGER"]);
  const scopedEventIds = await getScopedEventIdsForViewer(viewer);

  const clientReader = db as unknown as {
    client: {
      findMany(args: {
        where?: { events: { some: { id: { in: string[] } } } };
        orderBy: { name: "asc" };
        select: {
          id: true;
          name: true;
          merchantAccounts: {
            where: { provider: "MERCADOPAGO" };
            take: 1;
            select: { id: true; status: true; updatedAt: true };
          };
          events: {
            where?: { id: { in: string[] } };
            orderBy: { startsAt: "asc" };
            select: { id: true; name: true; startsAt: true };
          };
        };
      }): Promise<
        Array<{
          id: string;
          name: string;
          merchantAccounts: Array<{ id: string; status: "ACTIVE" | "DISABLED"; updatedAt: Date }>;
          events: Array<{ id: string; name: string; startsAt: Date }>;
        }>
      >;
    };
  };

  const clients = await clientReader.client.findMany({
    where: scopedEventIds
      ? {
          events: {
            some: { id: { in: scopedEventIds } }
          }
        }
      : undefined,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      merchantAccounts: {
        where: { provider: "MERCADOPAGO" },
        take: 1,
        select: {
          id: true,
          status: true,
          updatedAt: true
        }
      },
      events: {
        where: scopedEventIds ? { id: { in: scopedEventIds } } : undefined,
        orderBy: { startsAt: "asc" },
        select: {
          id: true,
          name: true,
          startsAt: true
        }
      }
    }
  });

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Merchants por cliente</h1>
            <p className="mt-1 text-sm text-slate-600">
              ADMIN y MANAGER pueden operar el merchant por cliente. MANAGER solo visualiza la comision configurada.
            </p>
          </div>
          {viewer.role === "ADMIN" ? (
            <Link href="/admin/clients/new" className="btn-primary">
              Nuevo cliente
            </Link>
          ) : null}
        </div>
      </section>

      {clients.length === 0 ? (
        <section className="panel p-8">
          <p className="text-slate-600">No hay clientes visibles con eventos vinculados todavia.</p>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {clients.map((client) => {
            const merchant = client.merchantAccounts[0] ?? null;

            return (
              <article key={client.id} className="panel p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{client.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {merchant ? `Merchant ${merchant.status === "ACTIVE" ? "activo" : "deshabilitado"}` : "Sin merchant configurado"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/clients/${client.id}/merchant`} className="btn-primary">
                      Merchant
                    </Link>
                    <Link href={`/admin/clients/${client.id}/liquidations`} className="btn-secondary">
                      Liquidaciones
                    </Link>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Eventos visibles</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{client.events.length}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Ultima actualizacion</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {merchant?.updatedAt
                        ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(merchant.updatedAt)
                        : "Pendiente"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {client.events.slice(0, 3).map((event) => (
                    <div key={event.id} className="rounded-xl border border-slate-200 px-3 py-2">
                      <p className="text-sm font-medium text-slate-900">{event.name}</p>
                      <p className="text-xs text-slate-500">{new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(event.startsAt)}</p>
                    </div>
                  ))}
                  {client.events.length > 3 ? <p className="text-xs text-slate-500">+ {client.events.length - 3} eventos mas</p> : null}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
