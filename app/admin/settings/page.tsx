"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { EMAIL_TEMPLATE_TOKENS } from "@/lib/email-template";
import {
  buildEmailTemplateFromBuilder,
  defaultEmailTemplateBuilder,
  normalizeEmailTemplateBuilder,
  type EmailTemplateBuilderConfig
} from "@/lib/email-template-builder";

type MercadoPagoState = {
  hasAccessToken: boolean;
  hasWebhookSecret: boolean;
  updatedAt: string | null;
};

type SmtpState = {
  configured: boolean;
  host: string;
  port: number;
  user: string;
  from: string;
  secure: boolean;
  hasPassword: boolean;
  updatedAt: string | null;
};

type BrandingState = {
  sidebarLogoUrl: string | null;
};

type EmailTemplateState = {
  builder: EmailTemplateBuilderConfig;
  tokens: readonly string[];
  updatedAt: string | null;
};

type CheckoutFeeItemState = {
  id: string;
  name: string;
  mode: "FIXED" | "PERCENT";
  value: number;
  enabled: boolean;
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function getErrorMessage(data: Record<string, unknown>, fallback: string) {
  return typeof data.error === "string" && data.error.trim() ? data.error : fallback;
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingMp, setSavingMp] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingEmailTemplate, setSavingEmailTemplate] = useState(false);
  const [savingCheckoutFees, setSavingCheckoutFees] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [mpState, setMpState] = useState<MercadoPagoState>({
    hasAccessToken: false,
    hasWebhookSecret: false,
    updatedAt: null
  });

  const [smtpState, setSmtpState] = useState<SmtpState>({
    configured: false,
    host: "",
    port: 587,
    user: "",
    from: "",
    secure: false,
    hasPassword: false,
    updatedAt: null
  });
  const [brandingState, setBrandingState] = useState<BrandingState>({
    sidebarLogoUrl: null
  });

  const [accessToken, setAccessToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [clearAccessToken, setClearAccessToken] = useState(false);
  const [clearWebhookSecret, setClearWebhookSecret] = useState(false);

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [clearSmtpPassword, setClearSmtpPassword] = useState(false);
  const [sidebarLogoUrl, setSidebarLogoUrl] = useState("");

  const [emailTemplateState, setEmailTemplateState] = useState<EmailTemplateState>({
    builder: defaultEmailTemplateBuilder,
    tokens: EMAIL_TEMPLATE_TOKENS,
    updatedAt: null
  });
  const [emailBuilder, setEmailBuilder] = useState<EmailTemplateBuilderConfig>(defaultEmailTemplateBuilder);
  const [checkoutFeeItems, setCheckoutFeeItems] = useState<CheckoutFeeItemState[]>([]);
  const [checkoutFeesUpdatedAt, setCheckoutFeesUpdatedAt] = useState<string | null>(null);

  async function fetchJsonSafe(url: string) {
    const response = await fetch(url);
    const text = await response.text();

    let data: Record<string, unknown> = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Respuesta no valida en ${url}`);
      }
    }

    if (!response.ok) {
      throw new Error(getErrorMessage(data, `Error cargando ${url}`));
    }

    return data;
  }

  async function parseJsonResponseSafe(response: Response, fallbackError: string) {
    const text = await response.text();
    let data: Record<string, unknown> = {};

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(fallbackError);
      }
    }

    return { ok: response.ok, data };
  }

  useEffect(() => {
    Promise.all([
      fetchJsonSafe("/api/admin/settings/mercadopago"),
      fetchJsonSafe("/api/admin/settings/smtp"),
      fetchJsonSafe("/api/admin/settings/branding"),
      fetchJsonSafe("/api/admin/settings/email-template"),
      fetchJsonSafe("/api/admin/settings/checkout-fees")
    ])
      .then(([mpData, smtpData, brandingData, emailData, checkoutFeesData]) => {
        const normalizedMpState: MercadoPagoState = {
          hasAccessToken: asBoolean(mpData.hasAccessToken),
          hasWebhookSecret: asBoolean(mpData.hasWebhookSecret),
          updatedAt: typeof mpData.updatedAt === "string" ? mpData.updatedAt : null
        };
        const normalizedSmtpState: SmtpState = {
          configured: asBoolean(smtpData.configured),
          host: asString(smtpData.host),
          port: asNumber(smtpData.port, 465),
          user: asString(smtpData.user),
          from: asString(smtpData.from),
          secure: asBoolean(smtpData.secure),
          hasPassword: asBoolean(smtpData.hasPassword),
          updatedAt: typeof smtpData.updatedAt === "string" ? smtpData.updatedAt : null
        };

        setMpState(normalizedMpState);
        setSmtpState(normalizedSmtpState);
        setSmtpHost(normalizedSmtpState.host);
        setSmtpPort(normalizedSmtpState.port);
        setSmtpUser(normalizedSmtpState.user);
        setSmtpFrom(normalizedSmtpState.from);
        setSmtpSecure(normalizedSmtpState.secure);
        setBrandingState({
          sidebarLogoUrl: typeof brandingData.sidebarLogoUrl === "string" ? brandingData.sidebarLogoUrl : null
        });
        setSidebarLogoUrl(typeof brandingData.sidebarLogoUrl === "string" ? brandingData.sidebarLogoUrl : "");

        const builder = normalizeEmailTemplateBuilder(emailData.builder ?? defaultEmailTemplateBuilder);
        setEmailTemplateState({
          builder,
          tokens: Array.isArray(emailData.tokens) ? emailData.tokens.map(String) : EMAIL_TEMPLATE_TOKENS,
          updatedAt: typeof emailData.updatedAt === "string" ? emailData.updatedAt : null
        });
        setEmailBuilder(builder);
        setCheckoutFeeItems(Array.isArray(checkoutFeesData.items) ? (checkoutFeesData.items as CheckoutFeeItemState[]) : []);
        setCheckoutFeesUpdatedAt(typeof checkoutFeesData.updatedAt === "string" ? checkoutFeesData.updatedAt : null);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "No se pudo cargar la configuracion");
      })
      .finally(() => setLoading(false));
  }, []);

  async function onLogoFileChange(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Selecciona un archivo de imagen valido");
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.readAsDataURL(file);
    });

    setSidebarLogoUrl(dataUrl);
  }

  async function onSubmitMercadoPago(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: { mercadoPagoAccessToken?: string; mercadoPagoWebhookSecret?: string } = {};

    if (clearAccessToken || accessToken.trim()) {
      payload.mercadoPagoAccessToken = clearAccessToken ? "" : accessToken.trim();
    }

    if (clearWebhookSecret || webhookSecret.trim()) {
      payload.mercadoPagoWebhookSecret = clearWebhookSecret ? "" : webhookSecret.trim();
    }

    if (Object.keys(payload).length === 0) {
      setMessage("No hay cambios para guardar en Mercado Pago");
      return;
    }

    setSavingMp(true);
    setMessage(null);

    const res = await fetch("/api/admin/settings/mercadopago", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const { ok, data } = await parseJsonResponseSafe(res, "Respuesta invalida guardando Mercado Pago");
    setSavingMp(false);

    if (!ok) {
      setMessage(getErrorMessage(data, "No se pudieron guardar las credenciales de Mercado Pago"));
      return;
    }

    setMpState({
      hasAccessToken: asBoolean(data.hasAccessToken),
      hasWebhookSecret: asBoolean(data.hasWebhookSecret),
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null
    });
    setAccessToken("");
    setWebhookSecret("");
    setClearAccessToken(false);
    setClearWebhookSecret(false);
    setMessage("Mercado Pago actualizado correctamente");
  }

  async function onSubmitSmtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSavingSmtp(true);
    setMessage(null);

    const res = await fetch("/api/admin/settings/smtp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass: clearSmtpPassword ? "" : smtpPass || undefined,
        smtpFrom,
        smtpSecure
      })
    });

    const { ok, data } = await parseJsonResponseSafe(res, "Respuesta invalida guardando SMTP");
    setSavingSmtp(false);

    if (!ok) {
      setMessage(getErrorMessage(data, "No se pudo guardar SMTP"));
      return;
    }

    setSmtpState({
      configured: asBoolean(data.configured),
      host: asString(data.host),
      port: asNumber(data.port, 465),
      user: asString(data.user),
      from: asString(data.from),
      secure: asBoolean(data.secure),
      hasPassword: asBoolean(data.hasPassword),
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null
    });
    setSmtpPass("");
    setClearSmtpPassword(false);
    setMessage("SMTP actualizado correctamente");
  }

  async function onSubmitBranding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSavingBranding(true);
    setMessage(null);

    const res = await fetch("/api/admin/settings/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sidebarLogoUrl: sidebarLogoUrl.trim() || null
      })
    });

    const { ok, data } = await parseJsonResponseSafe(res, "Respuesta invalida guardando branding");
    setSavingBranding(false);

    if (!ok) {
      setMessage(getErrorMessage(data, "No se pudo guardar branding"));
      return;
    }

    setBrandingState({
      sidebarLogoUrl: typeof data.sidebarLogoUrl === "string" ? data.sidebarLogoUrl : null
    });
    setSidebarLogoUrl(typeof data.sidebarLogoUrl === "string" ? data.sidebarLogoUrl : "");
    setMessage("Logo lateral actualizado");
  }

  async function onSubmitEmailTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingEmailTemplate(true);
    setMessage(null);

    const res = await fetch("/api/admin/settings/email-template", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ builder: emailBuilder })
    });

    const { ok, data } = await parseJsonResponseSafe(res, "Respuesta invalida guardando plantilla");
    setSavingEmailTemplate(false);

    if (!ok) {
      setMessage(getErrorMessage(data, "No se pudo guardar la plantilla de email"));
      return;
    }

    const builder = normalizeEmailTemplateBuilder(data.builder ?? emailBuilder);
    setEmailTemplateState({
      builder,
      tokens: Array.isArray(data.tokens) ? data.tokens.map(String) : EMAIL_TEMPLATE_TOKENS,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null
    });
    setEmailBuilder(builder);
    setMessage("Plantilla de email actualizada correctamente");
  }

  async function onSubmitCheckoutFees(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingCheckoutFees(true);
    setMessage(null);

    const res = await fetch("/api/admin/settings/checkout-fees", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: checkoutFeeItems })
    });

    const { ok, data } = await parseJsonResponseSafe(res, "Respuesta invalida guardando cargos");
    setSavingCheckoutFees(false);

    if (!ok) {
      setMessage(getErrorMessage(data, "No se pudieron guardar los cargos"));
      return;
    }

    setCheckoutFeeItems(Array.isArray(data.items) ? (data.items as CheckoutFeeItemState[]) : []);
    setCheckoutFeesUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : null);
    setMessage("Cargos de checkout actualizados");
  }

  function addCheckoutFeeItem() {
    setCheckoutFeeItems((current) => [...current, { id: crypto.randomUUID(), name: "", mode: "PERCENT", value: 0, enabled: true }]);
  }

  function removeCheckoutFeeItem(id: string) {
    setCheckoutFeeItems((current) => current.filter((item) => item.id !== id));
  }

  function updateCheckoutFeeItem(id: string, key: keyof CheckoutFeeItemState, value: string | number | boolean) {
    setCheckoutFeeItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        return { ...item, [key]: value };
      })
    );
  }

  function resetEmailTemplate() {
    setEmailBuilder(defaultEmailTemplateBuilder);
  }

  function updateBuilderField<K extends keyof EmailTemplateBuilderConfig>(key: K, value: EmailTemplateBuilderConfig[K]) {
    setEmailBuilder((current) => ({ ...current, [key]: value }));
  }

  const liveTemplate = useMemo(() => buildEmailTemplateFromBuilder(emailBuilder), [emailBuilder]);
  const previewVars: Record<string, string> = {
    buyerName: "Ana Perez",
    buyerEmail: "ana@email.com",
    eventName: "Festival Sunset 2026",
    eventDate: "viernes, 3 de abril de 2026, 20:00",
    eventVenue: "Hipodromo de Palermo",
    orderId: "ORD-9F8A27",
    quantity: "2",
    ticketCount: "2",
    totalAmount: "$ 25.000,00",
    supportEmail: smtpFrom || "tickets@tudominio.com",
    year: String(new Date().getFullYear())
  };

  const previewSubject = liveTemplate.subject.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => previewVars[key] ?? "");
  const previewHtml = liveTemplate.html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => previewVars[key] ?? "");

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <h2 className="section-title">Mercado Pago</h2>
        <p className="muted mt-1">Gestiona token y webhook secret desde admin.</p>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Cargando configuracion...</p>
        ) : (
          <>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-500">Access token</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{mpState.hasAccessToken ? "Configurado" : "No configurado"}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-500">Webhook secret</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{mpState.hasWebhookSecret ? "Configurado" : "No configurado"}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-500">Ultima actualizacion</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {mpState.updatedAt ? new Date(mpState.updatedAt).toLocaleString("es-AR") : "Sin cambios"}
                </p>
              </article>
            </div>

            <form onSubmit={onSubmitMercadoPago} className="mt-6 space-y-4">
              <div>
                <label className="label">Nuevo Access Token</label>
                <input className="field" type="password" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder="APP_USR-..." />
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={clearAccessToken} onChange={(event) => setClearAccessToken(event.target.checked)} />
                  Limpiar access token actual
                </label>
              </div>

              <div>
                <label className="label">Nuevo Webhook Secret</label>
                <input className="field" type="password" value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder="secret webhook" />
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={clearWebhookSecret} onChange={(event) => setClearWebhookSecret(event.target.checked)} />
                  Limpiar webhook secret actual
                </label>
              </div>

              <button className="btn-primary" disabled={savingMp}>{savingMp ? "Guardando..." : "Guardar Mercado Pago"}</button>
            </form>
          </>
        )}
      </section>

      <section className="panel p-6">
        <h2 className="section-title">Branding lateral</h2>
        <p className="muted mt-1">Cambia el logo que aparece a la izquierda de Aiderbrand en la sidebar.</p>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Cargando configuracion...</p>
        ) : (
          <form onSubmit={onSubmitBranding} className="mt-6 space-y-4">
            <div>
              <label className="label">Logo (URL o data:image)</label>
              <input
                className="field"
                value={sidebarLogoUrl}
                onChange={(event) => setSidebarLogoUrl(event.target.value)}
                placeholder="https://... o data:image/png;base64,..."
              />
            </div>

            <div>
              <label className="label">Subir imagen</label>
              <input
                className="field"
                type="file"
                accept="image/*"
                onChange={(event) => void onLogoFileChange(event.target.files?.[0] ?? null)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button className="btn-primary" disabled={savingBranding}>
                {savingBranding ? "Guardando..." : "Guardar logo lateral"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setSidebarLogoUrl("")}>
                Quitar logo
              </button>
            </div>

            {brandingState.sidebarLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brandingState.sidebarLogoUrl} alt="Logo lateral actual" className="h-12 w-12 rounded-lg border border-slate-200 object-cover" />
            ) : (
              <p className="text-sm text-slate-500">Sin logo personalizado (se usa logo por defecto).</p>
            )}
          </form>
        )}
      </section>

      <section className="panel p-6">
        <h2 className="section-title">SMTP / Emails</h2>
        <p className="muted mt-1">Configura envio de tickets por email desde la interfaz.</p>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Cargando configuracion...</p>
        ) : (
          <>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-500">Estado</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{smtpState.configured ? "Configurado" : "Incompleto"}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-500">Servidor</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{smtpState.host || "-"}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-500">Puerto</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{smtpState.port || "-"}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-500">Ultima actualizacion</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{smtpState.updatedAt ? new Date(smtpState.updatedAt).toLocaleString("es-AR") : "Sin cambios"}</p>
              </article>
            </div>

            <form onSubmit={onSubmitSmtp} className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">SMTP host</label>
                <input className="field" value={smtpHost} onChange={(event) => setSmtpHost(event.target.value)} placeholder="mail.aiderbrand.com" required />
              </div>

              <div>
                <label className="label">SMTP puerto</label>
                <input className="field" type="number" min={1} max={65535} value={smtpPort} onChange={(event) => setSmtpPort(Number(event.target.value))} required />
              </div>

              <div>
                <label className="label">SMTP usuario</label>
                <input className="field" value={smtpUser} onChange={(event) => setSmtpUser(event.target.value)} placeholder="tickets@aiderbrand.com" required />
              </div>

              <div>
                <label className="label">SMTP password</label>
                <input className="field" type="password" value={smtpPass} onChange={(event) => setSmtpPass(event.target.value)} placeholder={smtpState.hasPassword ? "******** (dejar vacio para conservar)" : "Password SMTP"} />
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={clearSmtpPassword} onChange={(event) => setClearSmtpPassword(event.target.checked)} />
                  Limpiar password actual
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="label">From</label>
                <input className="field" value={smtpFrom} onChange={(event) => setSmtpFrom(event.target.value)} placeholder="Tickets <tickets@aiderbrand.com>" required />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={smtpSecure} onChange={(event) => setSmtpSecure(event.target.checked)} />
                  Usar conexion segura (SSL/TLS)
                </label>
              </div>

              <div className="md:col-span-2">
                <button className="btn-primary" disabled={savingSmtp}>{savingSmtp ? "Guardando..." : "Guardar SMTP"}</button>
              </div>
            </form>
          </>
        )}
      </section>

      <section className="panel p-6">
        <h2 className="section-title">Cargos del checkout</h2>
        <p className="muted mt-1">Define recargos configurables por item (monto fijo o porcentaje). Si no hay items activos, no se agrega ningun recargo.</p>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Cargando configuracion...</p>
        ) : (
          <form onSubmit={onSubmitCheckoutFees} className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Ultima actualizacion: {checkoutFeesUpdatedAt ? new Date(checkoutFeesUpdatedAt).toLocaleString("es-AR") : "Sin cambios"}
            </div>

            <div className="space-y-3">
              {checkoutFeeItems.map((item) => (
                <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <label className="label">Nombre</label>
                    <input className="field" value={item.name} onChange={(event) => updateCheckoutFeeItem(item.id, "name", event.target.value)} required />
                  </div>
                  <div className="md:col-span-3">
                    <label className="label">Tipo</label>
                    <select className="field" value={item.mode} onChange={(event) => updateCheckoutFeeItem(item.id, "mode", event.target.value as "FIXED" | "PERCENT")}>
                      <option value="PERCENT">Porcentaje (%)</option>
                      <option value="FIXED">Monto fijo (ARS)</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Valor</label>
                    <input
                      className="field"
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.value}
                      onChange={(event) => updateCheckoutFeeItem(item.id, "value", Number(event.target.value))}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Activo</label>
                    <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={item.enabled} onChange={(event) => updateCheckoutFeeItem(item.id, "enabled", event.target.checked)} />
                      Habilitado
                    </label>
                  </div>
                  <div className="md:col-span-1 md:pt-6">
                    <button type="button" className="btn-secondary w-full" onClick={() => removeCheckoutFeeItem(item.id)}>
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={addCheckoutFeeItem}>
                Agregar item
              </button>
              <button className="btn-primary" disabled={savingCheckoutFees}>
                {savingCheckoutFees ? "Guardando..." : "Guardar cargos"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="panel p-6">
        <h2 className="section-title">Plantilla Base de Email (edicion de textos)</h2>
        <p className="muted mt-1">No necesitas HTML. Edita los textos y mantenemos el diseño profesional base.</p>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Cargando plantilla...</p>
        ) : (
          <>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-500">Variables disponibles</p>
                <p className="mt-2 text-sm font-medium text-slate-700">
                  {emailTemplateState.tokens.map((token) => `{{${token}}}`).join(" · ")}
                </p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-500">Ultima actualizacion</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  {emailTemplateState.updatedAt ? new Date(emailTemplateState.updatedAt).toLocaleString("es-AR") : "Sin cambios"}
                </p>
              </article>
            </div>

            <form onSubmit={onSubmitEmailTemplate} className="mt-6 space-y-4">
              <div>
                <label className="label">Asunto</label>
                <input className="field" value={emailBuilder.subjectTemplate} onChange={(event) => updateBuilderField("subjectTemplate", event.target.value)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Marca (arriba)</label>
                  <input className="field" value={emailBuilder.brandName} onChange={(event) => updateBuilderField("brandName", event.target.value)} />
                </div>
                <div>
                  <label className="label">Titulo header</label>
                  <input className="field" value={emailBuilder.badgeText} onChange={(event) => updateBuilderField("badgeText", event.target.value)} />
                </div>
              </div>

              <div>
                <label className="label">Titulo principal</label>
                <input className="field" value={emailBuilder.headline} onChange={(event) => updateBuilderField("headline", event.target.value)} />
              </div>

              <div>
                <label className="label">Saludo</label>
                <input className="field" value={emailBuilder.greetingText} onChange={(event) => updateBuilderField("greetingText", event.target.value)} />
              </div>

              <div>
                <label className="label">Texto principal</label>
                <textarea className="field min-h-28" value={emailBuilder.bodyText} onChange={(event) => updateBuilderField("bodyText", event.target.value)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Titulo bloque detalle</label>
                  <input className="field" value={emailBuilder.detailsTitle} onChange={(event) => updateBuilderField("detailsTitle", event.target.value)} />
                </div>
                <div>
                  <label className="label">Texto soporte</label>
                  <input className="field" value={emailBuilder.supportText} onChange={(event) => updateBuilderField("supportText", event.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="label">Label Evento</label>
                  <input className="field" value={emailBuilder.labelEvent} onChange={(event) => updateBuilderField("labelEvent", event.target.value)} />
                </div>
                <div>
                  <label className="label">Label Fecha</label>
                  <input className="field" value={emailBuilder.labelDate} onChange={(event) => updateBuilderField("labelDate", event.target.value)} />
                </div>
                <div>
                  <label className="label">Label Lugar</label>
                  <input className="field" value={emailBuilder.labelVenue} onChange={(event) => updateBuilderField("labelVenue", event.target.value)} />
                </div>
                <div>
                  <label className="label">Label Entradas</label>
                  <input className="field" value={emailBuilder.labelTickets} onChange={(event) => updateBuilderField("labelTickets", event.target.value)} />
                </div>
                <div>
                  <label className="label">Label Total</label>
                  <input className="field" value={emailBuilder.labelTotal} onChange={(event) => updateBuilderField("labelTotal", event.target.value)} />
                </div>
                <div>
                  <label className="label">Label Orden</label>
                  <input className="field" value={emailBuilder.labelOrder} onChange={(event) => updateBuilderField("labelOrder", event.target.value)} />
                </div>
              </div>

              <div>
                <label className="label">Footer legal</label>
                <input className="field" value={emailBuilder.footerText} onChange={(event) => updateBuilderField("footerText", event.target.value)} />
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" disabled={savingEmailTemplate}>
                  {savingEmailTemplate ? "Guardando..." : "Guardar textos de plantilla"}
                </button>
                <button type="button" className="btn-secondary" onClick={resetEmailTemplate}>
                  Restaurar texto base
                </button>
              </div>
            </form>

            <div className="mt-8 space-y-3">
              <h3 className="text-lg font-semibold text-slate-900">Preview</h3>
              <p className="text-sm text-slate-600">
                Asunto: <span className="font-semibold text-slate-800">{previewSubject}</span>
              </p>
              <iframe
                title="Preview email tickets"
                className="h-[560px] w-full rounded-xl border border-slate-200 bg-white"
                sandbox=""
                srcDoc={previewHtml}
              />
            </div>
          </>
        )}
      </section>

      {message && <p className="text-sm text-slate-600">{message}</p>}
    </div>
  );
}
