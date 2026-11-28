"use server";

/**
 * Students and enrolments (docs/19 §7, rows Students and Student 360).
 * Owners: New student = Students list; profile edit + archive = Student 360 → Profile;
 * assign / change / remove = Student 360 → Enrolment. Undo = reverse action (DB-8).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/server/guard";
import { done, fail, fromDb, fromZod, type ActionResult } from "@/server/result";
import {
  emailSchema,
  formToObject,
  indianPhone,
  optionalDate,
  optionalText,
  optionalUrl,
  requiredText,
  uuid,
} from "@/lib/validators";
import type { EnrollmentStatus, StudentType } from "@/lib/types";

const TYPES = ["paid", "free", "stipend"] as const;
const OPEN: EnrollmentStatus[] = ["assigned", "active"];

/* ---------- small schema helpers ---------- */
const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(uuid.nullable())
  .nullish();

const optionalYear = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 6) {
      ctx.addIssue({ code: "custom", message: "Pick a year from 1 to 6" });
      return z.NEVER;
    }
    return n;
  })
  .nullish();

/** "4,999" / "₹4999" / "" → 4999 / null. Whole rupees only. */
const optionalRupees = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v.replace(/[₹,\s]/g, ""));
      if (!Number.isInteger(n) || n < 0 || n > 10_000_000) {
        ctx.addIssue({ code: "custom", message: `${label}: enter whole rupees` });
        return z.NEVER;
      }
      return n;
    })
    .nullish();

const studentPath = (code: string) => `/admin/students/${encodeURIComponent(code)}`;

function refresh(code?: string | null) {
  revalidatePath("/admin/students");
  if (code) revalidatePath(studentPath(code));
  revalidatePath("/admin");
}

function isDuplicateEmail(error: { code?: string; message?: string } | null) {
  return error?.code === "23505" && /email/i.test(error.message ?? "");
}

/* =====================================================================
 * Students list → New student (also the target of "Convert to student")
 * ===================================================================== */
const NewStudent = z.object({
  full_name: requiredText(120, "Full name"),
  phone: indianPhone,
  email: emailSchema,
  college: requiredText(160, "College"),
  course: optionalText(120),
  year: optionalYear,
  planned_type: z.enum(TYPES).nullish(),
  planned_course_plan_id: optionalId,
  lead: optionalId,
});

export async function createStudent(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = NewStudent.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const { data: id, error } = await supabase.rpc("create_student", {
    p_full_name: v.full_name,
    p_email: v.email,
    p_phone: v.phone,
    p_college: v.college,
    p_course: v.course ?? null,
    p_year: v.year ?? null,
    p_planned_type: v.planned_type ?? null,
    p_planned_course_plan: v.planned_course_plan_id ?? null,
    p_lead: v.lead ?? null,
  });
  if (isDuplicateEmail(error)) {
    return fail("A student with this email already exists.", { email: "A student with this email already exists." });
  }
  if (error || !id) return fromDb(error);

  const { data: row } = await supabase.from("students").select("code").eq("id", id as string).maybeSingle();
  const code = (row as { code: string } | null)?.code;
  refresh(code);
  if (v.lead) revalidatePath("/admin/leads");
  if (!code) return done("Student created. Assign a batch next.", { redirectTo: "/admin/students" });
  return done(`Student ${code} created. Assign a batch next.`, { redirectTo: studentPath(code) });
}

/* =====================================================================
 * Student 360 → Profile: edit, archive (+ restore)
 * ===================================================================== */
const ProfileForm = z.object({
  id: uuid,
  code: z.string().trim().min(1),
  name_on_documents: requiredText(120, "Name on documents"),
  full_name: requiredText(120, "Full name"),
  phone: indianPhone,
  email: emailSchema,
  city: optionalText(80),
  college: requiredText(160, "College"),
  course: optionalText(120),
  year: optionalYear,
  github_url: optionalUrl,
  linkedin_url: optionalUrl,
  dob: optionalDate,
});

