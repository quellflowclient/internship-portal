import "server-only";
/**
 * Student app data (docs/19 §10 "Student app"). Everything is read as the signed-in student:
 * v_my_enrollments (own enrolments, no fees) and get_my_plan(enrollment) (published plan + own attendance).
 */
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceMark, EnrollmentStatus, PlanKind, PlanResource } from "@/lib/types";

export type MyEnrollment = {
  enrollment_id: string;
  status: EnrollmentStatus;
  start_date: string;
  end_date: string;
  batch_id: string;
  batch_code: string;
  session_time: string | null;
  whatsapp_url: string | null;
  classroom_url: string | null;
  meet_url: string | null;
  playlist_url: string | null;
  drive_url: string | null;
  github_url: string | null;
  course_name: string;
  duration_days: number;
  published_version: number | null;
  attendance_pct: number | null;
  tasks_pct: number | null;
};

export type MyPlanItem = {
  seq: number;
  week: number;
  date: string;
  kind: PlanKind;
  title: string;
  description: string | null;
  resources: PlanResource[] | null;
  done: boolean;
  skipped: boolean;
  attendance: AttendanceMark | null;
};

export type MyPlan = {
  batch: string;
  course: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  session_time: string | null;
  version: number | null;
  published_at: string | null;
  change_note: string | null;
  items: MyPlanItem[];
};

/** Explicit columns: never `type` (paid/free/stipend) or anything about money. */
const ENROLLMENT_COLUMNS =
  "enrollment_id, status, start_date, end_date, batch_id, batch_code, session_time, whatsapp_url, classroom_url, meet_url, playlist_url, drive_url, github_url, course_name, duration_days, published_version, attendance_pct, tasks_pct";

export const getMyEnrollments = cache(async (): Promise<MyEnrollment[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("v_my_enrollments").select(ENROLLMENT_COLUMNS).order("start_date", { ascending: false });
  return (data ?? []) as MyEnrollment[];
});

export const getMyPlan = cache(async (enrollmentId: string): Promise<MyPlan | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_plan", { p_enrollment: enrollmentId });
  if (error || !data) return null;
  return data as MyPlan;
});

/** The item to show as "Today" / "Next": the first item from today on that is not skipped or done. */
export function nextItem(items: MyPlanItem[], today: string): MyPlanItem | null {
  return items.find((i) => i.date >= today && !i.skipped && !i.done) ?? null;
}
