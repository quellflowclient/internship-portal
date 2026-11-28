"use server";

/**
 * Batch → Live track (docs/19 DB-10, §2.7, §7 row "Batch → Live track", §8 P4).
 * One session record = one track_entries row + attendance rows (sessions, tests, milestones)
 * + work_results rows (tasks and tests). Delete = soft delete; Undo = restoreSession (DB-8).
 * The database re-checks: held_on not in the future (IST), plan item of the same batch,
 * attendance/results only for enrolments of that batch.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/server/guard";
import { done, fail, fromDb, fromZod, type ActionResult } from "@/server/result";
import { formToObject, optionalText, optionalUrl, uuid } from "@/lib/validators";
import { todayIST } from "@/lib/utils";
import { ATTENDANCE_KINDS, RESULT_KINDS } from "@/lib/labels";
import type { AttendanceMark, PlanKind, WorkMark } from "@/lib/types";

type Db = Awaited<ReturnType<typeof assertAdmin>>["supabase"];

const KINDS = ["session", "task", "test", "milestone", "buffer"] as const;
const MARKS = ["done", "late", "missing", "excused"] as const;
const MAX_SCORE = 9999;

const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(uuid.nullable())
  .nullish();

/** "" → null; "8.5" → 8.5 (0 to 9999, two decimals at most). */
function parseScore(raw: FormDataEntryValue | null): number | null | "bad" {
  const v = typeof raw === "string" ? raw.trim().replace(",", ".") : "";
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > MAX_SCORE || Math.round(n * 100) !== n * 100) return "bad";
  return n;
}

const EntryFields = {
  batch_id: uuid,
  plan_item_id: optionalId,
  held_on: z
    .string()
    .trim()
    .pipe(z.iso.date("Enter the date it was held"))
    .refine((d) => d <= todayIST(), "The date cannot be in the future"),
  kind: z.enum(KINDS, "Pick the kind"),
  title: z.string().trim().max(200, "Title is too long"),
  link: optionalUrl,
  note: optionalText(2000),
};
const NewEntry = z.object(EntryFields);
const EditEntry = z.object({ ...EntryFields, id: uuid });

type Roster = {
  attendance: { enrollment_id: string; mark: AttendanceMark }[];
  results: { enrollment_id: string; mark: WorkMark; score: number | null; max_score: number | null }[];
};

/**
 * Reads the student rows of the form: `enr` (every student shown), `present` (ticked tiles),
 * `mark_<enrolment id>`, `score_<enrolment id>` and the shared `max_score`.
 * Only enrolments of this batch are kept. `keepLeave` = enrolments already marked "On leave" (kept when unticked).
 */
async function readRoster(
  supabase: Db,
  fd: FormData,
  batchId: string,
  kind: PlanKind,
  keepLeave: Set<string> = new Set(),
): Promise<{ ok: true; roster: Roster } | { ok: false; result: ActionResult }> {
  const posted = [...new Set(fd.getAll("enr").map(String))].filter((id) => uuid.safeParse(id).success);
  const roster: Roster = { attendance: [], results: [] };
  if (!posted.length) return { ok: true, roster };

  const { data, error } = await supabase.from("enrollments").select("id").eq("batch_id", batchId).in("id", posted);
  if (error) return { ok: false, result: fromDb(error) };
  const inBatch = new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
  const ids = posted.filter((id) => inBatch.has(id));

  if (ATTENDANCE_KINDS.includes(kind)) {
    const present = new Set(fd.getAll("present").map(String));
    for (const id of ids) {
      roster.attendance.push({ enrollment_id: id, mark: present.has(id) ? "present" : keepLeave.has(id) ? "leave" : "absent" });
    }
  }

  if (RESULT_KINDS.includes(kind)) {
    let max: number | null = null;
    if (kind === "test") {
      const m = parseScore(fd.get("max_score"));
      if (m === "bad" || m === 0) {
        return { ok: false, result: fail("Please fix the highlighted fields.", { max_score: "Out of must be a number above 0" }) };
      }
      max = m;
    }
    for (const id of ids) {
      const rawMark = String(fd.get(`mark_${id}`) ?? "done");
      const mark = (MARKS as readonly string[]).includes(rawMark) ? (rawMark as WorkMark) : "done";
      let score: number | null = null;
      if (kind === "test") {
        const s = parseScore(fd.get(`score_${id}`));
        if (s === "bad" || (s !== null && max !== null && s > max)) {
          return {
            ok: false,
            result: fail("Please fix the highlighted fields.", {
              scores: max !== null ? `Scores must be numbers from 0 to ${max}` : "Scores must be numbers from 0 up",
            }),
          };
        }
        score = s;
      }
      roster.results.push({ enrollment_id: id, mark, score, max_score: max });
    }
  }
  return { ok: true, roster };
}

/** Title fallback: an empty title takes the plan item's title. */
async function resolveTitle(supabase: Db, title: string, planItemId: string | null | undefined): Promise<string | null> {
  if (title) return title;
  if (!planItemId) return null;
  const { data } = await supabase.from("batch_plan_items").select("title").eq("id", planItemId).maybeSingle();
  return (data as { title: string } | null)?.title ?? null;
}

