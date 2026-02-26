import Link from "next/link";
import { db } from "@/lib/db";
import { centsToCurrency } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const [
    totalEvents,
    totalOrders,
    paidOrders,
    totalTickets,
    attendedTickets,
    paidRevenue,
    activeUsers,
    recentOrders,
    recentUsers
  ] = await Promise.all([
    db.event.count(),
    db.order.count(),
    db.order.count({ where: { status: "PAID" } }),
    db.ticket.count(),
    db.ticket.count({ where: { NOT: { attendedAt: null } } }),
    db.order.aggregate({
      where: { status: "PAID" },
      _sum: { totalCents: true }
    }),
    db.user.count({ where: { isActive: true } }),
    db.order.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        event: { select: { name: true } },
        ticketType: { select: { name: true } }
      }
    }),
    db.user.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    })
  ]);

  const totalRevenueCents = paidRevenue._sum.totalCents ?? 0;
  const attendanceRate = totalTickets > 0 ? Math.round((attendedTickets / totalTickets) * 100) : 0;
  const paidRate = totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 100) : 0;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <article className="panel p-4">
          <p className="text-xs uppercase text-slate-500">Eventos</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{totalEvents}</p>
        </article>
        <article className="panel p-4">
          <p className="text-xs uppercase text-slate-500">Ordenes</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{totalOrders}</p>
        </article>
        <article className="panel p-4">
          <p className="text-xs uppercase text-slate-500">Pagadas</p>
          <p className="mt-1 text-2xl font-semibold text-blue-700">{paidOrders}</p>
          <p className="text-xs text-slate-500">{paidRate}% conversion</p>
        </article>
        <article className="panel p-4">
          <p className="text-xs uppercase text-slate-500">Ingresos</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{centsToCurrency(totalRevenueCents)}</p>
        </article>
        <article className="panel p-4">
          <p className="text-xs uppercase text-slate-500">Tickets</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{totalTickets}</p>
        </article>
        <article className="panel p-4">
          <p className="text-xs uppercase text-slate-500">Asistencia</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{attendanceRate}%</p>
          <p className="text-xs text-slate-500">
            {attendedTickets}/{totalTickets}
          </p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Actividad de ordenes</h2>
              <p className="text-sm text-slate-500">Ultimas compras y su estado.</p>
            </div>
            <Link href="/admin/orders" className="btn-secondary">
              Ver todas
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <p className="muted">Todavia no hay ordenes registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-2 pr-3">Evento</th>
                    <th className="pb-2 pr-3">Ticket</th>
                    <th className="pb-2 pr-3">Estado</th>
                    <th className="pb-2 pr-3">Total</th>
                    <th className="pb-2 pr-3">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-slate-100">
                      <td className="py-2.5 pr-3 text-slate-800">{order.event.name}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{order.ticketType.name}</td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            order.status === "PAID"
                              ? "bg-emerald-100 text-emerald-700"
                              : order.status === "PENDING"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-slate-800">{centsToCurrency(order.totalCents)}</td>
                      <td className="py-2.5 pr-3 text-slate-500">
                        {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(order.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="panel p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Usuarios del panel</h2>
              <p className="text-sm text-slate-500">Activos: {activeUsers}</p>
            </div>
            <Link href="/admin/users" className="btn-secondary">
              Gestionar
            </Link>
          </div>

          {recentUsers.length === 0 ? (
            <p className="muted">No hay usuarios creados.</p>
          ) : (
            <div className="space-y-2">
              {recentUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{user.displayName ?? user.username}</p>
                    <p className="truncate text-xs text-slate-500">
                      @{user.username} · {user.role}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {user.isActive ? "Activo" : "Inactivo"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(user.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
