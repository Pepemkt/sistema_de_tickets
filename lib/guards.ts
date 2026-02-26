import { createHmac, timingSafeEqual } from "crypto";
import { resolveMercadoPagoWebhookSecret } from "@/lib/platform-config";

function safeHexEqual(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

function parseSignatureHeader(signatureHeader: string) {
  const values = new Map<string, string>();

  for (const part of signatureHeader.split(",")) {
    const chunk = part.trim();
    if (!chunk) continue;

    const [rawKey, ...rawValueParts] = chunk.split("=");
    if (!rawKey || rawValueParts.length === 0) continue;

    const key = rawKey.trim().toLowerCase();
    const value = rawValueParts.join("=").trim().replace(/^"|"$/g, "");
    if (key && value) {
      values.set(key, value);
    }
  }

  return values;
}

function extractWebhookDataId(searchParams: URLSearchParams, body: unknown) {
  if (typeof body !== "object" || body === null) {
    return searchParams.get("data.id") ?? searchParams.get("id") ?? "";
  }

  const parsedBody = body as {
    data?: { id?: string | number };
    id?: string | number;
  };

  return (
    searchParams.get("data.id") ??
    searchParams.get("id") ??
    parsedBody.data?.id?.toString() ??
    parsedBody.id?.toString() ??
    ""
  );
}

export async function verifyMercadoPagoWebhook(input: {
  request: Request;
  rawBody: string;
  body: unknown;
}) {
  const secret = await resolveMercadoPagoWebhookSecret();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const signatureHeader = input.request.headers.get("x-signature") ?? "";
  if (!signatureHeader) {
    return false;
  }

  // Backward-compatible mode: explicit exact match with configured secret.
  if (signatureHeader === secret) {
    return true;
  }

  const parsedSignature = parseSignatureHeader(signatureHeader);
  const providedHash = (parsedSignature.get("v1") ?? signatureHeader.replace(/^sha256=/i, "")).toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(providedHash)) {
    return false;
  }

  const url = new URL(input.request.url);
  const timestamp = parsedSignature.get("ts") ?? "";
  const requestId = input.request.headers.get("x-request-id") ?? "";
  const dataId = extractWebhookDataId(url.searchParams, input.body);

  const payloads = [
    timestamp && dataId && requestId ? `id:${dataId};request-id:${requestId};ts:${timestamp};` : "",
    timestamp && dataId ? `id:${dataId};ts:${timestamp};` : "",
    timestamp && requestId ? `request-id:${requestId};ts:${timestamp};` : "",
    input.rawBody
  ].filter(Boolean);

  for (const payload of payloads) {
    const expectedHash = createHmac("sha256", secret).update(payload).digest("hex");
    if (safeHexEqual(expectedHash, providedHash)) {
      return true;
    }
  }

  return false;
}
