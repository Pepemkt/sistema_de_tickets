import { resolveMercadoPagoAccessToken } from "@/lib/platform-config";

const MP_API = "https://api.mercadopago.com";

function isPublicReturnUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.startsWith("127.")
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function mpToken() {
  const token = await resolveMercadoPagoAccessToken();
  if (!token) {
    throw new Error("Credenciales de Mercado Pago no configuradas");
  }
  return token;
}

export type CreatePreferenceInput = {
  title: string;
  unitPrice: number;
  quantity: number;
  payerEmail: string;
  externalReference: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  webhookUrl: string;
};

export async function createPreference(input: CreatePreferenceInput) {
  const token = await mpToken();
  const hasPublicBackUrls =
    isPublicReturnUrl(input.successUrl) &&
    isPublicReturnUrl(input.failureUrl) &&
    isPublicReturnUrl(input.pendingUrl);

  const payload: Record<string, unknown> = {
    external_reference: input.externalReference,
    items: [
      {
        title: input.title,
        quantity: input.quantity,
        unit_price: input.unitPrice,
        currency_id: "ARS"
      }
    ],
    payer: {
      email: input.payerEmail
    },
    notification_url: input.webhookUrl
  };

  if (hasPublicBackUrls) {
    payload.back_urls = {
      success: input.successUrl,
      failure: input.failureUrl,
      pending: input.pendingUrl
    };
    payload.auto_return = "approved";
  }

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error creando preferencia MP: ${text}`);
  }

  return (await res.json()) as {
    id: string;
    init_point: string;
    sandbox_init_point?: string;
  };
}

export async function getPayment(paymentId: string) {
  const token = await mpToken();

  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error obteniendo pago MP: ${text}`);
  }

  return (await res.json()) as {
    id: number;
    status: string;
    external_reference: string | null;
  };
}
