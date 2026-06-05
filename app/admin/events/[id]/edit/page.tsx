import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { EventForm } from "@/components/event-form";
import { EventClientPicker } from "@/components/event-client-picker";
import { requirePageRole } from "@/lib/auth";
import { requireViewerEventAccess } from "@/lib/event-scope";
import { normalizeRegistrationFieldDefinitions } from "@/lib/registration-fields";

/* ─────────────────────────────────────────────────────────────────────────────
   CSS — server-safe (no "use client")
───────────────────────────────────────────────────────────────────────────── */
const PAGE_STYLES = `
@keyframes eev-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes eev-row-in {
  from { opacity: 0; transform: translateX(-4px); }
  to   { opacity: 1; transform: translateX(0); }
}

.eev-hero    { animation: eev-fade-up 0.48s var(--ease-tactile) 0.02s both; }
.eev-meta    { animation: eev-fade-up 0.48s var(--ease-tactile) 0.10s both; }
.eev-form    { animation: eev-fade-up 0.48s var(--ease-tactile) 0.18s both; }

/* Section divider — same as ef- pattern */
.eev-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0 12px;
  border-top: 1px solid var(--border-soft);
}
.eev-divider:first-of-type {
  border-top: none;
  padding-top: 12px;
}
.eev-divider-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--clr-arena-400);
  white-space: nowrap;
  font-family: var(--font-display);
}
.eev-divider-line {
  flex: 1;
  height: 1px;
  background: var(--border-soft);
}

/* Mono URL chip */
.eev-url-chip {
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.02em;
  word-break: break-all;
  line-height: 1.6;
  color: var(--text-secondary);
}

/* Action pill — ghost */
.eev-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--border-soft);
  background: var(--bg-surface);
  color: var(--text-secondary);
  text-decoration: none;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}
.eev-pill:hover {
  background: var(--bg-sunken);
  border-color: var(--border-strong);
  color: var(--text-primary);
}
.eev-pill-accent {
  border-color: rgba(91,33,182,0.20);
  background: rgba(91,33,182,0.04);
  color: var(--brand-violet);
}
.eev-pill-accent:hover {
  background: rgba(91,33,182,0.10);
  border-color: rgba(91,33,182,0.35);
}

/* Status badge */
.eev-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 9999px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid transparent;
  white-space: nowrap;
}
`;

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────────────────────── */
type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditEventPage({ params }: Props) {
  const viewer = await requirePageRole(["ADMIN", "MANAGER"]);
  const { id } = await params;

  const eventReader = db as unknown as {
    event: {
      findUnique(args: {
        where: { id: string };
        include: {
          client: { select: { id: true; name: true } };
          ticketTypes: {
            orderBy: { priceCents: "asc" };
            include: { _count: { select: { tickets: true } } };
          };
        };
      }): Promise<
        | {
            id: string;
            slug: string;
            name: string;
            featuredTag: string | null;
            description: string | null;
            featureTags: unknown;
            heroImageUrl: string | null;
            venue: string | null;
            status: "ACTIVE" | "UPCOMING" | "DRAFT";
            platformCommissionRateBps: number;
            registrationFieldsJson: unknown;
            startsAt: Date;
            endsAt: Date | null;
            client: { id: string; name: string } | null;
            ticketTypes: Array<{
              id: string;
              name: string;
              priceCents: number;
              stock: number;
              saleMode: "PUBLIC" | "COUPON_ONLY" | "HIDDEN";
              maxPerOrder: number | null;
              maxPerEmail: number | null;
              _count: { tickets: number };
            }>;
          }
        | null
      >;
    };
  };

  await requireViewerEventAccess(viewer, id);

  const event = await eventReader.event.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          name: true
        }
      },
      ticketTypes: {
        orderBy: { priceCents: "asc" },
        include: {
          _count: {
            select: { tickets: true }
          }
        }
      }
    }
  });

  if (!event) {
    notFound();
  }

  const clientListReader = db as unknown as {
    client: {
      findMany(args: { orderBy: { name: "asc" }; select: { id: true; name: true } }): Promise<Array<{ id: string; name: string }>>;
    };
  };
  const availableClients =
    viewer.role === "ADMIN"
      ? await clientListReader.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : [];

  const baseUrl        = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
  const publicPath     = `/e/${event.slug}`;
  const publicEventUrl = baseUrl ? `${baseUrl}${publicPath}` : publicPath;

  /* ── Status badge helpers ── */
  const STATUS_LABEL: Record<string, string> = {
    ACTIVE:   "Activo",
    UPCOMING: "Próximamente",
    DRAFT:    "Borrador",
  };
  const STATUS_STYLE: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    ACTIVE:   { bg: "var(--clr-success-50)", text: "var(--clr-success-700)", border: "rgba(31,174,74,0.28)", dot: "var(--clr-success-500)" },
    UPCOMING: { bg: "var(--clr-coral-50)", text: "var(--brand-magenta)", border: "rgba(219,30,122,0.25)", dot: "var(--brand-magenta)" },
    DRAFT:    { bg: "var(--bg-sunken)", text: "var(--text-muted)", border: "var(--border-soft)", dot: "var(--clr-arena-400)" },
  };
  const statusStyle = STATUS_STYLE[event.status] ?? STATUS_STYLE.DRAFT;

  return (
    <>
      <style>{PAGE_STYLES}</style>

      <div className="space-y-5">

        {/* ── HERO BAR — bare div, 1px border-bottom, no wrapping panel ── */}
        <div
          className="eev-hero flex flex-wrap items-start justify-between gap-4 pb-5"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div>
            {/* Back link — inside hero, above overline */}
            <Link
              href="/admin/events"
              className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-secondary transition-colors duration-150 hover:text-primary"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Eventos
            </Link>

            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--brand-violet)" }}
            >
              Gestión de eventos
            </p>
            <h1 className="mt-1 font-display text-[1.625rem] font-extrabold leading-tight tracking-tight text-primary">
              Editar evento<span style={{ color: "var(--brand-magenta)" }}>.</span>
            </h1>
            <p className="mt-1 text-[12px] text-secondary">
              {event.name}
            </p>
          </div>

          {/* Right: status + quick-action pills */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {/* Status badge */}
            <span
              className="eev-status-badge"
              style={{
                background: statusStyle.bg,
                color: statusStyle.text,
                borderColor: statusStyle.border,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: statusStyle.dot }}
                aria-hidden="true"
              />
              {STATUS_LABEL[event.status] ?? event.status}
            </span>

            {/* Template link */}
            <Link href={`/admin/events/${event.id}/template`} className="eev-pill">
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Diseño PDF
            </Link>

            {/* Public page */}
            <Link
              href={publicPath}
              className="eev-pill"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Ver pública
            </Link>
          </div>
        </div>

        {/* ── META SURFACE: link compartible + modelo comercial ── */}
        <div
          className="eev-meta rounded-xl border border-[color:var(--border-soft)] bg-surface"
          style={{ padding: "0 20px" }}
        >

          {/* ── Link compartible ── */}
          <div className="eev-divider" style={{ borderTop: "none", paddingTop: 16 }}>
            <span className="eev-divider-label">Link compartible</span>
            <span className="eev-divider-line" aria-hidden="true" />
          </div>
          <div
            className="flex items-start gap-3 rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-sunken)] px-4 py-3 mb-4"
          >
            <p className="eev-url-chip flex-1">{publicEventUrl}</p>
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-muted opacity-40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </div>

          {/* ── Modelo comercial ── */}
          <div className="eev-divider">
            <span className="eev-divider-label">Modelo comercial</span>
            <span className="eev-divider-line" aria-hidden="true" />
          </div>

          {event.client ? (
            <div className="flex flex-wrap items-start justify-between gap-4 pb-5">
              <div>
                <p className="text-[13px] font-semibold text-primary">
                  Merchant delegado por cliente
                </p>
                <p className="mt-0.5 text-[12px] text-secondary">
                  {event.client.name}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/clients/${event.client.id}/merchant`}
                  className="eev-pill eev-pill-accent"
                >
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Gestionar merchant
                </Link>
                <Link
                  href={`/admin/events/${event.id}/liquidation`}
                  className="eev-pill eev-pill-accent"
                >
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  Liquidaciones
                </Link>
              </div>
            </div>
          ) : (
            <p className="pb-4 text-[13px] text-secondary">
              <span className="font-semibold" style={{ color: "var(--brand-magenta)" }}>Flujo global temporal activo.</span>{" "}
              Este evento aún no tiene cliente merchant asociado.
            </p>
          )}

          {/* Admin-only client picker */}
          {viewer.role === "ADMIN" && (
            <div
              className={`pb-5 ${event.client ? "border-t border-[color:var(--border-soft)] pt-4" : ""}`}
            >
              <EventClientPicker
                eventId={event.id}
                currentClientId={event.client?.id ?? null}
                currentClientName={event.client?.name ?? null}
                clients={availableClients}
              />
            </div>
          )}

        </div>

        {/* ── FORM ─────────────────────────────────────────────────────────── */}
        <div className="eev-form">
          <EventForm
            mode="edit"
            eventId={event.id}
            initial={{
              name: event.name,
              featuredTag: event.featuredTag ?? "",
              description: event.description ?? "",
              featureTags: Array.isArray(event.featureTags) ? event.featureTags.map((item) => String(item)) : [],
              heroImageUrl: event.heroImageUrl ?? "",
              venue: event.venue ?? "",
              status: event.status,
              platformCommissionRateBps: event.platformCommissionRateBps,
              registrationFields: normalizeRegistrationFieldDefinitions(event.registrationFieldsJson),
              startsAt: event.startsAt.toISOString(),
              endsAt: event.endsAt ? event.endsAt.toISOString() : "",
              ticketTypes: event.ticketTypes.map((item) => ({
                id: item.id,
                name: item.name,
                price: item.priceCents / 100,
                stock: item.stock,
                saleMode: item.saleMode,
                maxPerOrder: item.maxPerOrder ?? null,
                maxPerEmail: item.maxPerEmail ?? null,
                soldCount: item._count.tickets
              }))
            }}
            viewerRole={viewer.role}
          />
        </div>

      </div>
    </>
  );
}
