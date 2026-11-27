/**
 * POST /api/leads/import – Google Form → leads (docs/19 P1, DB-2).
 * Signed by the Apps Script: x-qf-timestamp + x-qf-signature = hex(HMAC-SHA256(IMPORT_SECRET, `${ts}.${body}`)).
 * Upserts on form_response_id (re-submits update the same lead) and returns the portal code per response.
 */
import { NextResponse } from "next/server";
import { verifySignature } from "@/lib/hmac";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseImportBody, toUpsertArgs } from "@/lib/leads/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Reads the body as text, stopping as soon as it passes the limit (null = too large). */
async function readLimited(req: Request, limit: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > limit) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(req: Request) {
  let secret: string;
  try {
    secret = serverEnv().IMPORT_SECRET;
  } catch {
    console.error("[leads/import] IMPORT_SECRET / service key not configured");
    return json({ ok: false, error: "Import is not configured" }, 500);
  }

  const rawBody = await readLimited(req, MAX_BYTES);
  if (rawBody === null) return json({ ok: false, error: "Body larger than 2 MB" }, 413);

  const sig = verifySignature({
    secret,
    timestamp: req.headers.get("x-qf-timestamp"),
    signature: req.headers.get("x-qf-signature"),
    rawBody,
  });
  if (!sig.ok) return json({ ok: false, error: "Unauthorized" }, 401);

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: "Body is not valid JSON" }, 422);
  }

  const parsed = parseImportBody(body);
  if (!parsed.ok) return json({ ok: false, error: "Invalid payload", issues: parsed.issues }, 422);

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    console.error("[leads/import] Supabase URL / service key not configured");
    return json({ ok: false, error: "Import is not configured" }, 500);
  }
  const codes: { form_response_id: string; code: string }[] = [];
  const failed: { form_response_id: string; error: string }[] = [];

  // Sequential on purpose: each call takes a number from the code sequence; the free tier dislikes bursts.
  for (const item of parsed.items) {
    const args = toUpsertArgs(item);
    const { data, error } = await supabase.rpc("upsert_form_lead", args);
    if (error || typeof data !== "string") {
      console.error("[leads/import] upsert failed", args.p_form_response_id, error?.message);
      failed.push({ form_response_id: args.p_form_response_id, error: error?.message ?? "No code returned" });
    } else {
      codes.push({ form_response_id: args.p_form_response_id, code: data });
    }
  }

  // Upserts are idempotent, so the Apps Script can safely resend the whole request on failure.
  if (failed.length) return json({ ok: false, error: "Some rows were not saved", codes, failed }, 500);
  return json({ ok: true, codes });
}