function refresh() {
  revalidatePath("/admin/batches/[code]", "layout");
  revalidatePath("/admin/students/[code]", "page");
  revalidatePath("/admin");
}

const TITLE_MISSING = fail("Please fix the highlighted fields.", { title: "Title is required" });

/* =====================================================================
 * Log session (?new=1)
 * ===================================================================== */
export async function logSession(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = NewEntry.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const { data: b } = await supabase.from("batches").select("id").eq("id", v.batch_id).maybeSingle();
  if (!b) return fail("This batch no longer exists.");

  const title = await resolveTitle(supabase, v.title, v.plan_item_id);
  if (!title) return TITLE_MISSING;

  const r = await readRoster(supabase, fd, v.batch_id, v.kind);
  if (!r.ok) return r.result;

  const { data: entry, error } = await supabase
    .from("track_entries")
    .insert({
      batch_id: v.batch_id,
      plan_item_id: v.plan_item_id ?? null,
      held_on: v.held_on,
      kind: v.kind,
      title,
      link: v.link ?? null,
      note: v.note ?? null,
    })
    .select("id")
    .single();
  if (error || !entry) return fromDb(error);
  const id = (entry as { id: string }).id;

  const rows = (list: object[]) => list.map((x) => ({ track_entry_id: id, ...x }));
  const att = r.roster.attendance.length ? await supabase.from("attendance").insert(rows(r.roster.attendance)) : { error: null };
  const res = !att.error && r.roster.results.length ? await supabase.from("work_results").insert(rows(r.roster.results)) : { error: null };
  const failed = att.error ?? res.error;
  if (failed) {
    await rollback(supabase, id);
    return fromDb(failed);
  }

  refresh();
  return done(v.plan_item_id ? "Session logged and the plan item marked done" : "Session logged");
}

/** Undo a half-saved entry: drop its rows, then delete it (owner) or soft-delete it (admin). */
async function rollback(supabase: Db, id: string) {
  await supabase.from("attendance").delete().eq("track_entry_id", id);
  await supabase.from("work_results").delete().eq("track_entry_id", id);
  const { data } = await supabase.from("track_entries").delete().eq("id", id).select("id");
  if (!data?.length) await supabase.from("track_entries").update({ deleted_at: new Date().toISOString() }).eq("id", id);
}

/* =====================================================================
 * Session record (?open=<id>): edit, delete (+ restore)
 * ===================================================================== */
export async function updateSession(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = EditEntry.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const { data: cur } = await supabase.from("track_entries").select("id, batch_id, deleted_at").eq("id", v.id).maybeSingle();
  const entry = cur as { id: string; batch_id: string; deleted_at: string | null } | null;
  if (!entry || entry.deleted_at) return fail("This record was deleted. Nothing to save.");

  const title = await resolveTitle(supabase, v.title, v.plan_item_id);
  if (!title) return TITLE_MISSING;

  const { data: leaveRows } = await supabase.from("attendance").select("enrollment_id").eq("track_entry_id", v.id).eq("mark", "leave");
  const keepLeave = new Set(((leaveRows ?? []) as { enrollment_id: string }[]).map((x) => x.enrollment_id));
  const r = await readRoster(supabase, fd, entry.batch_id, v.kind, keepLeave);
  if (!r.ok) return r.result;

  const { error } = await supabase
    .from("track_entries")
    .update({
      plan_item_id: v.plan_item_id ?? null,
      held_on: v.held_on,
      kind: v.kind,
      title,
      link: v.link ?? null,
      note: v.note ?? null,
    })
    .eq("id", v.id);
  if (error) return fromDb(error);

  const rows = (list: object[]) => list.map((x) => ({ track_entry_id: v.id, ...x }));
  const conflict = { onConflict: "track_entry_id,enrollment_id" };

  const att = ATTENDANCE_KINDS.includes(v.kind)
    ? r.roster.attendance.length
      ? await supabase.from("attendance").upsert(rows(r.roster.attendance), conflict)
      : { error: null }
    : await supabase.from("attendance").delete().eq("track_entry_id", v.id);
  if (att.error) return fromDb(att.error);

  const res = RESULT_KINDS.includes(v.kind)
    ? r.roster.results.length
      ? await supabase.from("work_results").upsert(rows(r.roster.results), conflict)
      : { error: null }
    : await supabase.from("work_results").delete().eq("track_entry_id", v.id);
  if (res.error) return fromDb(res.error);

  refresh();
  return done("Session saved");
}

export async function deleteSession(id: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!uuid.safeParse(id).success) return fail("Unknown record.");
  const { data, error } = await supabase
    .from("track_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) return fromDb(error);
  if (!data) return fail("This record was already deleted.");
  refresh();
  return done("Session deleted", { undoId: id });
}

export async function restoreSession(id: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!uuid.safeParse(id).success) return fail("Nothing to undo.");
  const { data, error } = await supabase
    .from("track_entries")
    .update({ deleted_at: null })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error) return fromDb(error);
  if (!data) return fail("This record is not deleted. Nothing to undo.");
  refresh();
  return done("Session restored");
}
