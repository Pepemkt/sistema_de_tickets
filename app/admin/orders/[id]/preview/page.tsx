import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { centsToCurrency } from "@/lib/utils";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function OrderPreviewPage({ params }: Props) {
  await requirePageRole(["ADMIN"]);
  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      event: true,
      ticketType: true,
      tickets: true
    }
  });

  if (!order) notFound();

  return (
    <section className="space-y-6">
      <div className="panel p-6">
        <h1 className="section-title">Preview de compra simulada</h1>
        <p className="muted mt-1">Orden {order.id}</p>
      </div>

      <div className="panel p-6">
        <div className="grid gap-3 md:grid-cols-2">
          <p><span className="font-semibold">Evento:</span> {order.event.name}</p>
          <p><span className="font-semibold">Tipo:</span> {order.ticketType.name}</p>
          <p><span className="font-semibold">Comprador:</span> {order.buyerName}</p>
          <p><span className="font-semibold">Email:</span> {order.buyerEmail}</p>
          <p><span className="font-semibold">Cantidad:</span> {order.quantity}</p>
          <p><span className="font-semibold">Total:</span> {centsToCurrency(order.totalCents)}</p>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="text-lg font-semibold text-slate-900">Entradas emitidas</h2>
        <div className="mt-4 space-y-3">
          {order.tickets.map((ticket) => (
            <article key={ticket.id} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-700"><span className="font-semibold">Codigo:</span> {ticket.code}</p>
              <p className="text-sm text-slate-700"><span className="font-semibold">QR payload:</span> {ticket.qrPayload}</p>
              <div className="mt-3 flex gap-2">
                <Link className="btn-secondary" href={`/api/admin/orders/${order.id}/ticket/${ticket.id}/pdf`} target="_blank">
                  Ver PDF
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
