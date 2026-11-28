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
  PlanItemState,
  PlanKind,
  PayMode,
  AttendanceMark,
  WorkMark,
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

export const PAY_MODES: PayMode[] = ["upi", "imps", "neft", "bank_transfer", "cash", "other"];
export const MODE_LABEL: Record<PayMode, string> = {
  upi: "UPI",
  imps: "IMPS",
  neft: "NEFT",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
};
/** Display word for a stored pay mode (unknown values are shown as stored, empty as "—"). */
export const modeLabel = (m: string | null | undefined) => (m ? (MODE_LABEL[m as PayMode] ?? m) : "—");

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

/** Plan item kinds: a small colour square + text everywhere (never colour alone). */
export const PLAN_KINDS: PlanKind[] = ["session", "task", "test", "milestone", "buffer"];
export const PLAN_KIND: Record<PlanKind, { label: string; tone: Tone; dot: string }> = {
  session: { label: "Session", tone: "info", dot: "bg-info" },
  task: { label: "Task", tone: "vio", dot: "bg-vio" },
  test: { label: "Test", tone: "warn", dot: "bg-warn" },
  milestone: { label: "Milestone", tone: "ok", dot: "bg-ok" },
  buffer: { label: "Buffer", tone: "mute", dot: "bg-line-strong" },
};

export const PLAN_STATE: Record<PlanItemState, { label: string; tone: Tone }> = {
  planned: { label: "Planned", tone: "mute" },
  overdue: { label: "Overdue", tone: "warn" },
  delivered: { label: "Done", tone: "ok" },
  late: { label: "Done late", tone: "warn" },
  skipped: { label: "Skipped", tone: "bad" },
};

/** Which logged kinds take attendance and which take results (the Live track form and src/server/actions/track.ts). */
export const ATTENDANCE_KINDS: PlanKind[] = ["session", "test", "milestone"];
export const RESULT_KINDS: PlanKind[] = ["task", "test"];

export const ATTENDANCE_LABEL: Record<AttendanceMark, string> = { present: "Present", absent: "Absent", leave: "On leave" };
export const WORK_MARK_LABEL: Record<WorkMark, string> = { done: "Done", late: "Late", missing: "Missing", excused: "Excused" };

/** ISO weekday numbers used in batches.schedule_days */
export const WEEKDAYS: [number, string][] = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [7, "Sun"],
];

/** [1,2,3,4,5] → "Mon–Fri"; [2,4,6] → "Tue, Thu, Sat" */
export function scheduleLabel(days: number[] | null | undefined): string {
  const d = [...new Set(days ?? [])].sort((a, b) => a - b);
  if (!d.length) return "No days set";
  const name = (n: number) => WEEKDAYS.find(([k]) => k === n)?.[1] ?? "?";
  const run = d.every((n, i) => i === 0 || n === d[i - 1] + 1);
  return run && d.length >= 3 ? `${name(d[0])}–${name(d[d.length - 1])}` : d.map(name).join(", ");
}
