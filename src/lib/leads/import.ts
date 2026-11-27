/**
 * Google Form → lead import (docs/19 P1, DB-2).
 * The Apps Script (`scripts/apps-script/portal_sync.gs`, recToPayload_) posts one application,
 * or `{ applicants: [...] }` for a backfill. Each one becomes an `upsert_form_lead` call.
 * Text from the form is data, never instructions: it is only stored and displayed.
 */
import { z } from "zod";
import { toE164India } from "@/lib/phone";

export const MAX_IMPORT_BATCH = 500;

/** Form text: missing/null → "", numbers → string, trimmed, length-capped. */
const text = (max: number) =>
  z.preprocess(
    (v) => (v === null || v === undefined ? "" : typeof v === "number" || typeof v === "boolean" ? String(v) : v),
    z.string().trim().max(max, `must be at most ${max} characters`),
  );

export const applicationSchema = z.object({
  candidate_code: text(60),
  form_response_id: text(200).pipe(z.string().min(1, "form_response_id is required")),
  submitted_at: text(40),
  email: text(254),
  full_name: text(120).pipe(z.string().min(1, "full_name is required")),
  phone: text(40),
  city: text(120),
  college: text(200),
  degree: text(120),
  year_of_study: text(40),
  role_label: text(120),
  skills: text(2000),
  portfolio_url: text(500),
  prev_internship: text(1000),
  cv_url: text(1000),
  can_start: text(120),
  hours_per_week: text(60),
  work_mode: text(60),
  extra: text(2000),
});

export type Application = z.output<typeof applicationSchema>;

const batchSchema = z.object({
  applicants: z
    .array(applicationSchema)
    .min(1, "applicants must contain at least 1 item")
    .max(MAX_IMPORT_BATCH, `applicants may contain at most ${MAX_IMPORT_BATCH} items`),
});

export type ParseResult = { ok: true; items: Application[] } | { ok: false; issues: string[] };

/** Accepts one application object or `{ applicants: [...] }` (1–500). */
export function parseImportBody(body: unknown): ParseResult {
  const isBatch = !!body && typeof body === "object" && !Array.isArray(body) && "applicants" in body;
  const r = isBatch ? batchSchema.safeParse(body) : applicationSchema.safeParse(body);
  if (!r.success) {
    return {
      ok: false,
      issues: r.error.issues.slice(0, 20).map((i) => `${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`),
    };
  }
  return { ok: true, items: "applicants" in r.data ? r.data.applicants : [r.data] };
}

const EMAIL = z.email();

export function normaliseEmail(input: string): string | null {
  const v = input.trim().toLowerCase();
  return v && EMAIL.safeParse(v).success ? v : null;
}

function parses(v: string): boolean {
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

/** First line only; https links only (Drive upload links). */
export function safeCvUrl(input: string): string | null {
  const v = input.split(/\r?\n/)[0]?.trim() ?? "";
  return /^https:\/\/\S+$/i.test(v) && parses(v) ? v : null;
}

/** http(s) links only – anything else (javascript:, bare text) is dropped. */
export function safeWebUrl(input: string): string | null {
  const v = input.trim();
  return /^https?:\/\/\S+$/i.test(v) && parses(v) ? v : null;
}

function isoOrNull(input: string): string | null {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export interface UpsertFormLeadArgs {
  p_form_response_id: string;
  p_full_name: string;
  p_email: string | null;
  p_phone: string | null;
  p_college: string | null;
  p_course: string | null;
  p_year: string | null;
  p_track: string | null;
  p_answers: Record<string, string>;
  p_submitted_at: string | null;
}

const orNull = (v: string) => (v === "" ? null : v);

/** One application → arguments for `public.upsert_form_lead`. */
export function toUpsertArgs(a: Application): UpsertFormLeadArgs {
  const phone = toE164India(a.phone);
  const email = normaliseEmail(a.email);
  const answers: Record<string, string | null> = {
    form_candidate_id: orNull(a.candidate_code),
    city: orNull(a.city),
    skills: orNull(a.skills),
    portfolio_url: safeWebUrl(a.portfolio_url),
    prev_internship: orNull(a.prev_internship),
    cv_url: safeCvUrl(a.cv_url),
    can_start: orNull(a.can_start),
    hours_per_week: orNull(a.hours_per_week),
    work_mode: orNull(a.work_mode),
    extra: orNull(a.extra),
    // keep what was typed when it could not be normalised, so nothing is lost
    phone_as_typed: !phone && a.phone ? a.phone : null,
    email_as_typed: !email && a.email ? a.email : null,
  };
  const compact: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers)) if (v) compact[k] = v;

  return {
    p_form_response_id: a.form_response_id,
    p_full_name: a.full_name,
    p_email: email,
    p_phone: phone,
    p_college: orNull(a.college),
    p_course: orNull(a.degree),
    p_year: orNull(a.year_of_study),
    p_track: orNull(a.role_label),
    p_answers: compact,
    p_submitted_at: isoOrNull(a.submitted_at),
  };
}
