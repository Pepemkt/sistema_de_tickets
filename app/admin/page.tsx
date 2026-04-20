import Link from "next/link";
import { db } from "@/lib/db";
import { getOrderKindBadgeClass, getOrderKindLabel, ORDER_KIND } from "@/lib/order-kind";
import { centsToCurrency } from "@/lib/utils";
import { requirePageRole } from "@/lib/auth";
import { getScopedEventIdsForViewer } from "@/lib/event-scope";

export default async function AdminDashboardPage() {
  const viewer = await requirePageRole(["ADMIN", "MANAGER"]);
  const scopedEventIds = await getScopedEventIdsForViewer(viewer);
  const eventWhere = scopedEventIds ? { id: { in: scopedEventIds } } : undefined;
  const orderWhere = scopedEventIds ? { eventId: { in: scopedEventIds } } : undefined;
  const commercialOrderWhere = { ...(orderWhere ?? {}), kind: { not: ORDER_KIND.INVITATION } };

  const [
    totalEvents,
    totalOrders,
    invitationOrders,
    commercialOrders,
    paidOrders,
    totalTickets,
    attendedTickets,
    paidRevenue,
    recentOrders
  ] = await Promise.all([
    db.event.count({ where: eventWhere }),
    db.order.count({ where: orderWhere }),
    db.order.count({ where: { ...(orderWhere ?? {}), kind: ORDER_KIND.INVITATION } }),
    db.order.count({ where: commercialOrderWhere }),
    db.order.count({ where: { ...commercialOrderWhere, status: "PAID" } }),
    db.ticket.count({ where: orderWhere ? { eventId: { in: scopedEventIds ?? [] } } : undefined }),
    db.ticket.count({ where: { ...(orderWhere ? { eventId: { in: scopedEventIds ?? [] } } : {}), NOT: { attendedAt: null } } }),
    db.order.aggregate({
      where: { ...commercialOrderWhere, status: "PAID" },
      _sum: { totalCents: true }
    }),
    db.order.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      where: orderWhere,
      include: {
        event: { select: { name: true } },
        ticketType: { select: { name: true } }
      }
    })
  ]);

  const isAdmin = viewer.role === "ADMIN";
  const activeUsers = isAdmin ? await db.user.count({ where: { isActive: true } }) : 0;
  const recentUsers = isAdmin
    ? await db.user.findMany({
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
    : [];

  const totalRevenueCents = paidRevenue._sum.totalCents ?? 0;
  const attendanceRate = totalTickets > 0 ? Math.round((attendedTickets / totalTickets) * 100) : 0;
  const paidRate = commercialOrders > 0 ? Math.round((paidOrders / commercialOrders) * 100) : 0;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <article className="panel p-4">
          <p className="text-overline text-secondary">Eventos</p>
          <p className="mt-1 text-title-m font-semibold text-primary">{totalEvents}</p>
        </article>
        <article className="panel p-4">
          <p className="text-overline text-secondary">Ordenes</p>
          <p className="mt-1 text-title-m font-semibold text-primary">{totalOrders}</p>
        </article>
        <article className="panel p-4">
          <p className="text-overline text-secondary">Ventas pagadas</p>
          <p className="mt-1 text-title-m font-semibold text-forest-700">{paidOrders}</p>
          <p className="text-caption text-secondary">{paidRate}% conversion</p>
        </article>
        <article className="panel p-4">
          <p className="text-overline text-secondary">Invitaciones</p>
          <p className="mt-1 text-title-m font-semibold text-coral-700">{invitationOrders}</p>
        </article>
        <article className="panel p-4">
          <p className="text-overline text-secondary">Ingresos</p>
          <p className="mt-1 text-title-m font-semibold text-primary">{centsToCurrency(totalRevenueCents)}</p>
        </article>
        <article className="panel p-4">
          <p className="text-overline text-secondary">Tickets</p>
          <p className="mt-1 text-title-m font-semibold text-primary">{totalTickets}</p>
        </article>
        <article className="panel p-4">
          <p className="text-overline text-secondary">Asistencia</p>
          <p className="mt-1 text-title-m font-semibold text-primary">{attendanceRate}%</p>
          <p className="text-caption text-secondary">
            {attendedTickets}/{totalTickets}
          </p>
        </article>
      </section>

      <section className={`grid gap-4 ${isAdmin ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
        <article className="panel p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-body-l font-semibold text-primary">Actividad de ordenes</h2>
              <p className="text-body-s text-secondary">Ultimas ordenes y su estado.</p>
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
                  <tr className="border-b border-soft text-left text-secondary">
                    <th className="pb-2 pr-3">Evento</th>
                    <th className="pb-2 pr-3">Ticket</th>
                    <th className="pb-2 pr-3">Canal</th>
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
                        <span className={`badge ${getOrderKindBadgeClass(order.kind)}`}>{getOrderKindLabel(order.kind)}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            order.status === "PAID"
                              ? "bg-success-50 text-success-700"
                              : order.status === "PENDING"
                                ? "bg-warning-50 text-warning-700"
                                : "bg-danger-50 text-danger-700"
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

        {isAdmin && (
          <article className="panel p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-body-l font-semibold text-primary">Usuarios del panel</h2>
                <p className="text-body-s text-secondary">Activos: {activeUsers}</p>
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
                  <div key={user.id} className="flex items-center justify-between rounded-sm border border-soft bg-sunken px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-body-s font-medium text-primary">{user.displayName ?? user.username}</p>
                      <p className="truncate text-caption text-secondary">
                        @{user.username} · {user.role}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.isActive ? "bg-success-50 text-success-700" : "bg-sunken text-primary border border-soft"
                        }`}
                      >
                        {user.isActive ? "Activo" : "Inactivo"}
                      </span>
                      <span className="text-caption text-secondary">
                        {new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(user.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        )}
      </section>
    </div>
  );
}