export async function updateProfile(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = ProfileForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const { data: before } = await supabase.from("students").select("email, user_id").eq("id", v.id).maybeSingle();
  const old = before as { email: string; user_id: string | null } | null;
  if (!old) return fail("This student no longer exists.");

  const { error } = await supabase
    .from("students")
    .update({
      name_on_documents: v.name_on_documents,
      full_name: v.full_name,
      phone: v.phone,
      email: v.email,
      city: v.city ?? null,
      college: v.college,
      course: v.course ?? null,
      year_of_study: v.year ?? null,
      github_url: v.github_url ?? null,
      linkedin_url: v.linkedin_url ?? null,
      dob: v.dob ?? null,
    })
    .eq("id", v.id);
  if (isDuplicateEmail(error)) {
    return fail("Another student already uses this email.", { email: "Another student already uses this email." });
  }
  if (error) return fromDb(error);

  // Not signed in yet: move the pending sign-in invite to the new email.
  if (old.email !== v.email && !old.user_id) {
    await supabase
      .from("invitations")
      .update({ email: v.email })
      .eq("student_id", v.id)
      .is("accepted_at", null)
      .is("revoked_at", null);
  }
  refresh(v.code);
  return done("Profile saved");
}

const ArchiveForm = z.object({
  id: uuid,
  code: z.string().trim().min(1),
  reason: requiredText(300, "Reason"),
});

export async function archiveStudent(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = ArchiveForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const { count } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("student_id", v.id)
    .in("status", OPEN);
  if ((count ?? 0) > 0) return fail("Remove the student from the batch first (Student 360, Enrolment).");

  const { error } = await supabase
    .from("students")
    .update({ state: "archived", archived_reason: v.reason })
    .eq("id", v.id)
    .neq("state", "archived");
  if (error) return fromDb(error);
  await supabase.from("activities").insert({ student_id: v.id, kind: "system", summary: `Archived: ${v.reason}` });
  refresh(v.code);
  return done("Student archived", { undoId: v.id });
}

export async function restoreStudent(id: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!uuid.safeParse(id).success) return fail("Unknown student.");
  const { data, error } = await supabase
    .from("students")
    .update({ state: "active", archived_reason: null })
    .eq("id", id)
    .eq("state", "archived")
    .select("code")
    .maybeSingle();
  if (error) return fromDb(error);
  const code = (data as { code: string } | null)?.code;
  if (!code) return fail("This student is not archived.");
  await supabase.from("activities").insert({ student_id: id, kind: "system", summary: "Restored from the archive" });
  refresh(code);
  return done("Student restored");
}

/* =====================================================================
 * Student 360 → Enrolment: assign, change, remove (+ restore)
 * ===================================================================== */
const AssignForm = z
  .object({
    student_id: uuid,
    code: z.string().trim().min(1),
    batch_id: z.string().trim().min(1, "Pick a batch").pipe(uuid),
    type: z.enum(TYPES, "Pick the student type"),
    fee: optionalRupees("Fee"),
    free_reason: optionalText(300),
    stipend_monthly: optionalRupees("Monthly stipend"),
    stipend_note: optionalText(200),
    capacity_reason: optionalText(300),
  })
  .superRefine((v, ctx) => {
    if (v.type === "paid" && v.fee === 0) {
      ctx.addIssue({ code: "custom", path: ["fee"], message: "A Paid fee must be more than ₹0. Use Free instead." });
    }
    if (v.type === "free" && !v.free_reason) {
      ctx.addIssue({ code: "custom", path: ["free_reason"], message: "Say why this student is free" });
    }
    if (v.type === "stipend" && v.stipend_monthly === 0) {
      ctx.addIssue({ code: "custom", path: ["stipend_monthly"], message: "The monthly stipend must be more than ₹0" });
    }
  });

