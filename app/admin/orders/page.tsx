import Link from "next/link";
import { db } from "@/lib/db";
import { getOrderKindBadgeClass, getOrderKindLabel, isCommercialOrderKind, ORDER_KIND } from "@/lib/order-kind";
import { centsToCurrency } from "@/lib/utils";
import { DeleteOrderButton } from "@/components/delete-order-button";
import { requirePageRole } from "@/lib/auth";
import { getScopedEventIdsForViewer } from "@/lib/event-scope";

export default async function AdminOrdersPage() {
  const viewer = await requirePageRole(["ADMIN", "MANAGER"]);
  const scopedEventIds = await getScopedEventIdsForViewer(viewer);

  const orders = await db.order.findMany({
    where: scopedEventIds ? { eventId: { in: scopedEventIds } } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      event: true,
      ticketType: true,
      emailDeliveries: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      tickets: {
        select: {
          id: true,
          attendedAt: true
        }
      }
    },
    take: 200
  });

  const paidOrders = orders.filter((order) => order.status === "PAID" && isCommercialOrderKind(order.kind));
  const invitationOrders = orders.filter((order) => order.kind === ORDER_KIND.INVITATION);
  const pendingOrders = orders.filter((order) => order.status === "PENDING");
  const revenue = paidOrders.reduce((sum, order) => sum + order.totalCents, 0);
  const totalTickets = orders.reduce((sum, order) => sum + order.tickets.length, 0);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-5">
        <article className="panel p-4">
          <p className="muted">Ordenes</p>
          <p className="mt-1 text-title-l font-semibold text-primary">{orders.length}</p>
        </article>
        <article className="panel p-4">
          <p className="muted">Ventas pagadas</p>
          <p className="mt-1 text-title-l font-semibold text-forest-700">{paidOrders.length}</p>
        </article>
        <article className="panel p-4">
          <p className="muted">Invitaciones</p>
          <p className="mt-1 text-title-l font-semibold text-coral-700">{invitationOrders.length}</p>
        </article>
        <article className="panel p-4">
          <p className="muted">Pendientes</p>
          <p className="mt-1 text-title-l font-semibold text-warning-700">{pendingOrders.length}</p>
        </article>
        <article className="panel p-4">
          <p className="muted">Ingresos</p>
          <p className="mt-1 text-title-l font-semibold text-primary">{centsToCurrency(revenue)}</p>
          <p className="text-caption text-secondary">Tickets emitidos: {totalTickets}</p>
        </article>
      </section>

      <section className="panel p-5">
        <h2 className="text-body-l font-semibold text-primary">Ultimas ordenes</h2>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-soft text-left text-secondary">
                <th className="pb-2 pr-3">Fecha</th>
                <th className="pb-2 pr-3">Evento</th>
                <th className="pb-2 pr-3">Comprador</th>
                <th className="pb-2 pr-3">Canal</th>
                <th className="pb-2 pr-3">Tipo</th>
                <th className="pb-2 pr-3">Cantidad</th>
                <th className="pb-2 pr-3">Total</th>
                <th className="pb-2 pr-3">Estado</th>
                <th className="pb-2 pr-3">Tickets</th>
                <th className="pb-2 pr-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const attendedTickets = order.tickets.filter((ticket) => ticket.attendedAt !== null).length;
                const hasAttendedTickets = attendedTickets > 0;

                return (
                  <tr key={order.id} className="border-b border-soft">
                    <td className="py-3 pr-3 text-secondary">{new Date(order.createdAt).toLocaleString("es-AR")}</td>
                    <td className="py-3 pr-3">
                      <p className="font-medium text-primary">{order.event.name}</p>
                      <p className="text-caption text-muted">{order.id}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <p className="text-secondary">{order.buyerName}</p>
                      <p className="text-caption text-muted">{order.buyerEmail}</p>
                      <p className="text-caption text-muted">{order.buyerPhone ?? "Sin telefono"}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`badge ${getOrderKindBadgeClass(order.kind)}`}>{getOrderKindLabel(order.kind)}</span>
                    </td>
                    <td className="py-3 pr-3 text-secondary">{order.ticketType.name}</td>
                    <td className="py-3 pr-3 text-secondary">{order.quantity}</td>
                    <td className="py-3 pr-3 text-secondary">{centsToCurrency(order.totalCents)}</td>
                    <td className="py-3 pr-3">
                      <span className={`badge ${order.status === "PAID" ? "border-info-500 bg-info-50 text-info-700" : ""}`}>{order.status}</span>
                    </td>
                    <td className="py-3 pr-3">
                      {order.tickets.length > 0 ? (
                        <Link href={`/admin/orders/${order.id}/preview`} className="btn-secondary">
                          Ver ({order.tickets.length})
                        </Link>
                      ) : (
                        <span className="text-caption text-muted">Sin emitir</span>
                      )}
                      <p className="mt-1 text-caption text-muted">
                        Email:{" "}
                        {order.emailDeliveries[0]
                          ? order.emailDeliveries[0].status === "SENT"
                            ? `Enviado (${new Date(order.emailDeliveries[0].createdAt).toLocaleString("es-AR")})`
                            : `Fallo (${new Date(order.emailDeliveries[0].createdAt).toLocaleString("es-AR")})`
                          : "Sin envios"}
                      </p>
                    </td>
                    <td className="py-3 pr-3">
                      <DeleteOrderButton orderId={order.id} hasAttendedTickets={hasAttendedTickets} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-caption text-secondary">
          Solo se pueden eliminar ordenes sin tickets validados en acceso.
        </p>
      </section>
    </div>
  );
}
