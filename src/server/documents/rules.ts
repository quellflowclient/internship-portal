/**
 * Document rules shared by the issue form (client), the server actions and the PDF engine.
 * Pure data, no server imports (docs/20_DOCUMENTS_SPEC.md §4, §5).
 */
import type { DocType } from "@/lib/types";

/** Every type, in the order the issue form lists them. */
export const DOC_TYPES: DocType[] = [
  "offer",
  "tnc",
  "consent",
  "joining",
  "certificate",
  "project_certificate",
  "participation",
  "appreciation",
  "custom_certificate",
  "experience",
  "lor",
];

export type DocGroup = "terms" | "certificates" | "letters";

export const DOC_GROUPS: { key: DocGroup; label: string; types: DocType[] }[] = [
  { key: "terms", label: "Offer & terms", types: ["offer", "tnc", "consent"] },
  {
    key: "certificates",
    label: "Certificates",
    types: ["certificate", "project_certificate", "participation", "appreciation", "custom_certificate"],
  },
  { key: "letters", label: "Letters", types: ["joining", "experience", "lor"] },
];

/** Types that must be tied to an enrolment. */
export const ENROLMENT_REQUIRED: DocType[] = ["offer", "tnc", "consent", "joining", "certificate", "experience"];
/** Types that may be tied to an enrolment. */
export const ENROLMENT_OPTIONAL: DocType[] = ["lor"];
/** Types with free text typed by the admin. */
export const BODY_TYPES: DocType[] = ["lor", "custom_certificate"];
/** Types tied to a college project (required) or optionally naming one. */
export const PROJECT_REQUIRED: DocType[] = ["project_certificate"];
export const PROJECT_OPTIONAL: DocType[] = ["experience"];
/** Printed landscape (certificate layout); everything else is a portrait letter. */
export const CERTIFICATE_TYPES: DocType[] = [
  "certificate",
  "project_certificate",
  "participation",
  "appreciation",
  "custom_certificate",
];

export const needsEnrolment = (t: DocType) => ENROLMENT_REQUIRED.includes(t);
export const allowsEnrolment = (t: DocType) => ENROLMENT_REQUIRED.includes(t) || ENROLMENT_OPTIONAL.includes(t);
export const isCertificateLayout = (t: DocType) => CERTIFICATE_TYPES.includes(t);

/** The {placeholders} a template body can use, with what they print. */
export const PLACEHOLDERS: [key: string, meaning: string][] = [
  ["name", "Name on documents"],
  ["programme", "Course and length, or the event"],
  ["batch", "Batch code"],
  ["start_date", "Start date"],
  ["end_date", "End date (the actual completion day for an early certificate)"],
  ["role", "Track"],
  ["result", "Result note"],
  ["project", "Project name"],
  ["event_title", "Event or title (documents without an internship)"],
  ["event_dates", "Event dates"],
  ["body", "Text typed when issuing (LOR, custom certificate)"],
  ["issue_date", "Issue date"],
  ["student_type", "Paid, free or stipend (own documents only)"],
  ["min_attendance", "Minimum attendance %"],
  ["org_name", "Organisation name"],
];

/** Field names a template layout (Settings → Templates) can place, with what they print. */
export const LAYOUT_FIELDS: [key: string, meaning: string][] = [
  ["name", "Name, large"],
  ["body", "Template wording, filled in"],
  ["title", "Template title"],
  ["intro", "“This is to certify that”"],
  ["org", "Organisation name"],
  ["issue_date", "“Issued on …”"],
  ["date", "“Date: …” (letters)"],
  ["number", "“No. …”"],
  ["qr", "QR code to the verify page"],
  ["verify", "Verify address as text"],
  ["signature", "Signature image"],
  ["signatory_name", "Signatory name"],
  ["signatory_title", "Signatory title"],
  ["programme", "Programme"],
  ["batch", "Batch code"],
  ["start_date", "Start date"],
  ["end_date", "End date"],
  ["result", "Result"],
  ["role", "Track"],
  ["project", "Project"],
  ["event_title", "Event or title"],
  ["event_dates", "Event dates"],
];

/** Sample values for Settings → Templates preview. */
export const SAMPLE_VALUES: Record<string, string> = {
  name: "Riya Shah",
  programme: "AI Automation, 30 days",
  batch: "AA30-2612-1",
  start_date: "2026-12-01",
  end_date: "2026-12-30",
  role: "AI Automation",
  result: "Completed with distinction",
  project: "Invoice reader bot",
  event_title: "Hands-on workshop on AI agents",
  event_dates: "on 12 December 2026",
  body: "Riya worked with us for 30 days and showed strong ownership of her tasks.",
  student_type: "stipend",
  min_attendance: "75",
};
