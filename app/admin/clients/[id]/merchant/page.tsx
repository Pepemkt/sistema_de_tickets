import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientMerchantForm } from "@/components/client-merchant-form";
import { requirePageRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getScopedEventIdsForViewer, requireViewerClientAccess } from "@/lib/event-scope";

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────────── */
type Props = {
  params: Promise<{ id: string }>;
};

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────────────────────── */
export default async function ClientMerchantPage({ params }: Props) {
  const viewer = await requirePageRole(["ADMIN", "MANAGER"]);
  const scopedEventIds = await getScopedEventIdsForViewer(viewer);
  const { id } = await params;

  const clientReader = db as unknown as {
    client: {
      findUnique(args: {
        where: { id: string };
        select: {
          id: true;
          name: true;
          merchantAccounts: {
            where: { provider: "MERCADOPAGO" };
            take: 1;
            select: {
              id: true;
              status: true;
              accessToken: true;
              webhookSecret: true;
              commissionRateBps: true;
              updatedAt: true;
            };
          };
          events: {
            where?: { id: { in: string[] } };
            orderBy: { startsAt: "asc" };
            select: { id: true; name: true; startsAt: true };
          };
        };
      }): Promise<{
        id: string;
        name: string;
        merchantAccounts: Array<{
          id: string;
          status: "ACTIVE" | "DISABLED";
          accessToken: string;
          webhookSecret: string | null;
          commissionRateBps: number;
          updatedAt: Date;
        }>;
        events: Array<{ id: string; name: string; startsAt: Date }>;
      } | null>;
    };
  };

  await requireViewerClientAccess(viewer, id);

  const client = await clientReader.client.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      merchantAccounts: {
        where: { provider: "MERCADOPAGO" },
        take: 1,
        select: {
          id: true,
          status: true,
          accessToken: true,
          webhookSecret: true,
          commissionRateBps: true,
          updatedAt: true,
        },
      },
      events: {
        where: scopedEventIds ? { id: { in: scopedEventIds } } : undefined,
        orderBy: { startsAt: "asc" },
        select: { id: true, name: true, startsAt: true },
      },
    },
  });

  if (!client) {
    notFound();
  }

  const merchant = client.merchantAccounts[0] ?? null;

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
          {client.name}
        </h1>
        <p className="mt-1 text-[13px] text-secondary">
          Configuración de merchant
        </p>
      </header>

      {/* ── FORM ── */}
      <ClientMerchantForm
        clientId={client.id}
        clientName={client.name}
        viewerRole={viewer.role as "ADMIN" | "MANAGER"}
        initialMerchant={{
          merchantAccountId: merchant?.id ?? null,
          status: merchant?.status ?? "ACTIVE",
          hasAccessToken: Boolean(merchant?.accessToken?.trim()),
          hasWebhookSecret: Boolean(merchant?.webhookSecret?.trim()),
          commissionRateBps: merchant?.commissionRateBps ?? 500,
          updatedAt: merchant?.updatedAt?.toISOString() ?? null,
        }}
        linkedEvents={client.events.map((event: { id: string; name: string; startsAt: Date }) => ({
          id: event.id,
          name: event.name,
          startsAt: event.startsAt.toISOString(),
        }))}
      />

    </div>
  );
}