export async function assignStudent(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = AssignForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const { error } = await supabase.rpc("assign_student", {
    p_student: v.student_id,
    p_batch: v.batch_id,
    p_type: v.type,
    p_fee: v.type === "paid" ? (v.fee ?? null) : null,
    p_free_reason: v.type === "free" ? (v.free_reason ?? null) : null,
    p_stipend_monthly: v.type === "stipend" ? (v.stipend_monthly ?? null) : null,
    p_stipend_note: v.type === "stipend" ? (v.stipend_note ?? null) : null,
    p_capacity_reason: v.capacity_reason ?? null,
  });
  if (error) {
    if (error.code === "23505") return fail("This student is already in that batch.");
    if (/batch is full/i.test(error.message ?? "")) {
      const msg = error.message.replace(/^ERROR:\s*/i, "");
      return fail(msg, { capacity_reason: msg });
    }
    return fromDb(error);
  }
  const { data: b } = await supabase.from("batches").select("code").eq("id", v.batch_id).maybeSingle();
  refresh(v.code);
  revalidatePath("/admin/batches");
  return done(`Assigned to ${(b as { code: string } | null)?.code ?? "the batch"}`);
}

const ChangeForm = z
  .object({
    enrollment_id: uuid,
    code: z.string().trim().min(1),
    type: z.enum(TYPES, "Pick the student type"),
    fee: optionalRupees("Fee"),
    stipend_monthly: optionalRupees("Monthly stipend"),
    stipend_note: optionalText(200),
    reason: requiredText(300, "Reason"),
  })
  .superRefine((v, ctx) => {
    if (v.type === "paid" && !v.fee) {
      ctx.addIssue({ code: "custom", path: ["fee"], message: "Enter the agreed fee for a Paid student" });
    }
    if (v.type === "stipend" && v.stipend_monthly === 0) {
      ctx.addIssue({ code: "custom", path: ["stipend_monthly"], message: "The monthly stipend must be more than ₹0" });
    }
  });

interface EnrollmentRow {
  id: string;
  student_id: string;
  type: StudentType;
  status: EnrollmentStatus;
  start_date: string;
  fee_inr: number | null;
  free_reason: string | null;
}

export async function changeEnrollment(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase, profile } = await assertAdmin();
  const parsed = ChangeForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const { data } = await supabase
    .from("enrollments")
    .select("id, student_id, type, status, start_date, fee_inr, free_reason")
    .eq("id", v.enrollment_id)
    .maybeSingle();
  const e = data as EnrollmentRow | null;
  if (!e) return fail("This enrolment no longer exists.");
  if (!OPEN.includes(e.status)) return fail("Only an assigned or active enrolment can be changed.");

  const newFee = v.type === "paid" ? (v.fee ?? null) : null;
  const update: Record<string, unknown> = {};
  if (v.type !== e.type) update.type = v.type;
  if (newFee !== e.fee_inr) update.fee_inr = newFee;
  if (v.type === "free" && !e.free_reason) {
    update.free_reason = v.reason;
    update.approved_by = profile.id;
  }

  // Stipend agreement first: an active enrolment cannot become Stipend without one.
  let stipendChanged = false;
  if (v.type === "stipend" && v.stipend_monthly) {
    const { data: ag } = await supabase
      .from("stipend_agreements")
      .select("id, monthly_inr, agreed_note")
      .eq("enrollment_id", e.id)
      .order("from_month", { ascending: false })
      .limit(1)
      .maybeSingle();
    const cur = ag as { id: string; monthly_inr: number; agreed_note: string | null } | null;
    if (!cur) {
      const from = `${e.start_date.slice(0, 7)}-01`;
      const { error } = await supabase
        .from("stipend_agreements")
        .insert({ enrollment_id: e.id, monthly_inr: v.stipend_monthly, from_month: from, agreed_note: v.stipend_note ?? null });
      if (error) return fromDb(error);
      stipendChanged = true;
    } else if (cur.monthly_inr !== v.stipend_monthly || (v.stipend_note ?? null) !== cur.agreed_note) {
      const { error } = await supabase
        .from("stipend_agreements")
        .update({ monthly_inr: v.stipend_monthly, agreed_note: v.stipend_note ?? null })
        .eq("id", cur.id);
      if (error) return fromDb(error);
      stipendChanged = true;
    }
  }

  if (Object.keys(update).length === 0) {
    if (!stipendChanged) return fail("Nothing changed. Pick a different type or fee.");
    refresh(v.code);
    return done("Stipend agreement saved");
  }

  update.change_reason = v.reason;
  const { error } = await supabase.from("enrollments").update(update).eq("id", e.id);
  if (error) return fromDb(error);
  if (update.type) {
    await supabase
      .from("activities")
      .insert({ student_id: e.student_id, enrollment_id: e.id, kind: "system", summary: `Type changed to ${v.type}: ${v.reason}` });
  }
  refresh(v.code);
  return done("Enrolment changed");
}

