/**
 * Office-PC file names and folders (org_settings.file_patterns, local_files_root) and the academic-year label
 * used in them. Pure functions, safe in server and client code. Nothing is uploaded; the portal only prints paths.
 */
import type { MoneyCategory } from "./types";

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

/** "2627" → "2026-27" (the folder name used on the office PC); other labels unchanged. */
export function yearFolder(label: string | null | undefined): string {
  if (!label) return "";
  const m = /^(\d{2})(\d{2})$/.exec(label);
  return m ? `20${m[1]}-${m[2]}` : label;
}

/** Academic year folder name ("2026-27") for a moment, same rule as public.academic_year_label. */
export function academicYear(at: string | null | undefined, startMonth = 6, override?: string | null): string {
  const o = override?.trim();
  if (o) return yearFolder(o);
  const d = at ? new Date(at) : new Date();
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" })
    .format(Number.isNaN(d.getTime()) ? new Date() : d)
    .split("-")
    .map(Number);
  if (startMonth === 1) return String(y);
  const start = m < startMonth ? y - 1 : y;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** The exact screenshot file name, e.g. FEE_QF-2627-0016_2026-12-09_4999.jpg */
export function proofFileName(
  patterns: FilePatterns | null | undefined,
  e: { category: MoneyCategory; code: string; date?: string | null; month?: string | null; amount?: number | null },
): string {
  const p = patterns?.[e.category] || DEFAULT_PATTERNS[e.category];
  return p
    .replaceAll("{code}", e.code || "CODE")
    .replaceAll("{date}", e.date ? e.date.slice(0, 10) : "YYYY-MM-DD")
    .replaceAll("{month}", e.month ? e.month.slice(0, 7) : "YYYY-MM")
    .replaceAll("{amount}", e.amount ? String(e.amount) : "AMOUNT");
}

/** D:\Quellflow-Records\2026-27\students\QF-2627-0016_Riya-Shah\ (always ends with a backslash). */
export function studentFolder(
  patterns: FilePatterns | null | undefined,
  root: string | null | undefined,
  year: string,
  code: string,
  fullName: string,
): string {
  const r = root ? (/[\\/]$/.test(root) ? root : `${root}\\`) : "";
  const name = fullName.trim().split(/\s+/).join("-");
  const folder = (patterns?.student_folder || DEFAULT_PATTERNS.student_folder)
    .replaceAll("{root}", r)
    .replaceAll("{year}", year)
    .replaceAll("{code}", code)
    .replaceAll("{name}", name);
  return /[\\/]$/.test(folder) ? folder : `${folder}\\`;
}

/** D:\Quellflow-Records\2026-27\students\QF-2627-0016_Riya-Shah\02_payments\ */
export function paymentsFolder(
  patterns: FilePatterns | null | undefined,
  root: string | null | undefined,
  year: string,
  code: string,
  fullName: string,
): string {
  return `${studentFolder(patterns, root, year, code, fullName)}02_payments\\`;
}
