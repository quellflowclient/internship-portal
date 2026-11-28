import { TriangleAlert } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { SubmitButton } from "@/components/toast";
import { ButtonLink, Notice } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { formatDate, inr, todayIST } from "@/lib/utils";
import { ENROLLMENT_STATUS } from "@/lib/labels";
import type { EnrollmentStatus, MoneyCategory } from "@/lib/types";
import { RecordForm, type RecordInitial } from "./record-form";
import {
  academicYear,
  CATEGORIES,
  isMonth,
  isUuid,
  SETTINGS_FIELDS,
  type EntryRow,
  type SettingsRow,
  type StudentOption,
} from "./shared";

interface StudentRow {
  id: string;
  code: string;
  full_name: string;
  created_at: string;
  enrollments: {
    id: string;
    type: string;
    status: EnrollmentStatus;
    start_date: string;
    batch: { code: string } | null;
  }[];
}
interface FeeRow {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  amount_inr: number;
  paid_on: string | null;
  note: string | null;
}

const OPEN: EnrollmentStatus[] = ["assigned", "active"];
const STUDENT_FIELDS =
  "id, code, full_name, created_at, enrollments(id, type, status, start_date, batch:batches(code))";

/**
 * Payments → ?new=1. Record a new entry (prefill: student, category, amount, note, month),
 * pay an expected stipend row (&entry=<expected id>), or edit a done entry (&entry=<done id>).
 */
export async function RecordPanel({
  entryId,
  prefill,
  month,
  closeHref,
}: {
  entryId?: string;
  prefill: {
    student?: string;
    category?: string;
    amount?: string;
    note?: string;
  };
  month: string;
  closeHref: string;
}) {
  const supabase = await createClient();
  const today = todayIST();

  const entryRes = isUuid(entryId)
    ? await supabase
        .from("money_entries")
        .select(
          "id, student_id, enrollment_id, category, amount_inr, status, period_month, paid_on, mode, ref_last4, note, related_entry_id, proof_saved",
        )
        .eq("id", entryId)
        .maybeSingle()
    : { data: null };
  const entry = entryRes.data as EntryRow | null;
  const usable = entry && entry.status !== "void" ? entry : null;
  const editing = usable?.status === "done" ? usable : null;
  const paying = usable?.status === "expected" ? usable : null;

  const [studentsRes, extraRes, feesRes, settingsRes] = await Promise.all([
    supabase
      .from("students")
      .select(STUDENT_FIELDS)
      .in("state", ["active", "alumni"])
      .order("full_name"),
    usable
      ? supabase
          .from("students")
          .select(STUDENT_FIELDS)
          .eq("id", usable.student_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("money_entries")
      .select("id, student_id, enrollment_id, amount_inr, paid_on, note")
      .eq("category", "fee")
      .eq("status", "done")
      .order("paid_on", { ascending: false }),
    supabase
      .from("org_settings")
      .select(SETTINGS_FIELDS)
      .eq("id", 1)
      .maybeSingle(),
  ]);
  const settings = settingsRes.data as SettingsRow | null;
  const rows = (studentsRes.data ?? []) as unknown as StudentRow[];
  const extra = extraRes.data as unknown as StudentRow | null;
  if (extra && !rows.some((s) => s.id === extra.id)) rows.unshift(extra);
  const fees = (feesRes.data ?? []) as FeeRow[];

  const students: StudentOption[] = rows.map((s) => ({
    id: s.id,
    code: s.code,
    full_name: s.full_name,
    year: academicYear(
      s.created_at,
      settings?.academic_year_start_month ?? 6,
      settings?.academic_year_label_override,
    ),
    enrolments: [...(s.enrollments ?? [])]
      .sort((a, b) => b.start_date.localeCompare(a.start_date))
      .map((e) => ({
        id: e.id,
        type: e.type,
        status: e.status,
        open: OPEN.includes(e.status),
        label: `${e.batch?.code ?? "Batch"}, ${ENROLLMENT_STATUS[e.status]?.label ?? e.status}`,
      })),
    fees: fees
      .filter((f) => f.student_id === s.id)
      .map((f) => ({
        id: f.id,
        enrollment_id: f.enrollment_id,
        label: `${inr(f.amount_inr)} on ${formatDate(f.paid_on)}${f.note ? `, ${f.note}` : ""}`,
      })),
  }));

  const category = (CATEGORIES as string[]).includes(prefill.category ?? "")
    ? (prefill.category as MoneyCategory)
    : "fee";
  const amount =
    prefill.amount && /^\d+$/.test(prefill.amount) ? prefill.amount : "";
  const base = usable ?? null;
  const initial: RecordInitial = base
    ? {
        category: base.category,
        student_id: base.student_id,
        enrollment_id: base.enrollment_id ?? "",
        amount: String(base.amount_inr),
        paid_on: base.paid_on ?? today,
        mode: base.mode ?? "upi",
        ref_last4: base.ref_last4 ?? "",
        note: base.note ?? "",
        related_entry_id: base.related_entry_id ?? "",
        period_month: base.period_month?.slice(0, 7) ?? "",
        proof_saved: base.proof_saved,
      }
    : {
        category,
        student_id:
          isUuid(prefill.student) &&
          students.some((s) => s.id === prefill.student)
            ? prefill.student
            : "",
        enrollment_id: "",
        amount,
        paid_on: today,
        mode: "upi",
        ref_last4: "",
        note: prefill.note?.slice(0, 300) ?? "",
        related_entry_id: "",
        period_month: isMonth(month) ? month : today.slice(0, 7),
        proof_saved: false,
      };

  let locked: { studentLabel: string; enrolmentLabel: string } | undefined;
  if (paying) {
    const s = students.find((x) => x.id === paying.student_id);
    const e = s?.enrolments.find((x) => x.id === paying.enrollment_id);
    locked = {
      studentLabel: s ? `${s.full_name}, ${s.code}` : "—",
      enrolmentLabel: e?.label ?? "—",
    };
  }

  const formId = "f-pay";
  return (
    <Drawer
      closeHref={closeHref}
      title={
        editing ? "Edit entry" : paying ? "Record stipend" : "Record entry"
      }
      sub="Saved to the ledger. The screenshot stays on the office PC."
      footer={
        <>
          <ButtonLink variant="ghost" href={closeHref} scroll={false}>
            Cancel
          </ButtonLink>
          <span className="flex-1 max-md:hidden" />
          <SubmitButton form={formId}>
            {editing ? "Save changes" : "Save entry"}
          </SubmitButton>
        </>
      }
    >
      {entry && entry.status === "void" ? (
        <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
          That entry is voided. Restore it from its panel to edit it. This form
          records a new entry.
        </Notice>
      ) : null}
      <RecordForm
        formId={formId}
        editId={editing?.id}
        locked={locked}
        initial={initial}
        students={students}
        patterns={settings?.file_patterns ?? null}
        root={settings?.local_files_root ?? null}
        today={today}
        closeHref={closeHref}
      />
    </Drawer>
  );
}
