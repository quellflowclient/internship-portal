import { createHmac, timingSafeEqual } from "node:crypto";

/** Signature = hex(HMAC-SHA256(secret, `${timestamp}.${rawBody}`)). Same scheme in scripts/apps-script/portal_sync.gs */
export function computeSignature(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

export const MAX_SKEW_SECONDS = 300;

export function verifySignature(opts: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  nowSeconds?: number;
}): { ok: true } | { ok: false; reason: string } {
  const { secret, timestamp, signature, rawBody } = opts;
  if (!timestamp || !signature) return { ok: false, reason: "missing signature headers" };
  if (!/^\d{10}$/.test(timestamp)) return { ok: false, reason: "bad timestamp" };
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > MAX_SKEW_SECONDS) return { ok: false, reason: "timestamp outside allowed window" };
  const given = signature.replace(/^sha256=/, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(given)) return { ok: false, reason: "bad signature format" };
  const expected = computeSignature(secret, timestamp, rawBody);
  const ok = timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
  return ok ? { ok: true } : { ok: false, reason: "signature mismatch" };
}
