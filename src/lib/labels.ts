import type {
  ApplicantStatus,
  DocumentType,
  DurationPlan,
  EngagementType,
  EnrollmentStatus,
  ProgramTrack,
  UserRole,
} from "./types";

export const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  mentor: "Mentor",
  student: "Student",
};

export const TRACK_LABEL: Record<ProgramTrack, string> = {
  merit: "Track A – Merit Internship",
  paid: "Track B – Training + Internship",
  self_paced: "Track C – Self-paced",
};

export const DURATION_LABEL: Record<DurationPlan, string> = {
  d45: "45 days",
  d90: "90 days",
  m6: "6 months",
};

export const ENGAGEMENT_LABEL: Record<EngagementType, string> = {
  free: "Free",
  paid: "Paid (fee)",
  stipend: "Stipend",
};

export const APPLICANT_STATUS_LABEL: Record<ApplicantStatus, string> = {
  new: "New",
  shortlisted: "Shortlisted",
  on_hold: "On hold",
  not_now: "Not now",
  converted: "Converted",
};

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  invited: "Invited",
  offer_sent: "Offer sent",
  accepted: "Accepted",
  payment_pending: "Payment pending",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  withdrawn: "Withdrawn",
  terminated: "Terminated",
};

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  offer_letter: "Offer letter",
  enrollment_letter: "Enrollment letter",
  agreement: "Internship agreement",
  certificate_completion: "Certificate of completion",
  certificate_excellence: "Certificate of excellence",
  certificate_project: "Project certificate",
  experience_letter: "Experience letter",
  relieving_letter: "Relieving letter",
  lor: "Letter of recommendation",
  invoice: "Invoice",
  grade_report: "Grade report",
};

/** Shared status colour mapping (docs/11_UI_UX_GUIDE.md). */
export const STATUS_TONE: Record<string, string> = {
  new: "bg-blue-100 text-blue-900",
  invited: "bg-blue-100 text-blue-900",
  shortlisted: "bg-green-100 text-green-900",
  active: "bg-green-100 text-green-900",
  accepted: "bg-green-100 text-green-900",
  completed: "bg-green-100 text-green-900",
  converted: "bg-violet-100 text-violet-900",
  on_hold: "bg-amber-100 text-amber-900",
  offer_sent: "bg-amber-100 text-amber-900",
  payment_pending: "bg-amber-100 text-amber-900",
  paused: "bg-amber-100 text-amber-900",
  not_now: "bg-red-100 text-red-900",
  withdrawn: "bg-red-100 text-red-900",
  terminated: "bg-red-100 text-red-900",
};
