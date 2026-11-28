/** Shared shapes and helpers for the Payments screen. No server imports: the record form (client) uses these too. */
import { formatDate, inr, todayIST } from "@/lib/utils";
import type { FilePatterns } from "@/lib/files";
import type { MoneyCategory, MoneyStatus, Tone } from "@/lib/types";

export const PAYMENTS_PATH = "/admin/payments";

export type PayTab = "ledger" | "pending" | "stipend";

export const CATEGORIES: MoneyCategory[] = [
  "fee",
  "refund",
  "stipend",
  "bonus",
  "other_in",
  "other_out",
];
export const DIRECTION: Record<MoneyCategory, "in" | "out"> = {
  fee: "in",
  other_in: "in",
  refund: "out",
  stipend: "out",
  bonus: "out",
  other_out: "out",
};
export const CATEGORY_TONE: Record<MoneyCategory, Tone> = {
  fee: "ok",
  refund: "bad",
  stipend: "vio",
  bonus: "info",
  other_in: "mute",
  other_out: "mute",
};

export const isUuid = (v: string | undefined | null): v is string =>
  !!v &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/* ---------- months (YYYY-MM) ---------- */
export const isMonth = (v: string | undefined | null): v is string =>
  !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
export const currentMonth = () => todayIST().slice(0, 7);
export const monthStart = (m: string) => `${m}-01`;

export function shiftMonth(m: string, n: number): string {
  const [y, mo] = m.split("-").map(Number);
  const t = y * 12 + (mo - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
/** "2026-12" → "Dec 2026" (or "December 2026" when long). */
export function monthLabel(m: string, long = false): string {
  const [y, mo] = m.split("-").map(Number);
  const name = MONTHS[mo - 1] ?? "";
  return `${long ? name : name.slice(0, 3)} ${y}`;
}

/** "2027-01-05" → "05 Jan 2027", the same format as formatDate everywhere else. */
export function dayMonthYear(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "—";
  return formatDate(`${iso.slice(0, 10)}T00:00:00+05:30`);
}

/** Pay-by date for a stipend month: the given day of the next month. */
export const payBy = (m: string, day: number) =>
  `${shiftMonth(m, 1)}-${String(day).padStart(2, "0")}`;

/** "+₹4,999" for money in, "−₹4,000" for money out. */
export const signed = (direction: "in" | "out", amount: number) =>
  `${direction === "in" ? "+" : "−"}${inr(amount)}`;

/* ---------- row shapes (untyped Supabase client) ---------- */
export interface SettingsRow {
  local_files_root: string | null;
  file_patterns: FilePatterns | null;
  stipend_pay_by_day: number | null;
  academic_year_start_month: number | null;
  academic_year_label_override: string | null;
}
export const SETTINGS_FIELDS =
  "local_files_root, file_patterns, stipend_pay_by_day, academic_year_start_month, academic_year_label_override";

export interface EntryRow {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  category: MoneyCategory;
  direction: "in" | "out";
  amount_inr: number;
  status: MoneyStatus;
  period_month: string | null;
  due_on: string | null;
  paid_on: string | null;
  mode: string | null;
  ref_last4: string | null;
  note: string | null;
  related_entry_id: string | null;
  proof_saved: boolean;
  void_reason: string | null;
  voided_at: string | null;
  created_at: string;
  created_by: string | null;
}

/** One record-form choice per student (enrolments and received fees ride along). */
export interface StudentOption {
  id: string;
  code: string;
  full_name: string;
  year: string;
  enrolments: {
    id: string;
    type: string;
    status: string;
    label: string;
    open: boolean;
  }[];
  fees: { id: string; label: string; enrollment_id: string | null }[];
}
