/**
 * The frozen snapshot of a document (documents.data) and its content hash (docs/19 P6, docs/20 §3–§5).
 * Every printed field is read from the records once, here, so later edits never change an issued document.
 * No "server-only" import: the pure helpers (contentHash, renderPlaceholders) are unit-tested.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STANDALONE_DOC_TYPES } from "@/lib/labels";
import type { DocType, EnrollmentStatus, StudentType } from "@/lib/types";
import { formatDate, todayIST } from "@/lib/utils";

/** documents.data. Dates are ISO (YYYY-MM-DD); `text` is the template wording with every placeholder filled in. */
export interface DocData {
  name: string;
  title: string;
  text: string;
  issue_date: string;
  org_name: string;
  template_version: number;
  programme?: string;
  batch?: string;
  start_date?: string;
  end_date?: string;
  role?: string;
  result?: string;
  project?: string;
  event_title?: string;
  event_dates?: string;
  body?: string;
  early?: boolean;
  signatory?: string;
  signatory_title?: string;
  /** Signature image (PNG data URL), frozen so a later signature change never alters an issued document. */
  signature?: string;
}

export interface SignatoryRow {
  id: string;
  name: string;
  title: string;
  title_on_docs: string | null;
  signature_data: string | null;
  profile_id: string | null;
}

/* ---------- pure helpers ---------- */

/** JSON with object keys sorted at every level and undefined values left out, so equal data hashes equally. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : canonicalJson(v))).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

/** SHA-256 (hex) of the canonical JSON of the snapshot. Stored in documents.content_hash on issue. */
export function contentHash(data: unknown): string {
  return createHash("sha256").update(canonicalJson(data), "utf8").digest("hex");
}

/**
 * Fills `{key}` placeholders. Keys present in `vars` are replaced (null/undefined print as nothing);
 * unknown keys are left as written so a typo is visible on the preview. A literal "\n" (as in the seed SQL) is a line break.
 */
export function renderPlaceholders(text: string, vars: Record<string, string | number | null | undefined>): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\{([a-z_]+)\}/g, (whole, key: string) =>
      Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? "") : whole,
    );
}

/** "2026-12-01" → "01 Dec 2026" (the printed date format). */
export function printDate(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  return formatDate(`${iso.slice(0, 10)}T00:00:00+05:30`);
}

/** The placeholder values for a snapshot (dates printed, not ISO). */
export function placeholderValues(data: Omit<DocData, "text">, extra: Record<string, string | number | null | undefined> = {}) {
  return {
    name: data.name,
    programme: data.programme,
    batch: data.batch,
    start_date: printDate(data.start_date),
    end_date: printDate(data.end_date),
    role: data.role,
    result: data.result,
    project: data.project,
    event_title: data.event_title,
    event_dates: data.event_dates,
    body: data.body,
    issue_date: printDate(data.issue_date),
    org_name: data.org_name,
    ...extra,
  };
}

const IST_DAY = (ts: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(ts));

/* ---------- reading the records ---------- */

export interface SnapshotExtra {
  /** Typed when issuing: LOR / custom certificate text. */
  body?: string | null;
  /** Standalone types: event or title, and dates text. */
  eventTitle?: string | null;
  eventDates?: string | null;
  /** The signatory printed on the document (already resolved for the issuing admin). */
  signatory?: Pick<SignatoryRow, "name" | "title" | "title_on_docs" | "signature_data"> | null;
}

type EnrolmentRow = {
  id: string;
  student_id: string;
  type: StudentType;
  status: EnrollmentStatus;
  start_date: string;
  end_date: string;
  result_note: string | null;
  batch: { code: string; course_plans: { duration_days: number; courses: { code: string; name: string } | null } | null } | null;
};

export type SnapshotResult =
  | { ok: true; data: DocData; templateId: string; templateVersion: number }
  | { ok: false; message: string };

/**
 * Reads the student, enrolment, project, template and settings and returns the frozen `data` object.
 * The end date of an early certificate is the day the enrolment was completed (or today, for an owner override).
 */
