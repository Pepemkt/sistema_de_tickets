import { createHmac, timingSafeEqual } from "crypto";

function secret() {
  const value = process.env.QR_SIGNING_SECRET;
  if (!value) {
    throw new Error("QR_SIGNING_SECRET no configurado");
  }
  return value;
}

export function signTicketCode(code: string) {
  return createHmac("sha256", secret()).update(code).digest("hex").slice(0, 24);
}

export function buildQrPayload(code: string) {
  return `TICKET:${code}:${signTicketCode(code)}`;
}

export function parseQrPayload(payload: string) {
  const parts = payload.trim().split(":");
  if (parts.length !== 3 || parts[0] !== "TICKET") {
    return null;
  }

  return {
    code: parts[1],
    signature: parts[2]
  };
}

export function verifyTicketPayload(payload: string) {
  const parsed = parseQrPayload(payload);
  if (!parsed) {
    return null;
  }

  const expected = signTicketCode(parsed.code);
  if (expected.length !== parsed.signature.length) {
    return null;
  }
  const valid = timingSafeEqual(Buffer.from(expected), Buffer.from(parsed.signature));

  return valid ? parsed.code : null;
}
