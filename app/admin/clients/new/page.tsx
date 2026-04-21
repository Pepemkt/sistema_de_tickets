import Link from "next/link";
import { requirePageRole } from "@/lib/auth";
import { NewClientForm } from "@/components/new-client-form";

export default async function NewClientPage() {
  await requirePageRole(["ADMIN"]);

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-overline font-semibold uppercase tracking-[0.1em] text-[color:var(--brand-magenta)]">Clientes</p>
            <h1 className="mt-1 font-display text-title-xl font-bold text-primary">Nuevo cliente</h1>
            <p className="mt-1 text-body-s text-secondary">
              Despues de crearlo vas a poder cargar su cuenta de Mercado Pago y asignarlo a uno o varios eventos.
            </p>
          </div>
          <Link href="/admin/clients" className="btn-secondary">
            Volver a clientes
          </Link>
        </div>
      </section>

      <NewClientForm />
    </div>
  );
}
