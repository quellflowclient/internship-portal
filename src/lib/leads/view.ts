/** Display helpers for the Leads screen (pure functions, safe in server and client code). */
import { STAGE } from "@/lib/labels";
import type { LeadStage } from "@/lib/types";

export const OPEN_STAGES: LeadStage[] = ["new", "contacted", "interested", "counselling"];

/** Follow-up is due when the date is today or earlier and the lead is still open. */
export function isDue(nextFollowUp: string | null | undefined, stage: LeadStage, today: string): boolean {
  return !!nextFollowUp && OPEN_STAGES.includes(stage) && nextFollowUp <= today;
}

/** YYYY-MM-DD of an instant in IST. */
function istDate(value: string): string | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
}

/** "today", "yesterday", "5 days ago" (calendar days in IST). */
export function daysAgoText(value: string | null | undefined, today: string): string {
  if (!value) return "";
  const day = istDate(value);
  if (!day) return "";
  const diff = Math.round((Date.parse(today + "T00:00:00Z") - Date.parse(day + "T00:00:00Z")) / 86_400_000);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  return `${diff} days ago`;
}

const ANSWER_LABEL: Record<string, string> = {
  form_candidate_id: "Form ID",
  city: "City",
  skills: "Skills",
  portfolio_url: "Portfolio",
  prev_internship: "Previous internship",
  cv_url: "CV",
  can_start: "Can start",
  hours_per_week: "Hours per week",
  work_mode: "Work mode",
  extra: "Anything else",
  phone_as_typed: "Mobile as typed",
  email_as_typed: "Email as typed",
};

export function answerLabel(key: string): string {
  if (ANSWER_LABEL[key]) return ANSWER_LABEL[key];
  const t = key.replace(/[_-]+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : key;
}

/** Form answers as [label, text, isLink] rows, skipping empty values. Links only when http(s). */
export function answerRows(answers: Record<string, unknown> | null | undefined): { key: string; label: string; text: string; href?: string }[] {
  if (!answers || typeof answers !== "object") return [];
  const rows: { key: string; label: string; text: string; href?: string }[] = [];
  for (const [key, raw] of Object.entries(answers)) {
    let text: string;
    if (raw === null || raw === undefined) continue;
    if (Array.isArray(raw)) text = raw.filter((x) => x !== null && x !== "").map(String).join(", ");
    else if (typeof raw === "object") text = JSON.stringify(raw);
    else text = String(raw);
    text = text.trim();
    if (!text) continue;
    if (text.length > 600) text = text.slice(0, 600) + "…";
    const href = /^https?:\/\/\S+$/i.test(text) ? text : undefined;
    rows.push({ key, label: answerLabel(key), text, href });
  }
  return rows;
}

/** "Stage changed from new to contacted" → "Stage changed from New to Contacted". */
export function prettySummary(summary: string): string {
  if (!summary.startsWith("Stage changed from ")) return summary;
  return summary.replace(/\b(new|contacted|interested|counselling|converted|lost)\b/g, (st) => STAGE[st as LeadStage].label);
}

/** Characters that would break a PostgREST or() filter are dropped; the rest is matched with ilike. */
export function searchTerm(q: string | undefined): { text: string; digits: string } | null {
  const text = (q ?? "").replace(/["\\%*,()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  return { text, digits: digits.length >= 3 ? digits : "" };
}
