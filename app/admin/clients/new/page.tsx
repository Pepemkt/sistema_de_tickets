import Link from "next/link";
import { requirePageRole } from "@/lib/auth";
import { NewClientForm } from "@/components/new-client-form";

export default async function NewClientPage() {
  await requirePageRole(["ADMIN"]);

  return (
    <div className="space-y-5">

      {/* ── COMPACT HERO — backlink + hero block, no panel wrapper ── */}
      <header>
        <Link
          href="/admin/clients"
          className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-secondary transition-colors duration-150 hover:text-primary"
        >
          <svg
            className="h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Clientes
        </Link>

        <p
          className="text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color: "var(--brand-magenta)" }}
        >
          Merchants
        </p>
        <h1 className="mt-0.5 font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-primary">
          Nuevo cliente
        </h1>
        <p className="mt-1 text-[13px] text-secondary">
          Creá el partner. En el siguiente paso configurás su cuenta de Mercado Pago.
        </p>
      </header>

      {/* ── FORM ── */}
      <NewClientForm />

    </div>
  );
}
