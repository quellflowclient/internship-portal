// Hand-written Phase 1 row types. Replace with `pnpm db:types` output once a Supabase project is linked.

export type UserRole = "super_admin" | "admin" | "mentor" | "student";
export type ProgramTrack = "merit" | "paid" | "self_paced";
export type EngagementType = "free" | "paid" | "stipend";
export type DurationPlan = "d45" | "d90" | "m6";
export type ApplicantStatus = "new" | "shortlisted" | "on_hold" | "not_now" | "converted";
export type EnrollmentStatus =
  | "invited"
  | "offer_sent"
  | "accepted"
  | "payment_pending"
  | "active"
  | "paused"
  | "completed"
  | "withdrawn"
  | "terminated";
export type DocumentType =
  | "offer_letter"
  | "enrollment_letter"
  | "agreement"
  | "certificate_completion"
  | "certificate_excellence"
  | "certificate_project"
  | "experience_letter"
  | "relieving_letter"
  | "lor"
  | "invoice"
  | "grade_report";

export interface Profile {
  id: string;
  role: UserRole;
  is_active: boolean;
  full_name: string | null;
  display_name_on_docs: string | null;
  email: string;
  phone_e164: string | null;
  college: string | null;
  course: string | null;
  year_of_study: string | null;
  created_at: string;
}

export interface Applicant {
  id: string;
  candidate_code: string;
  form_response_id: string | null;
  email: string;
  full_name: string;
  phone_e164: string | null;
  city: string | null;
  college: string | null;
  degree: string | null;
  year_of_study: string | null;
  role_label: string | null;
  role_code: string | null;
  skills: string | null;
  portfolio_url: string | null;
  prev_internship: string | null;
  cv_url: string | null;
  can_start: string | null;
  hours_per_week: string | null;
  work_mode: string | null;
  extra: string | null;
  submitted_at: string | null;
  status: ApplicantStatus;
  notes: string | null;
  profile_id: string | null;
  created_at: string;
}

export interface RoleCatalog {
  code: string;
  name: string;
  track_group: string;
  is_launch_track: boolean;
  form_label: string | null;
  sort: number;
  active: boolean;
}

export interface OrgSettings {
  id: number;
  org_name: string;
  brand_name: string;
  address: string | null;
  llpin: string | null;
  website: string | null;
  contact_email: string | null;
  sender_name: string | null;
  sender_email: string | null;
  verify_base_url: string | null;
  timezone: string;
  academic_year_start_month: number;
  academic_year_label_override: string | null;
}

export interface NumberingScheme {
  id: string;
  doc_type: DocumentType;
  pattern: string;
  reset_per_academic_year: boolean;
  is_active: boolean;
}

export interface Program {
  id: string;
  name: string;
  track: ProgramTrack;
  role_code: string;
  duration: DurationPlan;
  active: boolean;
}

export interface Batch {
  id: string;
  program_id: string;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  capacity: number | null;
  live_slot: string | null;
  status: "planned" | "active" | "completed" | "cancelled";
}
