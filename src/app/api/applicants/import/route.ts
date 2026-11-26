import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { verifySignature } from "@/lib/hmac";
import { importBodySchema, toApplicantRow } from "@/lib/applicants/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2_000_000;

/**
 * POST /api/applicants/import
 * Called by the Google Apps Script on every form submission (and for backfill).
 * Headers: x-qf-timestamp (unix seconds), x-qf-signature (sha256=<hex HMAC of `${ts}.${body}`>).
 * Idempotent: upsert by form_response_id (Google's id, never reused); never touches status/notes.
 * A candidate_code clash with a *different* response (e.g. after a form reset) fails loudly (409)
 * instead of silently merging two people.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "payload too large" }, { status: 413 });

  let secret: string;
  try {
    secret = serverEnv().IMPORT_SECRET;
  } catch {
    return NextResponse.json({ error: "import not configured" }, { status: 503 });
  }

  const check = verifySignature({
    secret,
    timestamp: request.headers.get("x-qf-timestamp"),
    signature: request.headers.get("x-qf-signature"),
    rawBody: raw,
  });
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = importBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed", issues: parsed.error.issues.slice(0, 5) }, { status: 422 });
  }

  const supabase = createAdminClient();
  const { data: roles, error: rErr } = await supabase.from("roles_catalog").select("code, form_label, name");
  if (rErr) return NextResponse.json({ error: "db error" }, { status: 500 });
  const labelToCode = new Map<string, string>();
  for (const r of roles ?? []) {
    if (r.form_label) labelToCode.set(String(r.form_label).toLowerCase(), r.code);
    labelToCode.set(String(r.name).toLowerCase(), r.code);
  }

  const rows = parsed.data.map((p) => toApplicantRow(p, labelToCode));
  const { error } = await supabase.from("applicants").upsert(rows, { onConflict: "form_response_id" });
  if (error) {
    const clash = error.code === "23505" && error.message.includes("candidate_code");
    return NextResponse.json(
      { error: clash ? "candidate_code already used by another response – clear old test applicants" : "db error", detail: error.message },
      { status: clash ? 409 : 500 },
    );
  }

  return NextResponse.json({ ok: true, received: rows.length });
}
