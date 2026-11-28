/** Row shapes and small helpers for the Live track tab (untyped Supabase client → cast here). */
import { formatDay } from "@/lib/utils";
import type { PlanItemStatusRow, PlanKind, Tone, TrackEntry, WorkMark } from "@/lib/types";

export type EntryRow = Pick<TrackEntry, "id" | "plan_item_id" | "held_on" | "kind" | "title">;
export type ItemStatus = Pick<PlanItemStatusRow, "id" | "planned_date" | "kind" | "title" | "status" | "delay_days" | "delivered_on">;

export interface RosterEnrolment {
  id: string;
  status: string;
  student: { full_name: string; code: string } | null;
}

/** What the client form needs per plan item and per student. */
export interface ItemOption {
  id: string;
  label: string;
  kind: PlanKind;
  title: string;
}
export interface StudentLine {
  enrollment_id: string;
  name: string;
  code: string;
  present: boolean;
  mark: WorkMark;
  score: string;
}
export interface SessionInitial {
  plan_item_id: string;
  held_on: string;
  kind: PlanKind;
  title: string;
  link: string;
  note: string;
  max_score: string;
}

/** "Thu 10 Dec: Error handling and retries" */
export const itemLabel = (i: Pick<ItemStatus, "planned_date" | "title">) => `${formatDay(i.planned_date).replace(",", "")}: ${i.title}`;

const dayMs = 86_400_000;
const calendarDays = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / dayMs);

/** Plan link pill for a track entry. */
export function planLink(e: EntryRow, item: ItemStatus | undefined): { label: string; tone: Tone } {
  if (!e.plan_item_id) return { label: "Unplanned", tone: "vio" };
  if (!item || e.held_on <= item.planned_date) return { label: "From plan", tone: "ok" };
  const n = item.delivered_on === e.held_on && item.delay_days != null ? item.delay_days : calendarDays(item.planned_date, e.held_on);
  if (n <= 0) return { label: "From plan", tone: "ok" };
  return { label: `From plan, ${n} ${n === 1 ? "day" : "days"} late`, tone: "warn" };
}
