import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { normalizeTicketTemplate } from "@/lib/ticket-template";
import { TemplateEditor } from "@/components/template-editor";
import { requirePageRole } from "@/lib/auth";
import { requireViewerEventAccess } from "@/lib/event-scope";

/* ─────────────────────────────────────────────────────────────────────────────
   CSS — server-safe (no "use client")
───────────────────────────────────────────────────────────────────────────── */
const PAGE_STYLES = `
@keyframes tpl-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.tpl-hero   { animation: tpl-fade-up 0.48s var(--ease-tactile) 0.02s both; }
.tpl-editor { animation: tpl-fade-up 0.48s var(--ease-tactile) 0.12s both; }

/* Layout badge */
.tpl-layout-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border: 1px solid rgba(139,92,246,0.25);
  background: rgba(139,92,246,0.07);
  color: var(--brand-violet);
}
`;

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────────────────────── */
type Props = {
  params: Promise<{ id: string }>;
};

export default async function EventTemplatePage({ params }: Props) {
  const viewer = await requirePageRole(["ADMIN", "MANAGER"]);
  const { id } = await params;

  await requireViewerEventAccess(viewer, id);

  const event = await db.event.findUnique({
    where: { id },
    include: {
      ticketTypes: {
        orderBy: { priceCents: "asc" },
        take: 1
      }
    }
  });

  if (!event) {
    notFound();
  }

  return (
    <>
      <style>{PAGE_STYLES}</style>

      <div className="space-y-5">

        {/* ── HERO BAR — bare div, 1px border-bottom, no wrapping panel ── */}
        <div
          className="tpl-hero flex flex-wrap items-start justify-between gap-4 pb-5"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div>
            {/* Back link — inside hero, above overline */}
            <Link
              href={`/admin/events/${event.id}/edit`}
              className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-secondary transition-colors duration-150 hover:text-primary"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Evento
            </Link>

            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--brand-violet)" }}
            >
              Plantilla de ticket
            </p>
            <h1 className="mt-1 font-display text-[1.625rem] font-extrabold leading-tight tracking-tight text-primary">
              Diseño PDF<span style={{ color: "var(--brand-magenta)" }}>.</span>
            </h1>
            <p className="mt-1 text-[12px] text-secondary">
              {event.name}
            </p>
          </div>

          {/* Right: tool badge */}
          <div className="flex items-center gap-2 pt-0.5">
            <span className="tpl-layout-badge">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
              Editor visual
            </span>
          </div>
        </div>

        {/* ── EDITOR ───────────────────────────────────────────────────────── */}
        <div className="tpl-editor">
          <TemplateEditor
            eventId={event.id}
            eventName={event.name}
            venue={event.venue ?? "Lugar por confirmar"}
            startsAt={event.startsAt.toISOString()}
            ticketTypeName={event.ticketTypes[0]?.name ?? "General"}
            initialTemplate={normalizeTicketTemplate(event.templateJson)}
          />
        </div>

      </div>
    </>
  );
}
