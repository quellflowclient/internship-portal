import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const optionalMoney = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .pipe(z.number().nonnegative().max(10_000_000).nullable())
  .optional();

export const uuid = z.uuid();

export const applicantUpdateSchema = z.object({
  id: uuid,
  status: z.enum(["new", "shortlisted", "on_hold", "not_now", "converted"]),
  notes: optionalText,
});

export const invitationSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: z.enum(["admin", "mentor", "student", "super_admin"]),
  applicant_id: uuid.optional(),
});

export const setRoleSchema = z.object({
  profile_id: uuid,
  role: z.enum(["super_admin", "admin", "mentor", "student"]),
  is_active: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export const programSchema = z.object({
  name: z.string().trim().min(3).max(120),
  track: z.enum(["merit", "paid", "self_paced"]),
  role_code: z.string().regex(/^[A-Z0-9]{2}$/),
  duration: z.enum(["d45", "d90", "m6"]),
  default_fee_inr: optionalMoney,
});

export const batchSchema = z
  .object({
    program_id: uuid,
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,20}$/, "Use letters, numbers and dashes (e.g. AA-2701)"),
    name: z.string().trim().min(3).max(120),
    start_date: z.iso.date(),
    end_date: z.iso.date(),
    capacity: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .pipe(z.number().int().positive().max(1000).nullable())
      .optional(),
    live_slot: optionalText,
  })
  .refine((b) => b.end_date >= b.start_date, { message: "End date must be after start date", path: ["end_date"] });

export const batchMentorSchema = z.object({
  batch_id: uuid,
  mentor_id: uuid,
  is_backup: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

/** Convert an applicant into an enrolment with admin-only money terms (D-04). */
export const convertSchema = z
  .object({
    applicant_id: uuid,
    batch_id: uuid,
    mentor_id: uuid,
    weekly_hours: z.coerce.number().int().min(1).max(60).default(20),
    engagement_type: z.enum(["free", "paid", "stipend"]),
    stipend_amount_inr: optionalMoney,
    stipend_frequency: z
      .enum(["monthly", "one_time", ""])
      .optional()
      .transform((v) => (v ? v : null)),
    fee_amount_inr: optionalMoney,
  })
  .superRefine((v, ctx) => {
    if (v.engagement_type === "stipend" && (v.stipend_amount_inr == null || !v.stipend_frequency)) {
      ctx.addIssue({ code: "custom", message: "Stipend needs an amount and frequency", path: ["stipend_amount_inr"] });
    }
    if (v.engagement_type !== "stipend" && v.stipend_amount_inr != null) {
      ctx.addIssue({ code: "custom", message: "Stipend amount only applies to the stipend type", path: ["stipend_amount_inr"] });
    }
    if (v.engagement_type === "paid" && v.fee_amount_inr == null) {
      ctx.addIssue({ code: "custom", message: "Paid enrolment needs a fee amount", path: ["fee_amount_inr"] });
    }
  });

export const orgSettingsSchema = z.object({
  org_name: z.string().trim().min(2).max(200),
  brand_name: z.string().trim().min(2).max(60),
  address: optionalText,
  llpin: optionalText,
  website: optionalText,
  contact_email: optionalText,
  sender_name: optionalText,
  sender_email: optionalText,
  verify_base_url: optionalText,
  academic_year_start_month: z.coerce.number().int().min(1).max(12),
  academic_year_label_override: optionalText,
});

export const numberingSchema = z.object({
  id: uuid,
  pattern: z
    .string()
    .trim()
    .min(5)
    .max(60)
    .regex(/\{SEQ(:\d+)?\}/, "Pattern must contain {SEQ} or {SEQ:n}")
    .refine((p) => !/\{(?!AY\}|YYYY\}|ROLE\}|TRACK\}|SEQ(:\d+)?\})[^}]*\}/.test(p), "Unknown token – use {AY} {YYYY} {ROLE} {TRACK} {SEQ:n}"),
  reset_per_academic_year: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export const signatorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  title: z.string().trim().min(2).max(120),
});

/** FormData -> plain object (last value wins; empty strings kept for optional handling). */
export function formToObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

export function firstError(err: z.ZodError): string {
  const i = err.issues[0];
  return i ? `${i.path.join(".") || "input"}: ${i.message}` : "Invalid input";
}
