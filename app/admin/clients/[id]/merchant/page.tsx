import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientMerchantForm } from "@/components/client-merchant-form";
import { requirePageRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getScopedEventIdsForViewer, requireViewerClientAccess } from "@/lib/event-scope";

type Props = {
  params: Promise<{ id: string }>;
};

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
          updatedAt: true
        }
      },
      events: {
        where: scopedEventIds ? { id: { in: scopedEventIds } } : undefined,
        orderBy: { startsAt: "asc" },
        select: {
          id: true,
          name: true,
          startsAt: true
        }
      }
    }
  });

  if (!client) {
    notFound();
  }

  const merchant = client.merchantAccounts[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">Cliente</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{client.name}</h1>
            <p className="mt-1 text-sm text-slate-600">Gestion operativa del merchant Mercado Pago para este cliente.</p>
          </div>
          <Link href="/admin/clients" className="btn-secondary">
            Volver a clientes
          </Link>
        </div>
      </section>

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
          updatedAt: merchant?.updatedAt?.toISOString() ?? null
        }}
        linkedEvents={client.events.map((event: { id: string; name: string; startsAt: Date }) => ({
          id: event.id,
          name: event.name,
          startsAt: event.startsAt.toISOString()
        }))}
      />
    </div>
  );
}
