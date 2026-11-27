/** Row shapes read by Student 360 (untyped Supabase client → cast here). */
import type { ActivityKind, DocType, EnrollmentStatus, MoneyCategory, MoneyStatus, Student, StudentType } from "@/lib/types";
import type { PlanRef } from "../../_parts/shared";

export type StudentRow = Student;

export interface EnrolmentRow {
  id: string;
  batch_id: string;
  type: StudentType;
  status: EnrollmentStatus;
  assigned_on: string;
  start_date: string;
  end_date: string;
  fee_inr: number | null;
  free_reason: string | null;
  exit_reason: string | null;
  capacity_override_reason: string | null;
  created_by: string | null;
  batch: { id: string; code: string; course_plan: PlanRef | null } | null;
}

export interface AgreementRow {
  id: string;
  enrollment_id: string;
  monthly_inr: number;
  from_month: string;
  to_month: string | null;
  agreed_note: string | null;
}

export interface ChangeRow {
  id: number;
  change: "type" | "fee" | "batch" | "dates" | "status";
  from_value: string | null;
  to_value: string | null;
  reason: string | null;
  changed_at: string;
}

export interface MoneyRow {
  id: string;
  category: MoneyCategory;
  direction: "in" | "out";
  amount_inr: number;
  status: MoneyStatus;
  paid_on: string | null;
  due_on: string | null;
  mode: string | null;
}

export interface DocRow {
  id: string;
  type: DocType;
  number: string | null;
  display_status: string;
}

export interface ActivityRow {
  id: string;
  kind: ActivityKind;
  summary: string;
  outcome: string | null;
  occurred_at: string;
}

export interface BatchOption {
  id: string;
  code: string;
  capacity: number;
  status: "planned" | "running";
  start_date: string;
  course_plan_id: string;
  course_plan: PlanRef | null;
}

export const OPEN_STATUSES: EnrollmentStatus[] = ["assigned", "active"];

export const MODE_LABEL: Record<string, string> = {
  upi: "UPI",
  imps: "IMPS",
  neft: "NEFT",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
};
