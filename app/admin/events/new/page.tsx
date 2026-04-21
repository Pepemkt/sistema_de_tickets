import Link from "next/link";
import { EventForm } from "@/components/event-form";
import { requirePageRole } from "@/lib/auth";

export default async function NewEventPage() {
  const viewer = await requirePageRole(["ADMIN", "MANAGER"]);

  return (
    <div className="space-y-5">

      {/* ── COMPACT HERO — backlink folded in, no separate breadcrumb row ── */}
      <header>
        {/* Back link — lives inside the hero itself */}
        <Link
          href="/admin/events"
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
          Eventos
        </Link>

        <p
          className="text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color: "var(--brand-magenta)" }}
        >
          Gestión de eventos
        </p>
        <h1 className="mt-0.5 font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-primary">
          Crear evento
        </h1>
        <p className="mt-1 text-[13px] text-secondary">
          Completá los datos del nuevo evento. Podés guardarlo como borrador.
        </p>
      </header>

      {/* ── FORM ─────────────────────────────────────────────────────────── */}
      <EventForm mode="create" viewerRole={viewer.role} />

    </div>
  );
}