export async function buildSnapshot(
  supabase: SupabaseClient,
  type: DocType,
  studentId: string,
  enrollmentId: string | null | undefined,
  extra: SnapshotExtra & { projectId?: string | null } = {},
): Promise<SnapshotResult> {
  const [studentRes, tplRes, orgRes, enrolRes, projectRes, completedRes] = await Promise.all([
    supabase.from("students").select("id, code, full_name, name_on_documents").eq("id", studentId).maybeSingle(),
    supabase.from("document_templates").select("id, version, title, body").eq("type", type).eq("active", true).maybeSingle(),
    supabase.from("org_settings").select("org_name, min_attendance_pct").eq("id", 1).maybeSingle(),
    enrollmentId
      ? supabase
          .from("enrollments")
          .select(
            "id, student_id, type, status, start_date, end_date, result_note, batch:batches(code, course_plans(duration_days, courses(code, name)))",
          )
          .eq("id", enrollmentId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    extra.projectId
      ? supabase.from("projects").select("id, name").eq("id", extra.projectId).maybeSingle()
      : Promise.resolve({ data: null }),
    enrollmentId
      ? supabase
          .from("enrollment_changes")
          .select("changed_at")
          .eq("enrollment_id", enrollmentId)
          .eq("change", "status")
          .eq("to_value", "completed")
          .order("changed_at", { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [] }),
  ]);

  const student = studentRes.data as { id: string; code: string; full_name: string; name_on_documents: string } | null;
  if (!student) return { ok: false, message: "This student no longer exists." };
  const tpl = tplRes.data as { id: string; version: number; title: string; body: string } | null;
  if (!tpl) return { ok: false, message: "There is no active template for this document. An owner can add one in Settings, Templates." };
  const org = orgRes.data as { org_name: string | null; min_attendance_pct: number | null } | null;
  const enrol = enrolRes.data as unknown as EnrolmentRow | null;
  if (enrollmentId && (!enrol || enrol.student_id !== studentId)) {
    return { ok: false, message: "Pick an enrolment of this student." };
  }
  const project = projectRes.data as { id: string; name: string } | null;
  if (extra.projectId && !project) return { ok: false, message: "This project no longer exists." };

  const today = todayIST();
  const standalone = STANDALONE_DOC_TYPES.includes(type);
  const data: Omit<DocData, "text"> = {
    name: student.name_on_documents.trim(),
    title: tpl.title,
    issue_date: today,
    org_name: org?.org_name || "Quellflow Technologies LLP",
    template_version: tpl.version,
  };

  if (enrol) {
    const course = enrol.batch?.course_plans?.courses;
    const days = enrol.batch?.course_plans?.duration_days;
    if (course) data.programme = days ? `${course.name}, ${days} days` : course.name;
    if (course) data.role = course.name;
    if (enrol.batch?.code) data.batch = enrol.batch.code;
    data.start_date = enrol.start_date;
    data.end_date = enrol.end_date;
    if (type === "certificate" || type === "experience") {
      const completedRow = ((completedRes.data ?? []) as { changed_at: string }[])[0];
      const completedOn = enrol.status === "completed" && completedRow ? IST_DAY(completedRow.changed_at) : null;
      const actualEnd = completedOn ?? (enrol.status !== "completed" ? today : null);
      if (actualEnd && actualEnd < enrol.end_date && actualEnd >= enrol.start_date) {
        data.end_date = actualEnd;
        data.early = true;
      }
    }
    if (type === "certificate") data.result = enrol.result_note?.trim() || "Completed";
  }
  if (project) data.project = project.name;
  if (standalone || extra.eventTitle) {
    if (extra.eventTitle?.trim()) data.event_title = extra.eventTitle.trim();
    if (extra.eventDates?.trim()) data.event_dates = extra.eventDates.trim();
    if (standalone && data.event_title) data.programme = data.event_title;
  }
  if (extra.body?.trim()) data.body = extra.body.trim();

  const sig = extra.signatory;
  if (sig) {
    data.signatory = sig.name;
    data.signatory_title = sig.title_on_docs?.trim() || sig.title;
    if (sig.signature_data) data.signature = sig.signature_data;
  }

  const text = renderPlaceholders(
    tpl.body,
    placeholderValues(data, {
      student_type: enrol?.type ?? "",
      min_attendance: org?.min_attendance_pct ?? 75,
    }),
  ).trim();

  return { ok: true, data: { ...data, text }, templateId: tpl.id, templateVersion: tpl.version };
}

/**
 * The signatory who signs: the issuing admin's own active row, or (owners only) another active signatory.
 * Mirrors public.issue_document so the frozen snapshot names the same person the database records.
 */
export async function resolveSignatory(
  supabase: SupabaseClient,
  userId: string,
  requestedId?: string | null,
): Promise<SignatoryRow | null> {
  const fields = "id, name, title, title_on_docs, signature_data, profile_id";
  const { data: own } = await supabase.from("signatories").select(fields).eq("profile_id", userId).eq("is_active", true).maybeSingle();
  const mine = own as SignatoryRow | null;
  if (!requestedId || requestedId === mine?.id) return mine;
  const { data } = await supabase.from("signatories").select(fields).eq("id", requestedId).eq("is_active", true).maybeSingle();
  return (data as SignatoryRow | null) ?? null;
}
