import { db } from "@/lib/db";
import { centsToCurrency } from "@/lib/utils";

function groupSalesByDay(orders: Array<{ createdAt: Date; totalCents: number; status: string }>) {
  const map = new Map<string, number>();

  for (const order of orders) {
    if (order.status !== "PAID") continue;
    const key = new Date(order.createdAt).toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + order.totalCents);
  }

  return Array.from(map.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export default async function AnalyticsPage() {
  const [events, orders] = await Promise.all([
    db.event.findMany({
      include: {
        _count: { select: { tickets: true } },
        tickets: { where: { NOT: { attendedAt: null } }, select: { id: true } },
        orders: { where: { status: "PAID" }, select: { totalCents: true } }
      }
    }),
    db.order.findMany({
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, totalCents: true, status: true }
    })
  ]);

  const salesByDay = groupSalesByDay(orders).slice(-20);
  const maxDay = Math.max(...salesByDay.map((d) => d.total), 1);

  const eventRows = events
    .map((event) => {
      const revenue = event.orders.reduce((sum, order) => sum + order.totalCents, 0);
      const sold = event._count.tickets;
      const attended = event.tickets.length;
      const attendanceRate = sold > 0 ? Math.round((attended / sold) * 100) : 0;
      return {
        id: event.id,
        name: event.name,
        revenue,
        sold,
        attended,
        attendanceRate
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const maxRevenue = Math.max(...eventRows.map((row) => row.revenue), 1);

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <h2 className="text-lg font-semibold text-slate-900">Ventas por dia</h2>
        <p className="muted mt-1">Ultimos movimientos de ingresos aprobados.</p>

        <div className="mt-4 space-y-2">
          {salesByDay.length === 0 && <p className="muted">Aun no hay ventas pagadas.</p>}
          {salesByDay.map((day) => (
            <div key={day.date} className="grid grid-cols-[120px_1fr_120px] items-center gap-3">
              <span className="text-xs text-slate-500">{day.date}</span>
              <div className="h-3 rounded-full bg-slate-200">
                <div className="h-3 rounded-full bg-blue-600" style={{ width: `${Math.max((day.total / maxDay) * 100, 2)}%` }} />
              </div>
              <span className="text-right text-sm font-medium text-slate-700">{centsToCurrency(day.total)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-semibold text-slate-900">Rendimiento por evento</h2>
        <p className="muted mt-1">Comparativo de ingresos, tickets vendidos y asistencia.</p>

        <div className="mt-4 space-y-4">
          {eventRows.length === 0 && <p className="muted">No hay eventos para analizar.</p>}
          {eventRows.map((row) => (
            <article key={row.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-800">{row.name}</h3>
                <p className="text-sm font-semibold text-blue-700">{centsToCurrency(row.revenue)}</p>
              </div>

              <div className="mt-3 h-3 rounded-full bg-slate-200">
                <div className="h-3 rounded-full bg-blue-600" style={{ width: `${Math.max((row.revenue / maxRevenue) * 100, 2)}%` }} />
              </div>

              <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                <p>Tickets vendidos: <span className="font-semibold text-slate-800">{row.sold}</span></p>
                <p>Asistentes: <span className="font-semibold text-slate-800">{row.attended}</span></p>
                <p>Asistencia: <span className="font-semibold text-slate-800">{row.attendanceRate}%</span></p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
