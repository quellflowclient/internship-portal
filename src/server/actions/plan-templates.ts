"use server";

/**
 * Plan templates per course plan (docs/19 §2.4, P3 step 1). One active template per course plan;
 * create_batch copies its items into a new batch. Running batches keep their own copy, so editing
 * here never changes an existing batch. Template items have no history: delete is a hard delete.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/server/guard";
import { done, fail, fromDb, fromZod, type ActionResult } from "@/server/result";
import { formToObject, uuid } from "@/lib/validators";
import { itemContentSchema, wholeNumber } from "@/app/plan/_lib/plan";

const PATH = "/admin/settings";

const tplItemSchema = itemContentSchema.extend({
  week: wholeNumber("Week", 20),
  day_offset: wholeNumber("Day", 90),
});

type Supa = Awaited<ReturnType<typeof assertAdmin>>["supabase"];

async function durationOf(supabase: Supa, coursePlanId: string) {
  const { data, error } = await supabase.from("course_plans").select("duration_days").eq("id", coursePlanId).maybeSingle();
  return { days: (data as { duration_days: number } | null)?.duration_days ?? null, error };
}

function dayError(day: number, days: number | null): ActionResult | null {
  if (days && day > days) {
    return fail("Please fix the highlighted fields.", { day_offset: `Day must be 1 to ${days} for a ${days}-day plan.` });
  }
  return null;
}

function itemRow(v: z.infer<typeof tplItemSchema>) {
  return {
    title: v.title,
    kind: v.kind,
    week: v.week,
    day_offset: v.day_offset,
    description: v.description ?? null,
    resources: v.resources,
    duration_min: v.duration_min,
  };
}

/** Adds an item at the end. The first item for a course plan creates its active template. */
export async function addTemplateItem(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const raw = formToObject(fd);
  if (!uuid.safeParse(raw.course_plan_id).success) return fail("This course plan was not found. Reload the page.");
  const parsed = tplItemSchema.safeParse(raw);
  if (!parsed.success) return fromZod(parsed.error);

  const { days, error: dErr } = await durationOf(supabase, raw.course_plan_id);
  if (dErr) return fromDb(dErr);
  if (days === null) return fail("This course plan was not found. Reload the page.");
  const bad = dayError(parsed.data.day_offset, days);
  if (bad) return bad;

  const { data: tpls, error: tErr } = await supabase
    .from("plan_templates")
    .select("id, version, active")
    .eq("course_plan_id", raw.course_plan_id)
    .order("version", { ascending: false });
  if (tErr) return fromDb(tErr);
  const list = (tpls ?? []) as { id: string; version: number; active: boolean }[];
  let templateId = list.find((t) => t.active)?.id;
  let created = false;
  if (!templateId) {
    const { data: t, error } = await supabase
      .from("plan_templates")
      .insert({ course_plan_id: raw.course_plan_id, version: (list[0]?.version ?? 0) + 1, active: true })
      .select("id")
      .single();
    if (error) return fromDb(error);
    templateId = (t as { id: string }).id;
    created = true;
  }

  const { data: last, error: sErr } = await supabase
    .from("plan_template_items")
    .select("seq")
    .eq("template_id", templateId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sErr) return fromDb(sErr);
  const seq = ((last as { seq: number } | null)?.seq ?? 0) + 1;

  const { error } = await supabase.from("plan_template_items").insert({ template_id: templateId, seq, ...itemRow(parsed.data) });
  if (error) return fromDb(error);
  revalidatePath(PATH);
  return done(created ? "Template created with its first item" : "Item added to the template");
}

export async function updateTemplateItem(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const raw = formToObject(fd);
  if (!uuid.safeParse(raw.id).success) return fail("This item was not found. Reload the page.");
  const parsed = tplItemSchema.safeParse(raw);
  if (!parsed.success) return fromZod(parsed.error);

  const { data: cur, error: cErr } = await supabase
    .from("plan_template_items")
    .select("id, plan_templates(course_plan_id)")
    .eq("id", raw.id)
    .maybeSingle();
  if (cErr) return fromDb(cErr);
  const cp = (cur as { plan_templates: { course_plan_id: string } | null } | null)?.plan_templates?.course_plan_id;
  if (!cur || !cp) return fail("This item was removed. Reload the page.");
  const { days, error: dErr } = await durationOf(supabase, cp);
  if (dErr) return fromDb(dErr);
  const bad = dayError(parsed.data.day_offset, days);
  if (bad) return bad;

  const { data, error } = await supabase.from("plan_template_items").update(itemRow(parsed.data)).eq("id", raw.id).select("id");
  if (error) return fromDb(error);
  if (!data?.length) return fail("You don’t have permission to do this.");
  revalidatePath(PATH);
  return done("Template item saved");
}

export async function deleteTemplateItem(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const id = String(fd.get("id") ?? "");
  if (!uuid.safeParse(id).success) return fail("This item was not found. Reload the page.");
  const { data, error } = await supabase.from("plan_template_items").delete().eq("id", id).select("id");
  if (error) return fromDb(error);
  // RLS: deleting template items is owner-only today (admin rw pattern), so a plain admin gets 0 rows.
  if (!data?.length) return fail("Only an owner can delete template items.");
  revalidatePath(PATH);
  return done("Item deleted from the template");
}
