/** Shared shapes and small helpers for the Batches screens (rows from the untyped Supabase client). */
import type { StudentType } from "@/lib/types";

export const BATCHES_PATH = "/admin/batches";

export interface CoursePlanRow {
  id: string;
  duration_days: number;
  fee_inr: number;
  course: { code: string; name: string; active: boolean } | null;
}

/** "AI Automation, 30 days" */
export const planLabel = (p: { duration_days: number; course: { name: string } | null }) =>
  `${p.course?.name ?? "Course"}, ${p.duration_days} days`;

/** The Monday after today (IST), as YYYY-MM-DD. */
export function nextMonday(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday
  const add = ((8 - dow) % 7) || 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}

export type TypeMix = Record<StudentType, number>;
export const emptyMix = (): TypeMix => ({ paid: 0, free: 0, stipend: 0 });

/** "1 day" / "3 days" */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