const RemoveForm = z.object({
  enrollment_id: uuid,
  code: z.string().trim().min(1),
  reason: requiredText(300, "Reason"),
});

const REMOVED_MARK = "Removed from batch";

export async function removeEnrollment(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = RemoveForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const { data } = await supabase
    .from("enrollments")
    .select("id, student_id, status, batch:batches(code)")
    .eq("id", v.enrollment_id)
    .maybeSingle();
  const e = data as { id: string; student_id: string; status: EnrollmentStatus; batch: { code: string } | null } | null;
  if (!e) return fail("This enrolment no longer exists.");
  if (!OPEN.includes(e.status)) return fail("This student is no longer in the batch.");

  const next: EnrollmentStatus = e.status === "assigned" ? "withdrawn" : "dropped";
  const { error } = await supabase
    .from("enrollments")
    .update({ status: next, exit_reason: v.reason })
    .eq("id", e.id)
    .eq("status", e.status);
  if (error) return fromDb(error);

  // Open stipend rows for this enrolment are voided (docs/19 §7); Undo brings them back.
  await supabase
    .from("money_entries")
    .update({ status: "void", void_reason: `${REMOVED_MARK}: ${v.reason}` })
    .eq("enrollment_id", e.id)
    .eq("category", "stipend")
    .eq("status", "expected");
  await supabase.from("activities").insert({
    student_id: e.student_id,
    enrollment_id: e.id,
    kind: "system",
    summary: `Removed from ${e.batch?.code ?? "the batch"}: ${v.reason}`,
  });
  refresh(v.code);
  revalidatePath("/admin/batches");
  return done(`Removed from ${e.batch?.code ?? "the batch"}`, { undoId: `${e.id}:${e.status}` });
}

export async function restoreEnrollment(undoId: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const [id, prev] = undoId.split(":");
  if (!uuid.safeParse(id).success || !OPEN.includes(prev as EnrollmentStatus)) return fail("Nothing to undo.");

  const { data, error } = await supabase
    .from("enrollments")
    .update({ status: prev, exit_reason: null, change_reason: "Undo removal" })
    .eq("id", id)
    .in("status", ["withdrawn", "dropped"])
    .select("id, student_id, student:students(code), batch:batches(code)")
    .maybeSingle();
  if (error) return fromDb(error);
  const row = data as { student_id: string; student: { code: string } | null; batch: { code: string } | null } | null;
  if (!row) return fail("This enrolment was changed since. Nothing to undo.");

  await supabase
    .from("money_entries")
    .update({ status: "expected" })
    .eq("enrollment_id", id)
    .eq("category", "stipend")
    .eq("status", "void")
    .like("void_reason", `${REMOVED_MARK}:%`);
  await supabase
    .from("activities")
    .insert({ student_id: row.student_id, enrollment_id: id, kind: "system", summary: `Back in ${row.batch?.code ?? "the batch"} (removal undone)` });
  refresh(row.student?.code);
  revalidatePath("/admin/batches");
  return done(`Back in ${row.batch?.code ?? "the batch"}`);
}

/* =====================================================================
 * Student 360 → Enrolment: move to another batch (transfer). No Undo: move the student back.
 * New enrolment via assign_student (same type, fee / free reason / stipend copied),
 * then the old one becomes "transferred" and points to the new one (docs/19 §6).
 * ===================================================================== */
