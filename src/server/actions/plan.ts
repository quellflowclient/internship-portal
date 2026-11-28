"use server";

/**
 * Batch plan (docs/19 DB-9, §7 "Batch → Plan", P3). Edits change the draft (batch_plan_items);
 * the mark_plan_dirty trigger sets has_unpublished_changes for content edits (not for skips).
 * Publish freezes a snapshot (publish_plan) that the share page /plan/<token> reads.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/server/guard";
import { done, fail, fromDb, fromZod, type ActionResult } from "@/server/result";
import { formToObject, optionalText, requiredText, uuid } from "@/lib/validators";
import { formatDate } from "@/lib/utils";
import { itemContentSchema, optionalWholeNumber, weekOf } from "@/app/plan/_lib/plan";

type Supa = Awaited<ReturnType<typeof assertAdmin>>["supabase"];
type PlanCtx = { id: string; batch_id: string; batches: { code: string; start_date: string; end_date: string } | null };

function refresh() {
  revalidatePath("/admin/batches/[code]", "layout");
  revalidatePath("/plan/[token]", "page");
}

const itemSchema = itemContentSchema.extend({
  planned_date: z.iso.date("Enter a valid date"),
  week: optionalWholeNumber("Week", 60),
});

async function loadPlan(supabase: Supa, planId: string) {
  const { data, error } = await supabase
    .from("batch_plans")
    .select("id, batch_id, batches(code, start_date, end_date)")
    .eq("id", planId)
    .maybeSingle();
  return { plan: data as unknown as PlanCtx | null, error };
}

function dateError(date: string, plan: PlanCtx): ActionResult | null {
  const b = plan.batches;
  if (!b) return null;
  if (date < b.start_date || date > b.end_date) {
    return fail("Please fix the highlighted fields.", {
      planned_date: `Pick a date inside the batch, ${formatDate(b.start_date)} to ${formatDate(b.end_date)}.`,
    });
  }
  return null;
}

function itemRow(v: z.infer<typeof itemSchema>, plan: PlanCtx) {
  return {
    title: v.title,
    kind: v.kind,
    planned_date: v.planned_date,
    week: v.week ?? (plan.batches ? weekOf(v.planned_date, plan.batches.start_date) : 1),
    description: v.description ?? null,
    resources: v.resources,
    duration_min: v.duration_min,
  };
}

/* ---------- add / edit ---------- */
export async function addPlanItem(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const raw = formToObject(fd);
  if (!uuid.safeParse(raw.batch_plan_id).success) return fail("This plan was not found. Reload the page.");
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) return fromZod(parsed.error);

  const { plan, error: pErr } = await loadPlan(supabase, raw.batch_plan_id);
  if (pErr) return fromDb(pErr);
  if (!plan) return fail("This plan was not found. Reload the page.");
  const bad = dateError(parsed.data.planned_date, plan);
  if (bad) return bad;

  // seq counts deleted rows too, so a restored item never shares a number
  const { data: last, error: sErr } = await supabase
    .from("batch_plan_items")
    .select("seq")
    .eq("batch_plan_id", plan.id)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sErr) return fromDb(sErr);
  const seq = ((last as { seq: number } | null)?.seq ?? 0) + 1;

  const { error } = await supabase.from("batch_plan_items").insert({ batch_plan_id: plan.id, seq, ...itemRow(parsed.data, plan) });
  if (error) return fromDb(error);
  refresh();
  return done("Added to the draft");
}

export async function updatePlanItem(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const raw = formToObject(fd);
  if (!uuid.safeParse(raw.id).success) return fail("This item was not found. Reload the page.");
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) return fromZod(parsed.error);

  const { data: cur, error: cErr } = await supabase
    .from("batch_plan_items")
    .select("id, batch_plan_id")
    .eq("id", raw.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (cErr) return fromDb(cErr);
  if (!cur) return fail("This item was removed. Reload the page.");
  const { plan, error: pErr } = await loadPlan(supabase, (cur as { batch_plan_id: string }).batch_plan_id);
  if (pErr) return fromDb(pErr);
  if (!plan) return fail("This plan was not found. Reload the page.");
  const bad = dateError(parsed.data.planned_date, plan);
  if (bad) return bad;

  const { data, error } = await supabase
    .from("batch_plan_items")
    .update(itemRow(parsed.data, plan))
    .eq("id", raw.id)
    .is("deleted_at", null)
    .select("id");
  if (error) return fromDb(error);
  if (!data?.length) return fail("You don’t have permission to do this.");
  refresh();
  return done("Saved to the draft");
}

