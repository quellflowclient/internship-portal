"use server";

/**
 * Settings → Signatories and Settings → Templates (docs/20 §2, §3). Owner only (RLS: owner write on both tables).
 * Saving a template makes a new version and deactivates the old one, so issued documents keep theirs.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertOwner } from "@/server/guard";
import { done, fail, fromDb, fromZod, type ActionResult } from "@/server/result";
import { formToObject, requiredText, uuid } from "@/lib/validators";
import { ACCEPT_DOC_TYPES } from "@/lib/labels";
import type { DocType } from "@/lib/types";
import { DOC_TYPES, LAYOUT_FIELDS } from "@/server/documents/rules";
import { listTemplateFiles } from "@/server/documents/template-files";

const PATH = "/admin/settings";
/** signatories.signature_data is capped at 400,000 characters in the database. */
const MAX_SIGNATURE_CHARS = 400_000;

function refresh() {
  revalidatePath(PATH);
  revalidatePath("/admin/documents");
}

/* =====================================================================
 * Signatories
 * ===================================================================== */
const SignatoryForm = z.object({
  id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(uuid.nullable())
    .nullish(),
  name: requiredText(100, "Name"),
  title_on_docs: requiredText(150, "Title on documents"),
  profile_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid("Pick the admin").nullable())
    .nullish(),
  signature: z
    .string()
    .trim()
    .refine((v) => v === "" || v === "remove" || /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v), "Upload the signature as a PNG image")
    .refine((v) => v.length <= MAX_SIGNATURE_CHARS, "The signature image is too large. Use a PNG under 290 KB.")
    .optional()
    .default(""),
  is_active: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export async function saveSignatory(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertOwner();
  const parsed = SignatoryForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  if (v.profile_id) {
    const { data } = await supabase.from("profiles").select("role, is_active").eq("id", v.profile_id).maybeSingle();
    const p = data as { role: string; is_active: boolean } | null;
    if (!p || p.role !== "admin") return fail("Link an admin account.", { profile_id: "Link an admin account." });
  }

  const row: Record<string, unknown> = {
    name: v.name,
    title: v.title_on_docs,
    title_on_docs: v.title_on_docs,
    profile_id: v.profile_id ?? null,
    is_active: v.is_active,
  };
  if (v.signature === "remove") row.signature_data = null;
  else if (v.signature) row.signature_data = v.signature;

  const q = v.id
    ? supabase.from("signatories").update(row).eq("id", v.id).select("id")
    : supabase.from("signatories").insert(row).select("id");
  const { data, error } = await q;
  if (error?.code === "23505") {
    return fail("This admin already has a signatory. Edit that one instead.", { profile_id: "Already linked to another signatory." });
  }
  if (error) return fromDb(error);
  if (!data?.length) return fail("This signatory no longer exists.");
  refresh();
  return done(v.id ? "Signatory saved" : "Signatory added");
}

/* =====================================================================
 * Templates: every save is a new version
 * ===================================================================== */
const BACKGROUND = /^\/templates\/[A-Za-z0-9._-]+\.pdf$/;
const FIELD_NAMES = new Set(LAYOUT_FIELDS.map(([k]) => k));

/** Layout JSON → { field: { x, y, width, height, fontSize?, alignment? } } (mm), or an error message. */
function parseLayout(raw: string): { ok: true; layout: Record<string, Record<string, unknown>> } | { ok: false; message: string } {
  const text = raw.trim();
  if (!text) return { ok: true, layout: {} };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, message: "The layout is not valid JSON. Check the commas and quotes." };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, message: "The layout must be a JSON object: { \"name\": { … } }." };
  const out: Record<string, Record<string, unknown>> = {};
  for (const [name, box] of Object.entries(value as Record<string, unknown>)) {
    if (!FIELD_NAMES.has(name)) return { ok: false, message: `Unknown field “${name}”. Use one of the field names listed.` };
    if (!box || typeof box !== "object" || Array.isArray(box)) return { ok: false, message: `“${name}” must be an object with x, y, width and height.` };
    const b = box as Record<string, unknown>;
    for (const k of ["x", "y", "width", "height"]) {
      if (typeof b[k] !== "number" || !Number.isFinite(b[k]) || (b[k] as number) < 0 || (b[k] as number) > 1000) {
        return { ok: false, message: `“${name}”: ${k} must be a number of millimetres.` };
      }
    }
    if (b.fontSize !== undefined && (typeof b.fontSize !== "number" || b.fontSize < 4 || b.fontSize > 120)) {
      return { ok: false, message: `“${name}”: fontSize must be a number from 4 to 120.` };
    }
    if (b.alignment !== undefined && !["left", "center", "right", "justify"].includes(String(b.alignment))) {
      return { ok: false, message: `“${name}”: alignment must be left, center, right or justify.` };
    }
    out[name] = {
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      ...(b.fontSize !== undefined ? { fontSize: b.fontSize } : {}),
      ...(b.alignment !== undefined ? { alignment: b.alignment } : {}),
    };
  }
  return { ok: true, layout: out };
}

const TemplateForm = z.object({
  type: z.enum(DOC_TYPES as [DocType, ...DocType[]]),
  title: requiredText(150, "Title"),
  body: requiredText(10_000, "Wording"),
  background_path: z
    .string()
    .trim()
    .refine((v) => v === "" || BACKGROUND.test(v), "Pick a PDF from public/templates/")
    .optional()
    .default(""),
  layout: z.string().max(20_000, "The layout is too long").optional().default(""),
});

export async function saveTemplate(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertOwner();
  const parsed = TemplateForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  const layout = parseLayout(v.layout);
  if (!layout.ok) return fail(layout.message, { layout: layout.message });
  if (v.background_path) {
    const files = await listTemplateFiles();
    if (!files.includes(v.background_path.slice("/templates/".length))) {
      const m = "This file is not in public/templates/ any more.";
      return fail(m, { background_path: m });
    }
  }

  const [activeRes, maxRes] = await Promise.all([
    supabase.from("document_templates").select("id, requires_acceptance").eq("type", v.type).eq("active", true).maybeSingle(),
    supabase.from("document_templates").select("version").eq("type", v.type).order("version", { ascending: false }).limit(1),
  ]);
  const active = activeRes.data as { id: string; requires_acceptance: boolean } | null;
  const version = (((maxRes.data ?? []) as { version: number }[])[0]?.version ?? 0) + 1;

  if (active) {
    const { error } = await supabase.from("document_templates").update({ active: false }).eq("id", active.id);
    if (error) return fromDb(error);
  }
  const { error } = await supabase.from("document_templates").insert({
    type: v.type,
    version,
    title: v.title,
    body: v.body.replace(/\r\n/g, "\n"),
    requires_acceptance: active?.requires_acceptance ?? ACCEPT_DOC_TYPES.includes(v.type),
    active: true,
    layout: layout.layout,
    background_path: v.background_path || null,
  });
  if (error) {
    if (active) await supabase.from("document_templates").update({ active: true }).eq("id", active.id);
    return fromDb(error);
  }
  refresh();
  return done(`Saved as version ${version}. Documents already issued keep their version.`);
}