const TransferForm = z.object({
  enrollment_id: uuid,
  code: z.string().trim().min(1),
  batch_id: z.string().trim().min(1, "Pick a batch").pipe(uuid),
  reason: requiredText(300, "Reason"),
  capacity_reason: optionalText(300),
});

const batchPagePath = (code: string) => `/admin/batches/${encodeURIComponent(code)}`;

export async function transferEnrollment(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = TransferForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const { data } = await supabase
    .from("enrollments")
    .select("id, student_id, batch_id, type, status, fee_inr, free_reason, batch:batches(code)")
    .eq("id", v.enrollment_id)
    .maybeSingle();
  const e = data as
    | (Pick<EnrollmentRow, "id" | "student_id" | "type" | "status" | "fee_inr" | "free_reason"> & {
        batch_id: string;
        batch: { code: string } | null;
      })
    | null;
  if (!e) return fail("This enrolment no longer exists.");
  if (!OPEN.includes(e.status)) return fail("Only an assigned or active enrolment can be moved.");
  if (e.batch_id === v.batch_id) return fail("Please fix the highlighted fields.", { batch_id: "Pick a different batch" });

  const { data: target } = await supabase.from("batches").select("code, status").eq("id", v.batch_id).maybeSingle();
  const to = target as { code: string; status: string } | null;
  if (!to) return fail("That batch no longer exists.");
  if (to.status !== "planned" && to.status !== "running") return fail(`${to.code} is not open. Pick a planned or running batch.`);

  type Agreement = { monthly_inr: number; agreed_note: string | null };
  let stipend: Agreement | null = null;
  if (e.type === "stipend") {
    const { data: ag } = await supabase
      .from("stipend_agreements")
      .select("monthly_inr, agreed_note")
      .eq("enrollment_id", e.id)
      .order("from_month", { ascending: false })
      .limit(1)
      .maybeSingle();
    stipend = ag as Agreement | null;
  }

  const { data: newId, error } = await supabase.rpc("assign_student", {
    p_student: e.student_id,
    p_batch: v.batch_id,
    p_type: e.type,
    p_fee: e.type === "paid" ? e.fee_inr : null,
    p_free_reason: e.type === "free" ? (e.free_reason ?? v.reason) : null,
    p_stipend_monthly: stipend?.monthly_inr ?? null,
    p_stipend_note: stipend?.agreed_note ?? null,
    p_capacity_reason: v.capacity_reason ?? null,
  });
  if (error || !newId) {
    if (error?.code === "23505") return fail("This student is already in that batch.");
    if (/batch is full/i.test(error?.message ?? "")) {
      const msg = error!.message.replace(/^ERROR:\s*/i, "");
      return fail(msg, { capacity_reason: msg });
    }
    return fromDb(error);
  }

  const { data: moved, error: upErr } = await supabase
    .from("enrollments")
    .update({ status: "transferred", exit_reason: v.reason, transferred_to_id: newId as string, change_reason: v.reason })
    .eq("id", e.id)
    .eq("status", e.status)
    .select("id")
    .maybeSingle();
  if (upErr || !moved) {
    await supabase.from("enrollments").update({ status: "withdrawn", exit_reason: "Transfer failed" }).eq("id", newId as string);
    return upErr ? fromDb(upErr) : fail("This enrolment changed while you were moving it. Nothing was moved.");
  }

  await supabase.from("activities").insert({
    student_id: e.student_id,
    enrollment_id: e.id,
    kind: "system",
    summary: `Moved from ${e.batch?.code ?? "the batch"} to ${to.code}: ${v.reason}`,
  });
  refresh(v.code);
  revalidatePath("/admin/batches");
  if (e.batch?.code) revalidatePath(batchPagePath(e.batch.code), "layout");
  revalidatePath(batchPagePath(to.code), "layout");
  return done(`Moved to ${to.code}`);
}