/* ---------- delete (soft) + undo ---------- */
export async function deletePlanItem(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const id = String(fd.get("id") ?? "");
  if (!uuid.safeParse(id).success) return fail("This item was not found. Reload the page.");
  const { data, error } = await supabase
    .from("batch_plan_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) return fromDb(error);
  if (!data?.length) return fail("This item was already removed.");
  refresh();
  return done("Removed from the draft", { undoId: id });
}

export async function restorePlanItem(id: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!uuid.safeParse(id).success) return fail("Nothing to undo.");
  const { data, error } = await supabase
    .from("batch_plan_items")
    .update({ deleted_at: null })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) return fromDb(error);
  if (!data?.length) return fail("Nothing to undo.");
  refresh();
  return done("Item restored to the draft");
}

/* ---------- skip (tracking only, no new version needed) ---------- */
const skipSchema = z.object({ id: uuid, skip_reason: requiredText(300, "Reason") });

export async function skipPlanItem(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = skipSchema.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const { data: st, error: sErr } = await supabase.from("v_plan_item_status").select("delivered_on").eq("id", v.id).maybeSingle();
  if (sErr) return fromDb(sErr);
  if (!st) return fail("This item was removed. Reload the page.");
  if ((st as { delivered_on: string | null }).delivered_on) {
    return fail("This item is already done in Live track. Remove that session first if it was not given.");
  }

  const { data, error } = await supabase
    .from("batch_plan_items")
    .update({ skipped_at: new Date().toISOString(), skip_reason: v.skip_reason })
    .eq("id", v.id)
    .is("deleted_at", null)
    .select("id");
  if (error) return fromDb(error);
  if (!data?.length) return fail("You don’t have permission to do this.");
  refresh();
  return done("Marked as skipped. Students see it on the shared plan.");
}

export async function unskipPlanItem(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const id = String(fd.get("id") ?? "");
  if (!uuid.safeParse(id).success) return fail("This item was not found. Reload the page.");
  const { data, error } = await supabase
    .from("batch_plan_items")
    .update({ skipped_at: null, skip_reason: null })
    .eq("id", id)
    .not("skipped_at", "is", null)
    .select("id");
  if (error) return fromDb(error);
  if (!data?.length) return fail("This item is not skipped.");
  refresh();
  return done("Skip removed");
}

/* ---------- publish and share settings ---------- */
const publishSchema = z.object({ batch_id: uuid, change_note: optionalText(200) });

export async function publishPlan(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = publishSchema.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const { data, error } = await supabase.rpc("publish_plan", { p_batch: parsed.data.batch_id, p_note: parsed.data.change_note ?? null });
  if (error) return fromDb(error);
  refresh();
  return done(`Version ${Number(data)} published. The link stays the same.`);
}

const shareSchema = z.object({
  plan_id: uuid,
  field: z.enum(["share_enabled", "show_done_marks"]),
  value: z.string().optional(),
});

export async function updateShareSettings(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = shareSchema.safeParse(formToObject(fd));
  if (!parsed.success) return fail("Something went wrong. Reload the page and try again.");
  const { plan_id, field } = parsed.data;
  const on = parsed.data.value === "on";
  const { data, error } = await supabase
    .from("batch_plans")
    .update({ [field]: on })
    .eq("id", plan_id)
    .select("id");
  if (error) return fromDb(error);
  if (!data?.length) return fail("You don’t have permission to do this.");
  refresh();
  if (field === "share_enabled") return done(on ? "Link turned on" : "Link turned off. The page now says it is not active.");
  return done(on ? "Done marks shown on the shared plan" : "Done marks hidden on the shared plan");
}
