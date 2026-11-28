"use server";

/**
 * Batch → Close (docs/19 P7): results (completed / not completed + note) and Archive batch with Undo.
 * "Mark completed" for active or completed enrolments stays in documents.ts (markCompleted); this file adds
 * Not completed, changing a Not completed result to Completed, and close_batch()/reopen_batch().
 * Every status change is logged in enrollment_changes by guard_enrollments().
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/server/guard";
import { done, fail, fromDb, fromZod, type ActionResult } from "@/server/result";
import { formToObject, optionalText, requiredText, uuid } from "@/lib/validators";
import { todayIST } from "@/lib/utils";
import { markCompleted } from "@/server/actions/documents";

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/admin/batches");
  revalidatePath("/admin/documents");
  revalidatePath("/admin/students", "layout");
  revalidatePath("/admin/batches/[code]", "layout");
}

type EnrolRow = { status: string; end_date: string; batch: { status: string } | null };

async function loadEnrolment(supabase: Awaited<ReturnType<typeof assertAdmin>>["supabase"], id: string) {
  const { data } = await supabase.from("enrollments").select("status, end_date, batch:batches(status)").eq("id", id).maybeSingle();
  return data as unknown as EnrolRow | null;
}

const ResultForm = z.object({
  enrollment_id: uuid,
  outcome: z.enum(["completed", "not_completed"]).catch("completed"),
  result_note: optionalText(300).transform((v) => v ?? null),
  change_reason: optionalText(300).transform((v) => v ?? null),
});

/**
 * Close → ?mark=<id>: save the result. Completed from Active or Completed goes through markCompleted;
 * Not completed needs a note; a Not completed result can be changed to Completed while the batch is open.
 */
export async function saveResult(prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = ResultForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  const en = await loadEnrolment(supabase, v.enrollment_id);
  if (!en) return fail("This enrolment no longer exists.");
  if (en.batch?.status === "completed") return fail("This batch is archived. Results can no longer change.");

  if (v.outcome === "completed") {
    if (en.status === "active" || en.status === "completed") return markCompleted(prev, fd);
    if (en.status !== "not_completed") return fail("Only active enrolments can get a result.");
    const resultNote = requiredText(200, "Result").safeParse(v.result_note ?? "");
    if (!resultNote.success) {
      return fail("Please fix the highlighted fields.", { result_note: resultNote.error.issues[0]?.message ?? "Result is required" });
    }
    const early = en.end_date > todayIST();
    if (early && !v.change_reason) {
      const m = "Give the reason for completing before the end date";
      return fail(m, { change_reason: m });
    }
    const { error } = await supabase
      .from("enrollments")
      .update({ status: "completed", result_note: resultNote.data, change_reason: v.change_reason ?? "Result changed to completed" })
      .eq("id", v.enrollment_id)
      .eq("status", "not_completed");
    if (error) return fromDb(error);
    refresh();
    return done("Marked completed");
  }

  // Not completed
  if (!v.result_note) return fail("Please fix the highlighted fields.", { result_note: "Note is required" });
  if (!["active", "completed", "not_completed"].includes(en.status)) return fail("Only active enrolments can get a result.");
  if (en.status === "completed") {
    const { count } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("enrollment_id", v.enrollment_id)
      .eq("type", "certificate")
      .in("status", ["issued", "accepted"]);
    if ((count ?? 0) > 0) return fail("A certificate is issued for this enrolment. An owner must revoke it first.");
  }
  const { error } = await supabase
    .from("enrollments")
    .update({ status: "not_completed", result_note: v.result_note, change_reason: v.result_note })
    .eq("id", v.enrollment_id)
    .in("status", ["active", "completed", "not_completed"]);
  if (error) return fromDb(error);
  refresh();
  return done(en.status === "not_completed" ? "Note saved" : "Marked not completed");
}

/* =====================================================================
 * Archive batch (close_batch) + Undo within 2 minutes (reopen_batch)
 * ===================================================================== */
const CloseForm = z.object({ id: uuid });

export async function archiveBatch(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = CloseForm.safeParse(formToObject(fd));
  if (!parsed.success) return fail("Unknown batch.");
  const { data, error } = await supabase.rpc("close_batch", { p_batch: parsed.data.id });
  if (error) return fromDb(error);
  const r = data as { code: string; alumni: number } | null;
  refresh();
  const alumni = r?.alumni ?? 0;
  return done(`Batch ${r?.code ?? ""} archived. ${alumni} ${alumni === 1 ? "student" : "students"} moved to alumni.`, {
    undoId: parsed.data.id,
  });
}

export async function reopenBatch(id: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!uuid.safeParse(id).success) return fail("Unknown batch.");
  const { data, error } = await supabase.rpc("reopen_batch", { p_batch: id });
  if (error) {
    if (/within 2 minutes/i.test(error.message ?? "")) return fail("Undo is possible only within 2 minutes of archiving.");
    return fromDb(error);
  }
  refresh();
  return done(`Batch ${(data as { code: string } | null)?.code ?? ""} is running again`);
}
