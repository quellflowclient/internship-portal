import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * Salted SHA-256 of the visitor's IP for verification_scans (docs/19 §8 P6 step 4).
 * The raw IP is never stored or shown; null when no IP is known.
 */
export async function visitorIpHash(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "";
  if (!ip) return null;
  const salt = process.env.IP_HASH_SALT || process.env.NEXT_PUBLIC_SUPABASE_URL || "quellflow";
  return createHash("sha256").update(`${ip}|${salt}`).digest("hex");
}
