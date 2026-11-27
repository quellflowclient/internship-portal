"use server";

/**
 * Leads (docs/19 §6 lead state machine, §7 action map). Leads are added, updated and marked lost only here.
 * Conversion to a student is owned by the Students screen (create_student with p_lead).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/server/guard";
import { done, fail, fromDb, fromZod, type ActionResult } from "@/server/result";
import { formToObject, indianPhone, optionalDate, optionalEmail, optionalText, requiredText, uuid } from "@/lib/validators";
import { STAGE } from "@/lib/labels";
import type { LeadStage } from "@/lib/types";

const OPEN_STAGES = ["new", "contacted", "interested", "counselling"] as const;
const LOST_REASONS = ["not_interested", "no_response", "not_eligible", "joined_elsewhere", "duplicate", "spam"] as const;
const ACTIVITY_KINDS = ["call", "whatsapp", "email", "meeting", "note"] as const;

function refresh() {
  revalidatePath("/admin/leads");
  revalidatePath("/admin");
}

async function currentStage(supabase: Awaited<ReturnType<typeof assertAdmin>>["supabase"], id: string) {
  const { data, error } = await supabase.from("leads").select("stage").eq("id", id).maybeSingle();
  return { stage: (data as { stage: LeadStage } | null)?.stage ?? null, error };
}

/* ---------- Add lead ---------- */
const createSchema = z.object({
  full_name: requiredText(120, "Full name"),
  phone: indianPhone,
  source: z.enum(["walk_in", "whatsapp", "referral", "other"], { error: "Pick a source" }),
  email: optionalEmail,
  college: optionalText(200),
  interested_track: optionalText(120),
});

export async function createLead(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = createSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const { data, error } = await supabase.rpc("create_lead", {
    p_full_name: v.full_name,
    p_phone: v.phone,
    p_source: v.source,
    p_email: v.email ?? null,
    p_college: v.college ?? null,
    p_track: v.interested_track ?? null,
  });
  if (error) return fromDb(error);
  const id = data as string;

  // docs/19 §7: Add lead → activity "created" (timeline entry; failure here must not undo the lead)
  await supabase.from("activities").insert({ lead_id: id, kind: "system", summary: "Lead added" });

  refresh();
  return done("Lead added", { redirectTo: `/admin/leads?open=${id}` });
}

/* ---------- Change stage / follow-up ---------- */
const updateSchema = z.object({
  id: uuid,
  stage: z.enum(OPEN_STAGES, { error: "Pick a stage" }),
  next_follow_up_on: optionalDate,
});

export async function updateLead(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = updateSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const cur = await currentStage(supabase, v.id);
  if (cur.error) return fromDb(cur.error);
  if (!cur.stage) return fail("This lead no longer exists.");
  if (cur.stage === "converted") return fail("This lead is already a student. Edit the student instead.");

  const patch: Record<string, unknown> = { stage: v.stage, next_follow_up_on: v.next_follow_up_on ?? null };
  if (cur.stage === "lost") Object.assign(patch, { lost_reason: null, lost_note: null }); // re-open (lost → open stage)

  const { error } = await supabase.from("leads").update(patch).eq("id", v.id);
  if (error) return fromDb(error);

  refresh();
  if (cur.stage === "lost") return done(`Lead re-opened as ${STAGE[v.stage].label}`);
  return done(cur.stage === v.stage ? "Follow-up saved" : `Stage set to ${STAGE[v.stage].label}`);
}

/* ---------- Log an activity ---------- */
const activitySchema = z.object({
  lead_id: uuid,
  kind: z.enum(ACTIVITY_KINDS, { error: "Pick what kind of contact it was" }),
  summary: requiredText(1000, "What happened"),
  outcome: optionalText(200),
});

export async function logActivity(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = activitySchema.safeParse(formToObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const { error } = await supabase
    .from("activities")
    .insert({ lead_id: v.lead_id, kind: v.kind, summary: v.summary, outcome: v.outcome ?? null });
  if (error) return fromDb(error);

  // A note is not a contact; calls, messages, emails and meetings are.
  if (v.kind !== "note") {
    const { error: e2 } = await supabase.from("leads").update({ last_contacted_at: new Date().toISOString() }).eq("id", v.lead_id);
    if (e2) return fromDb(e2);
  }

  refresh();
  return done("Activity saved");
}

/* ---------- Mark lost (Undo → previous stage) ---------- */
const lostSchema = z.object({
  id: uuid,
  lost_reason: z.enum(LOST_REASONS, { error: "Pick a reason" }),
  lost_note: optionalText(500),
});

export async function markLost(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = lostSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const cur = await currentStage(supabase, v.id);
  if (cur.error) return fromDb(cur.error);
  if (!cur.stage) return fail("This lead no longer exists.");
  if (cur.stage === "converted") return fail("This lead is already a student.");
  if (cur.stage === "lost") return fail("This lead is already marked lost.");

  const { data, error } = await supabase
    .from("leads")
    .update({ stage: "lost", lost_reason: v.lost_reason, lost_note: v.lost_note ?? null })
    .eq("id", v.id)
    .eq("stage", cur.stage)
    .select("id");
  if (error) return fromDb(error);
  if (!data?.length) return fail("This lead was changed by someone else. Reload and try again.");

  refresh();
  return done("Lead marked as lost", { undoId: `${v.id}:${cur.stage}` });
}

/** Undo for markLost: `undoId` = "<lead id>:<previous stage>". */
export async function restoreLead(undoId: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const m = /^([0-9a-f-]{36}):(new|contacted|interested|counselling)$/.exec(String(undoId));
  if (!m || !uuid.safeParse(m[1]).success) return fail("Nothing to undo.");
  const [, id, stage] = m;

  const { data, error } = await supabase
    .from("leads")
    .update({ stage, lost_reason: null, lost_note: null })
    .eq("id", id)
    .eq("stage", "lost")
    .select("id");
  if (error) return fromDb(error);
  if (!data?.length) return fail("This lead was changed since. Nothing to undo.");

  refresh();
  return done(`Lead restored to ${STAGE[stage as LeadStage].label}`);
}
