import Link from "next/link";
import { db } from "@/lib/db";
import { centsToCurrency } from "@/lib/utils";

export default async function AdminOrdersPage() {
  const orders = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      event: true,
      ticketType: true,
      tickets: true
    },
    take: 200
  });

  const paidOrders = orders.filter((order) => order.status === "PAID");
  const pendingOrders = orders.filter((order) => order.status === "PENDING");
  const revenue = paidOrders.reduce((sum, order) => sum + order.totalCents, 0);
  const totalTickets = orders.reduce((sum, order) => sum + order.tickets.length, 0);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <article className="panel p-4">
          <p className="muted">Ordenes</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{orders.length}</p>
        </article>
        <article className="panel p-4">
          <p className="muted">Pagadas</p>
          <p className="mt-1 text-3xl font-semibold text-blue-700">{paidOrders.length}</p>
        </article>
        <article className="panel p-4">
          <p className="muted">Pendientes</p>
          <p className="mt-1 text-3xl font-semibold text-amber-600">{pendingOrders.length}</p>
        </article>
        <article className="panel p-4">
          <p className="muted">Ingresos</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{centsToCurrency(revenue)}</p>
          <p className="text-xs text-slate-500">Tickets emitidos: {totalTickets}</p>
        </article>
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-semibold text-slate-900">Ultimas ordenes</h2>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-3">Fecha</th>
                <th className="pb-2 pr-3">Evento</th>
                <th className="pb-2 pr-3">Comprador</th>
                <th className="pb-2 pr-3">Tipo</th>
                <th className="pb-2 pr-3">Cantidad</th>
                <th className="pb-2 pr-3">Total</th>
                <th className="pb-2 pr-3">Estado</th>
                <th className="pb-2 pr-3">Tickets</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-slate-100">
                  <td className="py-3 pr-3 text-slate-600">{new Date(order.createdAt).toLocaleString("es-AR")}</td>
                  <td className="py-3 pr-3">
                    <p className="font-medium text-slate-800">{order.event.name}</p>
                    <p className="text-xs text-slate-500">{order.id}</p>
                  </td>
                  <td className="py-3 pr-3">
                    <p className="text-slate-700">{order.buyerName}</p>
                    <p className="text-xs text-slate-500">{order.buyerEmail}</p>
                  </td>
                  <td className="py-3 pr-3 text-slate-700">{order.ticketType.name}</td>
                  <td className="py-3 pr-3 text-slate-700">{order.quantity}</td>
                  <td className="py-3 pr-3 text-slate-700">{centsToCurrency(order.totalCents)}</td>
                  <td className="py-3 pr-3">
                    <span className={`badge ${order.status === "PAID" ? "border-blue-200 bg-blue-50 text-blue-700" : ""}`}>{order.status}</span>
                  </td>
                  <td className="py-3 pr-3">
                    {order.tickets.length > 0 ? (
                      <Link href={`/admin/orders/${order.id}/preview`} className="btn-secondary">
                        Ver ({order.tickets.length})
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-500">Sin emitir</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
