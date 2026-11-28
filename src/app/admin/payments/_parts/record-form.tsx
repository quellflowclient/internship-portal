"use client";

/** Record / edit form (client: the fields follow the chosen entry kind and student). Posted to recordEntry / updateEntry. */
import * as React from "react";
import { ActionForm, CopyButton, FieldError } from "@/components/toast";
import {
  Checkbox,
  DL,
  Field,
  FormGrid,
  Input,
  Pill,
  RadioSegment,
  Select,
} from "@/components/ui";
import { MODE_LABEL, MONEY_CATEGORY_LABEL, PAY_MODES } from "@/lib/labels";
import { paymentsFolder, proofFileName, type FilePatterns } from "@/lib/files";
import { cn } from "@/lib/utils";
import type { MoneyCategory } from "@/lib/types";
import {
  recordEntry,
  undoRecord,
  updateEntry,
} from "@/server/actions/payments";
import {
  CATEGORIES,
  CATEGORY_TONE,
  monthLabel,
  type StudentOption,
} from "./shared";

export interface RecordInitial {
  category: MoneyCategory;
  student_id: string;
  enrollment_id: string;
  amount: string;
  paid_on: string;
  mode: string;
  ref_last4: string;
  note: string;
  related_entry_id: string;
  period_month: string; // YYYY-MM
  proof_saved: boolean;
}

const ENROL_FOR: Partial<Record<MoneyCategory, (type: string) => boolean>> = {
  fee: (t) => t === "paid",
  stipend: (t) => t === "stipend",
  bonus: () => true,
};

