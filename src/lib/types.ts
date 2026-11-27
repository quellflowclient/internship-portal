// Row types for plan v2 (supabase/migrations/20261128*). Hand-written; keep in sync with docs/19 §2.

export type UserRole = "admin" | "student";
export type LeadStage = "new" | "contacted" | "interested" | "counselling" | "converted" | "lost";
export type LeadSource = "form" | "whatsapp" | "referral" | "walk_in" | "other";
export type LostReason = "not_interested" | "no_response" | "not_eligible" | "joined_elsewhere" | "duplicate" | "spam";
export type ActivityKind = "call" | "whatsapp" | "email" | "meeting" | "note" | "system";
export type StudentType = "paid" | "free" | "stipend";
export type StudentState = "active" | "alumni" | "archived";
export type BatchStatus = "planned" | "running" | "completed" | "cancelled";
export type EnrollmentStatus = "assigned" | "active" | "completed" | "not_completed" | "withdrawn" | "dropped" | "transferred";
export type DisplayStatus = "not_assigned" | "at_risk" | "active" | "alumni" | "archived";
export type MoneyCategory = "fee" | "refund" | "stipend" | "bonus" | "other_in" | "other_out";
export type MoneyStatus = "expected" | "done" | "void";
export type DocType = "offer" | "tnc" | "consent" | "joining" | "certificate" | "experience" | "lor" | "project_certificate";
export type DocStatus = "draft" | "issued" | "accepted" | "revoked" | "superseded";
export type Tone = "ok" | "warn" | "bad" | "info" | "vio" | "acc" | "mute";
export type PlanKind = "session" | "task" | "test" | "milestone" | "buffer";
export type PlanItemState = "planned" | "overdue" | "delivered" | "late" | "skipped";
export type AttendanceMark = "present" | "absent" | "leave";
export type WorkMark = "done" | "late" | "missing" | "excused";

export interface Profile {
  id: string;
  role: UserRole;
  is_owner: boolean;
  is_active: boolean;
  full_name: string | null;
  email: string;
  phone: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  code: string;
  form_response_id: string | null;
  source: LeadSource;
  full_name: string;
  phone: string | null;
  email: string | null;
  college: string | null;
  course: string | null;
  year_of_study: string | null;
  interested_track: string | null;
  answers: Record<string, unknown>;
  stage: LeadStage;
  lost_reason: LostReason | null;
  lost_note: string | null;
  owner_id: string | null;
  next_follow_up_on: string | null;
  last_contacted_at: string | null;
  student_id: string | null;
  submitted_at: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  lead_id: string | null;
  student_id: string | null;
  enrollment_id: string | null;
  kind: ActivityKind;
  summary: string;
  outcome: string | null;
  occurred_at: string;
  created_by: string | null;
}

export interface Student {
  id: string;
  code: string;
  lead_id: string | null;
  user_id: string | null;
  full_name: string;
  name_on_documents: string;
  email: string;
  phone: string;
  dob: string | null;
  city: string | null;
  college: string;
  course: string | null;
  year_of_study: number | null;
  github_url: string | null;
  linkedin_url: string | null;
  planned_type: StudentType | null;
  planned_course_plan_id: string | null;
  state: StudentState;
  archived_reason: string | null;
  kyc_saved: Record<string, boolean>;
  created_at: string;
}

/** public.v_student_list */
export interface StudentListRow {
  id: string;
  code: string;
  full_name: string;
  email: string;
  phone: string;
  college: string;
  course: string | null;
  year_of_study: number | null;
  state: StudentState;
  enrollment_id: string | null;
  batch_id: string | null;
  batch_code: string | null;
  type: StudentType | null;
  attendance_pct: number | null;
  fee_pending: number | null;
  display_status: DisplayStatus;
}

export interface CoursePlanOption {
  id: string;
  duration_days: number;
  fee_inr: number;
  course: { code: string; name: string };
}

export interface Batch {
  id: string;
  code: string;
  course_plan_id: string;
  start_date: string;
  end_date: string;
  schedule_days: number[];
  session_time: string | null;
  capacity: number;
  status: BatchStatus;
  whatsapp_url: string | null;
  classroom_url: string | null;
  meet_url: string | null;
  playlist_url: string | null;
  drive_url: string | null;
  github_url: string | null;
}

