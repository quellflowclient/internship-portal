"use server";

/**
 * Batches (docs/19 §6 batch state machine, §7 rows Batches and Batch → Overview).
 * Owners: New batch = Batches list; links, details, cancel and start = Batch → Overview.
 * Codes, end date and the draft plan come from the database (`create_batch`).
 * Dates of a running batch change only for owners (trigger `guard_batches`). Undo = reverse action (DB-8).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/server/guard";
import { done, fail, fromDb, fromZod, type ActionResult } from "@/server/result";
import { formToObject, optionalText, optionalUrl, uuid } from "@/lib/validators";
import { todayIST } from "@/lib/utils";
import type { BatchStatus } from "@/lib/types";

const OPEN = ["assigned", "active"] as const;
const batchPath = (code: string, tab = "") => `/admin/batches/${encodeURIComponent(code)}${tab ? `/${tab}` : ""}`;

function refresh() {
  revalidatePath("/admin/batches");
  revalidatePath("/admin/batches/[code]", "layout");
  revalidatePath("/admin");
}

/* ---------- schema helpers ---------- */
const requiredDate = (label: string) => z.string().trim().min(1, `${label} is required`).pipe(z.iso.date(`${label}: enter a valid date`));

const scheduleDays = z
  .array(z.coerce.number().int().min(1).max(7))
  .min(1, "Pick at least one class day")
  .transform((d) => [...new Set(d)].sort((a, b) => a - b));

const capacity = z.coerce
  .number({ message: "Seats: enter a number" })
  .int("Seats: whole numbers only")
  .min(1, "Seats must be at least 1")
  .max(500, "Seats can be at most 500");

const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(uuid.nullable())
  .nullish();

/** Form values plus the checkbox group (formToObject keeps only the last value of a repeated name). */
const formWithDays = (fd: FormData) => ({ ...formToObject(fd), days: fd.getAll("days").map(String) });

/* =====================================================================
 * Batches → New batch
 * ===================================================================== */
const NewBatch = z.object({
  course_plan_id: z.string().trim().min(1, "Pick a course plan").pipe(uuid),
  start_date: requiredDate("Start date"),
  days: scheduleDays,
  session_time: optionalText(60),
  capacity,
});

export async function createBatch(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = NewBatch.safeParse(formWithDays(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const { data: id, error } = await supabase.rpc("create_batch", {
    p_course_plan: v.course_plan_id,
    p_start: v.start_date,
    p_capacity: v.capacity,
    p_session_time: v.session_time ?? null,
    p_schedule: v.days,
  });
  if (error || !id) return fromDb(error);

  const { data: row } = await supabase.from("batches").select("code").eq("id", id as string).maybeSingle();
  const code = (row as { code: string } | null)?.code;
  refresh();
  if (!code) return done("Batch created. Its plan is a draft – review and publish it.", { redirectTo: "/admin/batches?status=planned" });
  return done(`Batch ${code} created. Its plan is a draft – review and publish it.`, { redirectTo: batchPath(code, "plan") });
}

/* =====================================================================
 * Batch → Overview → Tools and links (pen)
 * ===================================================================== */
const LinksForm = z.object({
  id: uuid,
  whatsapp_url: optionalUrl,
  classroom_url: optionalUrl,
  meet_url: optionalUrl,
  playlist_url: optionalUrl,
  drive_url: optionalUrl,
  github_url: optionalUrl,
});

export async function updateBatchLinks(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = LinksForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const { id, ...links } = parsed.data;

  const { data, error } = await supabase
    .from("batches")
    .update({
      whatsapp_url: links.whatsapp_url ?? null,
      classroom_url: links.classroom_url ?? null,
      meet_url: links.meet_url ?? null,
      playlist_url: links.playlist_url ?? null,
      drive_url: links.drive_url ?? null,
      github_url: links.github_url ?? null,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return fromDb(error);
  if (!data) return fail("This batch no longer exists.");
  refresh();
  return done("Links saved");
}

/* =====================================================================
 * Batch → Overview → Details (pen)
 * ===================================================================== */
const DetailsForm = z
  .object({
    id: uuid,
    start_date: requiredDate("Start date"),
    end_date: requiredDate("End date"),
    days: scheduleDays,
    session_time: optionalText(60),
    capacity,
    coordinator_id: optionalId,
  })
  .refine((v) => v.end_date >= v.start_date, { path: ["end_date"], message: "The end date must be on or after the start date" });

export async function updateBatch(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = DetailsForm.safeParse(formWithDays(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const [batchRes, seatsRes] = await Promise.all([
    supabase.from("batches").select("status").eq("id", v.id).maybeSingle(),
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("batch_id", v.id).in("status", OPEN),
  ]);
  const status = (batchRes.data as { status: BatchStatus } | null)?.status;
  if (!status) return fail("This batch no longer exists.");
  if (status === "completed" || status === "cancelled") return fail(`A ${status} batch can’t be edited.`);
  const taken = seatsRes.count ?? 0;
  if (v.capacity < taken) {
    const msg = `${taken} students are already in this batch. Seats can’t be lower than that.`;
    return fail("Please fix the highlighted fields.", { capacity: msg });
  }

  const { error } = await supabase
    .from("batches")
    .update({
      start_date: v.start_date,
      end_date: v.end_date,
      schedule_days: v.days,
      session_time: v.session_time ?? null,
      capacity: v.capacity,
      coordinator_id: v.coordinator_id ?? null,
    })
    .eq("id", v.id);
  if (error) return fromDb(error);
  refresh();
  return done("Batch details saved");
}

/* =====================================================================
 * Batch → Overview: Cancel batch (+ Undo), Start batch now
 * ===================================================================== */
const CancelForm = z.object({ id: uuid });

/** planned → cancelled, only while nobody is assigned. The reason is not stored. */
export async function cancelBatch(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = CancelForm.safeParse(formToObject(fd));
  if (!parsed.success) return fail("Unknown batch.");
  const { id } = parsed.data;

  const { count } = await supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("batch_id", id).in("status", OPEN);
  if ((count ?? 0) > 0) return fail("Students are still assigned. Remove them in Student 360 first.");

  const { data, error } = await supabase
    .from("batches")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "planned")
    .select("code")
    .maybeSingle();
  if (error) return fromDb(error);
  const code = (data as { code: string } | null)?.code;
  if (!code) return fail("Only a planned batch can be cancelled.");
  refresh();
  return done(`Batch ${code} cancelled`, { undoId: id });
}

/** Undo for cancelBatch: cancelled → planned. */
export async function restoreBatch(id: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!uuid.safeParse(id).success) return fail("Unknown batch.");
  const { data, error } = await supabase
    .from("batches")
    .update({ status: "planned" })
    .eq("id", id)
    .eq("status", "cancelled")
    .select("code")
    .maybeSingle();
  if (error) return fromDb(error);
  const code = (data as { code: string } | null)?.code;
  if (!code) return fail("This batch is not cancelled.");
  refresh();
  return done(`Batch ${code} is planned again`);
}

/** planned → running once the start date is reached (the daily job does the same at 9 am IST). */
export async function startBatch(id: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!uuid.safeParse(id).success) return fail("Unknown batch.");
  const { data, error } = await supabase
    .from("batches")
    .update({ status: "running" })
    .eq("id", id)
    .eq("status", "planned")
    .lte("start_date", todayIST())
    .select("code")
    .maybeSingle();
  if (error) return fromDb(error);
  const code = (data as { code: string } | null)?.code;
  if (!code) return fail("Only a planned batch whose start date has come can be started.");
  refresh();
  return done(`Batch ${code} is running`);
}
