"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { commissionBpsToPercent } from "@/lib/platform-commission";

type MerchantFormState = {
  merchantAccountId: string | null;
  status: "ACTIVE" | "DISABLED";
  hasAccessToken: boolean;
  hasWebhookSecret: boolean;
  commissionRateBps: number;
  updatedAt: string | null;
};

type LinkedEvent = {
  id: string;
  name: string;
  startsAt: string;
};

type Props = {
  clientId: string;
  clientName: string;
  viewerRole: "ADMIN" | "MANAGER";
  initialMerchant: MerchantFormState;
  linkedEvents: LinkedEvent[];
};

function getErrorMessage(data: Record<string, unknown>, fallback: string) {
  return typeof data.error === "string" && data.error.trim() ? data.error : fallback;
}

export function ClientMerchantForm({ clientId, clientName, viewerRole, initialMerchant, linkedEvents }: Props) {
  const router = useRouter();
  const canEditCommission = viewerRole === "ADMIN";
  const [merchant, setMerchant] = useState(initialMerchant);
  const [status, setStatus] = useState<"ACTIVE" | "DISABLED">(initialMerchant.status);
  const [commissionPercent, setCommissionPercent] = useState(commissionBpsToPercent(initialMerchant.commissionRateBps));
  const [accessToken, setAccessToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [clearAccessToken, setClearAccessToken] = useState(false);
  const [clearWebhookSecret, setClearWebhookSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const payload: Record<string, unknown> = {
      status
    };

    if (clearAccessToken || accessToken.trim()) {
      payload.accessToken = clearAccessToken ? "" : accessToken.trim();
    }

    if (clearWebhookSecret || webhookSecret.trim()) {
      payload.webhookSecret = clearWebhookSecret ? "" : webhookSecret.trim();
    }

    if (canEditCommission) {
      payload.commissionPercent = commissionPercent;
    }

    const response = await fetch(`/api/admin/clients/${clientId}/merchant`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    setSaving(false);

    if (!response.ok) {
      setMessage(getErrorMessage(data, "No se pudo guardar la configuracion merchant"));
      return;
    }

    const nextMerchant: MerchantFormState = {
      merchantAccountId: typeof data.merchantAccountId === "string" ? data.merchantAccountId : merchant.merchantAccountId,
      status: data.status === "DISABLED" ? "DISABLED" : "ACTIVE",
      hasAccessToken: Boolean(data.hasAccessToken),
      hasWebhookSecret: Boolean(data.hasWebhookSecret),
      commissionRateBps: typeof data.commissionRateBps === "number" ? data.commissionRateBps : merchant.commissionRateBps,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null
    };

    setMerchant(nextMerchant);
    setStatus(nextMerchant.status);
    setCommissionPercent(commissionBpsToPercent(nextMerchant.commissionRateBps));
    setAccessToken("");
    setWebhookSecret("");
    setClearAccessToken(false);
    setClearWebhookSecret(false);
    setMessage(`Merchant de ${clientName} actualizado correctamente`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <article>
            <p className="text-xs uppercase tracking-wide text-slate-500">Cliente</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{clientName}</p>
          </article>
          <article>
            <p className="text-xs uppercase tracking-wide text-slate-500">Merchant</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{merchant.merchantAccountId ?? "Pendiente de alta"}</p>
          </article>
          <article>
            <p className="text-xs uppercase tracking-wide text-slate-500">Estado</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{merchant.status === "ACTIVE" ? "Activo" : "Deshabilitado"}</p>
          </article>
          <article>
            <p className="text-xs uppercase tracking-wide text-slate-500">Comision plataforma</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{commissionBpsToPercent(merchant.commissionRateBps).toFixed(2)}%</p>
          </article>
        </div>
      </section>

      <form onSubmit={onSubmit} className="panel space-y-5 p-6">
        <div>
          <h2 className="section-title">Configuracion Mercado Pago</h2>
          <p className="muted mt-1">
            Este merchant se aplica a los eventos del cliente. Si no hay client asociado en el evento, el checkout sigue usando el flujo global actual.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Estado operativo</label>
            <select className="field" value={status} onChange={(event) => setStatus(event.target.value as "ACTIVE" | "DISABLED")}>
              <option value="ACTIVE">Activo</option>
              <option value="DISABLED">Deshabilitado</option>
            </select>
          </div>

          <div>
            <label className="label">Comision plataforma (%)</label>
            <input
              className="field"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={commissionPercent}
              onChange={(event) => setCommissionPercent(Number(event.target.value))}
              disabled={!canEditCommission}
            />
            <p className="mt-1 text-xs text-slate-500">
              {canEditCommission
                ? "ADMIN define la comision base para liquidaciones delegadas del cliente."
                : "MANAGER puede ver la comision, pero no modificarla."}
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="label">Access Token Mercado Pago</label>
            <input
              className="field"
              type="password"
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              placeholder={merchant.hasAccessToken ? "Ya configurado. Ingresa uno nuevo para reemplazarlo." : "APP_USR-..."}
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={clearAccessToken} onChange={(event) => setClearAccessToken(event.target.checked)} />
              Limpiar access token actual
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="label">Webhook Secret</label>
            <input
              className="field"
              type="password"
              value={webhookSecret}
              onChange={(event) => setWebhookSecret(event.target.value)}
              placeholder={merchant.hasWebhookSecret ? "Ya configurado. Ingresa uno nuevo para reemplazarlo." : "Secret del webhook de Mercado Pago"}
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={clearWebhookSecret} onChange={(event) => setClearWebhookSecret(event.target.checked)} />
              Limpiar webhook secret actual
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={saving}>
            {saving ? "Guardando..." : "Guardar merchant"}
          </button>
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        </div>
      </form>

      <section className="panel p-6">
        <h3 className="text-lg font-semibold text-slate-900">Eventos vinculados</h3>
        <p className="muted mt-1">Los eventos con este cliente usan merchant delegado. Los demas quedan temporalmente en el flujo global.</p>

        {linkedEvents.length === 0 ? (
          <p className="muted mt-4">Todavia no hay eventos visibles vinculados a este cliente.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {linkedEvents.map((event) => (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{event.name}</p>
                  <p className="text-xs text-slate-500">{new Date(event.startsAt).toLocaleString("es-AR")}</p>
                </div>
                <a href={`/admin/events/${event.id}/edit`} className="btn-secondary">
                  Ver evento
                </a>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
