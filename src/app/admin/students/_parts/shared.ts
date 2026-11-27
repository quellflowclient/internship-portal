/** Shared shapes and small helpers for the Students screens (rows from the untyped Supabase client). */
import type { StudentType } from "@/lib/types";

export const STUDENTS_PATH = "/admin/students";
export const studentHref = (code: string) => `${STUDENTS_PATH}/${encodeURIComponent(code)}`;

export interface PlanRef {
  id?: string;
  duration_days: number;
  fee_inr: number;
  course: { code: string; name: string } | null;
}

/** "AI Automation, 30 days" */
export function planLabel(p: PlanRef | null | undefined): string {
  if (!p) return "—";
  return `${p.course?.name ?? "Course"}, ${p.duration_days} days`;
}

export const TYPE_OPTIONS: { value: StudentType; label: string }[] = [
  { value: "paid", label: "Paid" },
  { value: "free", label: "Free" },
  { value: "stipend", label: "Stipend" },
];

export interface FeeBalance {
  agreed: number;
  paid: number;
  refunded: number;
  pending: number;
}

/** Quick-view "Fees" text: Paid, ₹X pending, or Not needed. */
export function feeText(type: StudentType | null, hasEnrolment: boolean, fb: FeeBalance | null, inrFmt: (n: number) => string) {
  if (type !== "paid") return "Not needed";
  if (!hasEnrolment || !fb || fb.agreed === 0) return "Agreed when assigned";
  return fb.pending > 0 ? `${inrFmt(fb.pending)} pending` : "Paid";
}

/** Strips characters that would break a PostgREST `or=(…)` filter. */
export function safeSearch(q: string | undefined): string {
  return (q ?? "").replace(/[,()*%\\:"']/g, " ").trim().slice(0, 60);
}

/** "2627" → "2026-27" (the folder name used on the office PC); other labels unchanged. */
export function yearFolder(label: string | null | undefined): string {
  if (!label) return "";
  const m = /^(\d{2})(\d{2})$/.exec(label);
  return m ? `20${m[1]}-${m[2]}` : label;
}