export interface Enrollment {
  id: string;
  student_id: string;
  batch_id: string;
  type: StudentType;
  status: EnrollmentStatus;
  assigned_on: string;
  start_date: string;
  end_date: string;
  fee_inr: number | null;
  free_reason: string | null;
  exit_reason: string | null;
  result_note: string | null;
  created_at: string;
}

/** public.v_enrollment_stats */
export interface EnrollmentStats {
  enrollment_id: string;
  student_id: string;
  batch_id: string;
  marked: number;
  present: number;
  attendance_pct: number | null;
  given: number;
  done: number;
  tasks_pct: number | null;
  quiz_avg: number | null;
  eligible: boolean;
}

export interface MoneyEntry {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  category: MoneyCategory;
  direction: "in" | "out";
  amount_inr: number;
  status: MoneyStatus;
  period_month: string | null;
  due_on: string | null;
  paid_on: string | null;
  mode: string | null;
  ref_last4: string | null;
  note: string | null;
  proof_saved: boolean;
}

/** public.v_document_list */
export interface DocumentListRow {
  id: string;
  type: DocType;
  number: string | null;
  status: DocStatus;
  student_id: string;
  student_name: string;
  student_code: string;
  enrollment_id: string | null;
  issued_at: string | null;
  display_status: string;
  scans: number;
}

/** public.v_attention */
export interface AttentionRow {
  key: string;
  tone: Tone;
  n: number;
  label: string;
  route: string;
  filters: Record<string, string>;
}

/** public.v_batch_progress */
export interface BatchProgress {
  batch_id: string;
  code: string;
  status: BatchStatus;
  done: number;
  planned: number;
  skipped: number;
  unplanned: number;
  days_behind: number;
  day_x: number;
  day_n: number;
  next_item_id: string | null;
}

export interface OrgSettings {
  id: number;
  org_name: string;
  brand_name: string;
  address: string | null;
  website: string | null;
  contact_email: string | null;
  support_whatsapp: string | null;
  verify_base_url: string | null;
  local_files_root: string;
  min_attendance_pct: number;
  min_task_pct: number;
  holidays: string[];
  stipend_pay_by_day: number;
  timezone: string;
  academic_year_start_month: number;
}

export interface PlanResource {
  label: string;
  url: string;
}

export interface BatchPlan {
  id: string;
  batch_id: string;
  published_version: number;
  has_unpublished_changes: boolean;
  share_token: string;
  share_enabled: boolean;
  show_done_marks: boolean;
  updated_at: string;
}

/** Draft plan item (public.batch_plan_items) */
export interface BatchPlanItem {
  id: string;
  batch_plan_id: string;
  seq: number;
  week: number;
  planned_date: string;
  kind: PlanKind;
  title: string;
  description: string | null;
  resources: PlanResource[];
  duration_min: number | null;
  skipped_at: string | null;
  skip_reason: string | null;
  deleted_at: string | null;
}

/** public.v_plan_item_status */
export interface PlanItemStatusRow {
  id: string;
  batch_id: string;
  batch_plan_id: string;
  seq: number;
  week: number;
  planned_date: string;
  kind: PlanKind;
  title: string;
  skip_reason: string | null;
  delivered_on: string | null;
  delay_days: number | null;
  status: PlanItemState;
}

export interface BatchPlanVersion {
  id: string;
  batch_plan_id: string;
  version: number;
  published_at: string;
  change_note: string | null;
  items: { id: string; seq: number; week: number; date: string; kind: PlanKind; title: string; description: string | null; resources: PlanResource[] }[];
}

export interface TrackEntry {
  id: string;
  batch_id: string;
  plan_item_id: string | null;
  held_on: string;
  kind: PlanKind;
  title: string;
  link: string | null;
  note: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface PlanTemplateItem {
  id: string;
  template_id: string;
  seq: number;
  week: number;
  day_offset: number;
  kind: PlanKind;
  title: string;
  description: string | null;
  resources: PlanResource[];
  duration_min: number | null;
}

/** Batch with its course plan and course (as loaded by getBatch) */
export type BatchFull = Batch & {
  created_at: string;
  course_plans: { id: string; duration_days: number; fee_inr: number; courses: { code: string; name: string } };
};