export function RecordForm({
  formId,
  editId,
  locked,
  initial,
  students,
  patterns,
  root,
  today,
  closeHref,
}: {
  formId: string;
  /** Edit mode: the entry being edited. */
  editId?: string;
  /** Paying an expected stipend row: kind, student, enrolment and month are fixed. */
  locked?: { studentLabel: string; enrolmentLabel: string };
  initial: RecordInitial;
  students: StudentOption[];
  patterns: FilePatterns | null;
  root: string | null;
  today: string;
  closeHref: string;
}) {
  const [category, setCategory] = React.useState<MoneyCategory>(
    initial.category,
  );
  const [studentId, setStudentId] = React.useState(initial.student_id);
  const [amount, setAmount] = React.useState(initial.amount);
  const [date, setDate] = React.useState(initial.paid_on);
  const [month, setMonth] = React.useState(initial.period_month);

  const student = students.find((s) => s.id === studentId);
  const enrolFilter = ENROL_FOR[category];
  const enrolOptions = enrolFilter
    ? (student?.enrolments ?? []).filter((e) => enrolFilter(e.type))
    : [];
  const enrolDefault =
    (initial.enrollment_id &&
      enrolOptions.some((e) => e.id === initial.enrollment_id) &&
      initial.enrollment_id) ||
    enrolOptions.find((e) => e.open)?.id ||
    (category === "bonus" ? "" : (enrolOptions[0]?.id ?? ""));
  const fees = student?.fees ?? [];

  const n = Number(amount.replace(/[₹,\s]/g, ""));
  const fileName = proofFileName(patterns, {
    category,
    code: student?.code ?? "",
    date,
    month,
    amount: Number.isInteger(n) && n > 0 ? n : null,
  });
  const folder = student
    ? paymentsFolder(
        patterns,
        root,
        student.year,
        student.code,
        student.full_name,
      )
    : null;
  const fixedKind = !!editId || !!locked;

  return (
    <ActionForm
      action={editId ? updateEntry : recordEntry}
      undo={editId ? undefined : undoRecord}
      closeHref={closeHref}
      id={formId}
    >
      {editId ? <input type="hidden" name="id" value={editId} /> : null}
      {fixedKind ? (
        <input type="hidden" name="category" value={category} />
      ) : null}
      {locked ? (
        <>
          <input type="hidden" name="student_id" value={initial.student_id} />
          <input
            type="hidden"
            name="enrollment_id"
            value={initial.enrollment_id}
          />
          <input
            type="hidden"
            name="period_month"
            value={initial.period_month}
          />
          <div className="mb-3.5">
            <DL
              items={[
                [
                  "Entry",
                  <Pill key="p" tone={CATEGORY_TONE.stipend}>
                    Stipend
                  </Pill>,
                ],
                ["Student", locked.studentLabel],
                ["Batch", locked.enrolmentLabel],
                [
                  "Month",
                  initial.period_month
                    ? monthLabel(initial.period_month, true)
                    : "—",
                ],
              ]}
            />
          </div>
        </>
      ) : null}

      <FormGrid>
        {!fixedKind ? (
          <RadioSegment
            name="category"
            label="Entry"
            options={CATEGORIES.map((c) => ({ value: c, label: MONEY_CATEGORY_LABEL[c] }))}
            value={category}
            onChange={(c) => setCategory(c as MoneyCategory)}
            className="md:col-span-2"
          >
            <FieldError name="category" />
          </RadioSegment>
        ) : editId ? (
          <div className="flex items-center gap-2 text-sm md:col-span-2">
            <span className="text-xs font-semibold text-fg-2">Entry</span>
            <Pill tone={CATEGORY_TONE[category]}>
              {MONEY_CATEGORY_LABEL[category]}
            </Pill>
          </div>
        ) : null}

        {!locked ? (
          <Field
            label="Student"
            htmlFor="pf-student"
            required
            className="md:col-span-2"
          >
            <Select
              id="pf-student"
              name="student_id"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              aria-required
            >
              <option value="">Choose a student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}, {s.code}
                </option>
              ))}
            </Select>
            <FieldError name="student_id" />
          </Field>
        ) : null}

        {!locked && enrolFilter ? (
          <Field
            label="Enrolment"
            htmlFor="pf-enrol"
            required={category !== "bonus"}
            className="md:col-span-2"
            hint={
              student && enrolOptions.length === 0
                ? category === "fee"
                  ? "No paid enrolment yet. Assign a batch in Student 360 first."
                  : category === "stipend"
                    ? "No stipend enrolment yet. Assign a batch in Student 360 first."
                    : "No enrolment yet."
                : undefined
            }
          >
            <Select
              id="pf-enrol"
              key={`${studentId}-${category}`}
              name="enrollment_id"
              defaultValue={enrolDefault}
              disabled={!student}
            >
              {category === "bonus" || enrolOptions.length === 0 ? (
                <option value="">
                  {category === "bonus" ? "Not linked" : "None"}
                </option>
              ) : null}
              {enrolOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </Select>
            <FieldError name="enrollment_id" />
          </Field>
        ) : null}

        {category === "refund" ? (
          <Field
            label="Refund of"
            htmlFor="pf-related"
            required
            className="md:col-span-2"
            hint={
              student && fees.length === 0
                ? "No received fee for this student, so there is nothing to refund."
                : undefined
            }
          >
            <Select
              id="pf-related"
              key={studentId}
              name="related_entry_id"
              defaultValue={initial.related_entry_id}
              disabled={!student}
            >
              <option value="">Choose the fee</option>
              {fees.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </Select>
            <FieldError name="related_entry_id" />
          </Field>
        ) : null}

        {category === "stipend" && !locked ? (
          <Field label="Stipend month" htmlFor="pf-month" required>
            <Input
              id="pf-month"
              type="month"
              name="period_month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              placeholder="YYYY-MM"
              max={today.slice(0, 7)}
            />
            <FieldError name="period_month" />
          </Field>
        ) : null}

        <Field label="Amount (₹)" htmlFor="pf-amount" required>
          <Input
            id="pf-amount"
            name="amount_inr"
            inputMode="numeric"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tabular-nums"
          />
          <FieldError name="amount_inr" />
        </Field>
        <Field label="Date paid" htmlFor="pf-date" required>
          <Input
            id="pf-date"
            type="date"
            name="paid_on"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
          />
          <FieldError name="paid_on" />
        </Field>
        <Field label="Mode" htmlFor="pf-mode" required>
          <Select id="pf-mode" name="mode" defaultValue={initial.mode}>
            {PAY_MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </Select>
          <FieldError name="mode" />
        </Field>
        <Field
          label="UTR, last digits"
          htmlFor="pf-ref"
          hint="Optional. Up to 6 letters or digits."
        >
          <Input
            id="pf-ref"
            name="ref_last4"
            maxLength={6}
            autoComplete="off"
            defaultValue={initial.ref_last4}
            className="tabular-nums"
          />
          <FieldError name="ref_last4" />
        </Field>
        <Field label="For" htmlFor="pf-note" className="md:col-span-2">
          <Input
            id="pf-note"
            name="note"
            maxLength={300}
            defaultValue={initial.note}
            placeholder="e.g. AA30 full fee, part 1 of 2"
          />
          <FieldError name="note" />
        </Field>

        <div className="flex min-w-0 flex-col gap-1.5 md:col-span-2">
          <span className="text-xs font-semibold text-fg-2">
            Save the screenshot as
          </span>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 py-1 pr-1 pl-3">
            <code
              className={cn(
                "min-w-0 flex-1 text-xs break-all",
                !student && "text-fg-3",
              )}
            >
              {fileName}
            </code>
            <CopyButton text={fileName} label="Copy file name" small />
          </div>
          {folder ? (
            <small className="text-xs break-all text-fg-3">
              Folder: {folder}
            </small>
          ) : null}
        </div>
        <Checkbox
          name="proof_saved"
          defaultChecked={initial.proof_saved}
          label="I saved the screenshot in the student’s folder"
          className="md:col-span-2"
        />
      </FormGrid>
    </ActionForm>
  );
}
