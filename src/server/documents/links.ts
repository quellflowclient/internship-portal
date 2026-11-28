/**
 * Verify address printed in every QR code (docs/20 E-6): org_settings.verify_base_url, else NEXT_PUBLIC_SITE_URL,
 * else the address the request came in on. Pure helpers plus one header reader for server components.
 */
import "server-only";
import { headers } from "next/headers";

export function verifyBase(orgBase: string | null | undefined, origin: string | null | undefined): string {
  return (orgBase?.trim() || process.env.NEXT_PUBLIC_SITE_URL || origin || "").replace(/\/+$/, "");
}

/** `<base>/v/<token>`; drafts (no token yet) point at the manual check page. */
export function verifyUrlFor(base: string, token: string | null | undefined): string {
  return token ? `${base}/v/${token}` : `${base}/verify`;
}

/** The site origin of the current request (server components). */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
