import { z } from "zod";
import { toE164India } from "@/lib/phone";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullish();

/** One application as sent by the Google Apps Script (scripts/apps-script/portal_sync.gs). */
export const applicantPayloadSchema = z.object({
  candidate_code: z.string().trim().regex(/^[A-Z0-9-]{4,30}$/, "invalid candidate_code"),
  // Google's response id – never reused, so it is the idempotency key (candidate codes restart after a form reset).
  form_response_id: z.string().trim().min(5).max(200),
  submitted_at: z.iso.datetime({ offset: true }).nullish(),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  full_name: z.string().trim().min(1).max(120),
  phone: text(40),
  city: text(120),
  college: text(200),
  degree: text(200),
  year_of_study: text(60),
  role_label: text(200),
  skills: text(4000),
  portfolio_url: text(500),
  prev_internship: text(20),
  cv_url: text(2000),
  can_start: text(60),
  hours_per_week: text(60),
  work_mode: text(60),
  extra: text(4000),
});

export const importBodySchema = z.union([
  applicantPayloadSchema.transform((a) => [a]),
  z.object({ applicants: z.array(applicantPayloadSchema).min(1).max(500) }).transform((b) => b.applicants),
]);

export type ApplicantPayload = z.infer<typeof applicantPayloadSchema>;

/**
 * Form role text -> roles_catalog code (exact match on form_label).
 * "Other: Blockchain Developer" or unknown text -> null (kept in role_label).
 */
export function resolveRoleCode(roleLabel: string | null | undefined, labelToCode: Map<string, string>): string | null {
  if (!roleLabel) return null;
  return labelToCode.get(roleLabel.trim().toLowerCase()) ?? null;
}

/** Maps a payload to an `applicants` row. Status/notes are intentionally absent so re-imports never reset a review. */
export function toApplicantRow(p: ApplicantPayload, labelToCode: Map<string, string>) {
  const phone = toE164India(p.phone ?? null);
  const cv = p.cv_url && /^https:\/\//.test(p.cv_url) ? p.cv_url : null;
  const portfolio = p.portfolio_url && /^https?:\/\//i.test(p.portfolio_url) ? p.portfolio_url : null;
  return {
    candidate_code: p.candidate_code,
    form_response_id: p.form_response_id,
    submitted_at: p.submitted_at ?? null,
    email: p.email,
    full_name: p.full_name,
    phone_e164: phone,
    city: p.city ?? null,
    college: p.college ?? null,
    degree: p.degree ?? null,
    year_of_study: p.year_of_study ?? null,
    role_label: p.role_label ?? null,
    role_code: resolveRoleCode(p.role_label, labelToCode),
    skills: p.skills ?? null,
    portfolio_url: portfolio,
    prev_internship: p.prev_internship ?? null,
    cv_url: cv,
    can_start: p.can_start ?? null,
    hours_per_week: p.hours_per_week ?? null,
    work_mode: p.work_mode ?? null,
    extra: p.extra ?? null,
    raw: p,
  };
}
