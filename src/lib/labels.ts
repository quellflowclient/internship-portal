import type {
  ActivityKind,
  BatchStatus,
  DisplayStatus,
  DocType,
  EnrollmentStatus,
  LeadSource,
  LeadStage,
  LostReason,
  MoneyCategory,
  StudentType,
  Tone,
  UserRole,
} from "./types";

/** Display words and colours for every enum. Status pills always show text, never colour alone. */
export const ROLE_LABEL: Record<UserRole, string> = { admin: "Admin", student: "Student" };

export const STAGES: LeadStage[] = ["new", "contacted", "interested", "counselling", "converted", "lost"];
export const STAGE: Record<LeadStage, { label: string; tone: Tone }> = {
  new: { label: "New", tone: "info" },
  contacted: { label: "Contacted", tone: "mute" },
  interested: { label: "Interested", tone: "acc" },
  counselling: { label: "Counselling", tone: "vio" },
  converted: { label: "Converted", tone: "ok" },
  lost: { label: "Lost", tone: "bad" },
};

export const SOURCE_LABEL: Record<LeadSource, string> = {
  form: "Form",
  whatsapp: "WhatsApp",
  referral: "Referral",
  walk_in: "Walk-in",
  other: "Other",
};

export const LOST_REASON_LABEL: Record<LostReason, string> = {
  not_interested: "Not interested",
  no_response: "No response",
  not_eligible: "Not eligible",
  joined_elsewhere: "Joined elsewhere",
  duplicate: "Duplicate",
  spam: "Spam",
};

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  call: "Call",
  whatsapp: "WhatsApp",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
  system: "Update",
};

export const TYPE: Record<StudentType, { label: string; tone: Tone }> = {
  paid: { label: "Paid", tone: "acc" },
  free: { label: "Free", tone: "mute" },
  stipend: { label: "Stipend", tone: "vio" },
};

export const DISPLAY_STATUS: Record<DisplayStatus, { label: string; tone: Tone }> = {
  not_assigned: { label: "Not assigned", tone: "info" },
  at_risk: { label: "At risk", tone: "warn" },
  active: { label: "Active", tone: "ok" },
  alumni: { label: "Alumni", tone: "mute" },
  archived: { label: "Archived", tone: "mute" },
};

export const ENROLLMENT_STATUS: Record<EnrollmentStatus, { label: string; tone: Tone }> = {
  assigned: { label: "Assigned", tone: "info" },
  active: { label: "Active", tone: "ok" },
  completed: { label: "Completed", tone: "ok" },
  not_completed: { label: "Not completed", tone: "warn" },
  withdrawn: { label: "Withdrawn", tone: "mute" },
  dropped: { label: "Dropped", tone: "bad" },
  transferred: { label: "Transferred", tone: "mute" },
};

export const BATCH_STATUS: Record<BatchStatus, { label: string; tone: Tone }> = {
  planned: { label: "Planned", tone: "info" },
  running: { label: "Running", tone: "ok" },
  completed: { label: "Completed", tone: "mute" },
  cancelled: { label: "Cancelled", tone: "bad" },
};

export const MONEY_CATEGORY_LABEL: Record<MoneyCategory, string> = {
  fee: "Fee in",
  refund: "Refund",
  stipend: "Stipend",
  bonus: "Bonus",
  other_in: "Other in",
  other_out: "Other out",
};

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  offer: "Offer letter",
  tnc: "Terms and conditions",
  consent: "Consent",
  joining: "Joining letter",
  certificate: "Internship certificate",
  experience: "Experience letter",
  lor: "Letter of recommendation",
  project_certificate: "Project certificate",
};

export const DOC_DISPLAY: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "mute" },
  awaiting: { label: "Awaiting", tone: "warn" },
  issued: { label: "Issued", tone: "acc" },
  accepted: { label: "Accepted", tone: "ok" },
  revoked: { label: "Revoked", tone: "bad" },
  superseded: { label: "Superseded", tone: "mute" },
};
