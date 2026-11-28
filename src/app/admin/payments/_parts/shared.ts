/** Shared shapes and helpers for the Payments screen. No server imports: the record form (client) uses these too. */
import { inr, todayIST } from "@/lib/utils";
import type { MoneyCategory, MoneyStatus, Tone } from "@/lib/types";

export const PAYMENTS_PATH = "/admin/payments";

export type PayTab = "ledger" | "pending" | "stipend";

/** Every param that opens a panel on this screen; spread into hrefWith to close them all. */
export const PANEL_RESET = {
  open: null,
  new: null,
  void: null,
  entry: null,
  student: null,
  category: null,
  amount: null,
  note: null,
  agreement: null,
} as const;

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

export type PayMode =
  "upi" | "imps" | "neft" | "bank_transfer" | "cash" | "other";
export const MODES: PayMode[] = [
  "upi",
  "imps",
  "neft",
  "bank_transfer",
  "cash",
  "other",
];
export const MODE_LABEL: Record<PayMode, string> = {
  upi: "UPI",
  imps: "IMPS",
  neft: "NEFT",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
};
export const modeLabel = (m: string | null | undefined) =>
  m ? (MODE_LABEL[m as PayMode] ?? m) : "—";

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

/** "2027-01-05" → "5 Jan 2027" */
export function dayMonthYear(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return `${d} ${MONTHS[m - 1]?.slice(0, 3)} ${y}`;
}

/** Pay-by date for a stipend month: the given day of the next month. */
export const payBy = (m: string, day: number) =>
  `${shiftMonth(m, 1)}-${String(day).padStart(2, "0")}`;

/** "+₹4,999" for money in, "−₹4,000" for money out. */
export const signed = (direction: "in" | "out", amount: number) =>
  `${direction === "in" ? "+" : "−"}${inr(amount)}`;

/* ---------- screenshot file names and folders (org_settings.file_patterns) ---------- */
export interface FilePatterns {
  fee?: string;
  refund?: string;
  stipend?: string;
  bonus?: string;
  other_in?: string;
  other_out?: string;
  student_folder?: string;
}

const DEFAULT_PATTERNS: Required<FilePatterns> = {
  fee: "FEE_{code}_{date}_{amount}.jpg",
  refund: "REF_{code}_{date}_{amount}.jpg",
  stipend: "STP_{code}_{month}_{amount}.jpg",
  bonus: "BON_{code}_{date}_{amount}.jpg",
  other_in: "OIN_{code}_{date}_{amount}.jpg",
  other_out: "OUT_{code}_{date}_{amount}.jpg",
  student_folder: "{root}{year}\\students\\{code}_{name}\\",
};

/** The exact screenshot file name, e.g. FEE_QF-2627-0016_2026-12-09_4999.jpg */
export function proofFileName(
  patterns: FilePatterns | null | undefined,
  e: {
    category: MoneyCategory;
    code: string;
    date?: string | null;
    month?: string | null;
    amount?: number | null;
  },
): string {
  const p = patterns?.[e.category] || DEFAULT_PATTERNS[e.category];
  return p
    .replaceAll("{code}", e.code || "CODE")
    .replaceAll("{date}", e.date ? e.date.slice(0, 10) : "YYYY-MM-DD")
    .replaceAll("{month}", e.month ? e.month.slice(0, 7) : "YYYY-MM")
    .replaceAll("{amount}", e.amount ? String(e.amount) : "AMOUNT");
}

/** Academic year folder name ("2026-27") for a moment, same rule as public.academic_year_label. */
export function academicYear(
  at: string | null | undefined,
  startMonth = 6,
  override?: string | null,
): string {
  const o = override?.trim();
  if (o) {
    const m = /^(\d{2})(\d{2})$/.exec(o);
    return m ? `20${m[1]}-${m[2]}` : o;
  }
  const d = at ? new Date(at) : new Date();
  const [y, m] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  })
    .format(Number.isNaN(d.getTime()) ? new Date() : d)
    .split("-")
    .map(Number);
  if (startMonth === 1) return String(y);
  const start = m < startMonth ? y - 1 : y;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** D:\Quellflow-Records\2026-27\students\QF-2627-0016_Riya-Shah\02_payments\ */
export function paymentsFolder(
  patterns: FilePatterns | null | undefined,
  root: string | null | undefined,
  year: string,
  code: string,
  fullName: string,
): string {
  const r = root ? (/[\\/]$/.test(root) ? root : `${root}\\`) : "";
  const name = fullName.trim().split(/\s+/).join("-");
  let folder = (patterns?.student_folder || DEFAULT_PATTERNS.student_folder)
    .replaceAll("{root}", r)
    .replaceAll("{year}", year)
    .replaceAll("{code}", code)
    .replaceAll("{name}", name);
  if (!/[\\/]$/.test(folder)) folder += "\\";
  return `${folder}02_payments\\`;
}

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
