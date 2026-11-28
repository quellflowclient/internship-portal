/** Student 360 panels (?panel=assign|change|remove|transfer|edit|archive). Forms post to src/server/actions/students.ts. */
import type { ReactNode } from "react";
import { Info, Trash2, TriangleAlert } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { ActionForm, SubmitButton } from "@/components/toast";
import { ButtonLink, DL, EmptyState, FormGrid, Notice, Pill, RadioSegment } from "@/components/ui";
import { ENROLLMENT_STATUS, TYPE } from "@/lib/labels";
import { formatPhone } from "@/lib/phone";
import { formatDate, inr } from "@/lib/utils";
import type { EnrollmentStatus, StudentType } from "@/lib/types";
import {
  archiveStudent,
  assignStudent,
  changeEnrollment,
  removeEnrollment,
  restoreEnrollment,
  restoreStudent,
  transferEnrollment,
  updateProfile,
} from "@/server/actions/students";
import { SelectField, TextAreaField, TextField } from "../../_parts/fields";
import { planLabel, TYPE_OPTIONS } from "../../_parts/shared";
import type { AgreementRow, BatchOption, ChangeRow, EnrolmentRow, StudentRow } from "./data";

function Cancel({ href }: { href: string }) {
  return (
    <ButtonLink variant="ghost" href={href} scroll={false}>
      Cancel
    </ButtonLink>
  );
}
const Spacer = () => <span className="flex-1 max-md:hidden" />;

function Hidden({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3.5 rounded-[10px] border border-line p-3.5">
      <legend className="px-1 text-xs font-semibold text-fg-2">{title}</legend>
      {children}
    </fieldset>
  );
}

/* ---------- Assign to batch ---------- */
export function AssignPanel({
  s,
  batches,
  seats,
  closeHref,
}: {
  s: StudentRow;
  batches: BatchOption[];
  seats: Record<string, number>;
  closeHref: string;
}) {
  const planned = batches.find((b) => b.course_plan_id === s.planned_course_plan_id);
  const plannedPlan = planned?.course_plan ?? null;
  return (
    <Drawer
      closeHref={closeHref}
      title="Assign to batch"
      sub={`${s.full_name}, ${s.code}`}
      footer={
        batches.length ? (
          <>
            <Cancel href={closeHref} />
            <Spacer />
            <SubmitButton form="f-assign" pendingText="Assigning…">
              Assign
            </SubmitButton>
          </>
        ) : undefined
      }
    >
      {batches.length === 0 ? (
        <EmptyState
          title="No open batches"
          action={
            <ButtonLink href="/admin/batches" variant="primary">
              Go to Batches
            </ButtonLink>
          }
        >
          A student can join a planned or running batch. Create one in Batches first.
        </EmptyState>
      ) : (
        <ActionForm action={assignStudent} closeHref={closeHref} id="f-assign" className="flex flex-col gap-4">
          <Hidden values={{ student_id: s.id, code: s.code }} />
          <SelectField idPrefix="as" name="batch_id" label="Batch" required defaultValue={planned?.id ?? ""}>
            <option value="" disabled>
              Pick a batch
            </option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code}, {planLabel(b.course_plan)}, {seats[b.id] ?? 0} of {b.capacity} seats
              </option>
            ))}
          </SelectField>
          <RadioSegment name="type" label="Student type" options={TYPE_OPTIONS} defaultValue={s.planned_type ?? "paid"} />
          <Group title="For Paid">
            <TextField
              idPrefix="as"
              name="fee"
              label="Agreed fee (₹)"
              inputMode="numeric"
              placeholder={plannedPlan ? String(plannedPlan.fee_inr) : "Plan fee"}
              hint={
                plannedPlan
                  ? `Leave empty to use the plan fee: ${inr(plannedPlan.fee_inr)} for ${planLabel(plannedPlan)}.`
                  : "Leave empty to use the fee of the batch's course plan."
              }
            />
          </Group>
          <Group title="For Free">
            <TextField idPrefix="as" name="free_reason" label="Why free" hint="Required for Free. Saved with your name." />
          </Group>
          <Group title="For Stipend">
            <FormGrid>
              <TextField idPrefix="as" name="stipend_monthly" label="Monthly stipend (₹)" inputMode="numeric" hint="Needed before the enrolment becomes active." />
              <TextField idPrefix="as" name="stipend_note" label="Agreed how" placeholder="Email 12 Nov" />
            </FormGrid>
          </Group>
          <TextField idPrefix="as" name="capacity_reason" label="Reason to go over capacity" hint="Only needed when the batch is full." />
        </ActionForm>
      )}
    </Drawer>
  );
}

/* ---------- Change type / fee ---------- */
const STATUS_WORD = (v: string | null) => (v && v in ENROLLMENT_STATUS ? ENROLLMENT_STATUS[v as EnrollmentStatus].label : v ?? "none");
const TYPE_WORD = (v: string | null) => (v && v in TYPE ? TYPE[v as StudentType].label : v ?? "none");

function changeText(c: ChangeRow): string {
  switch (c.change) {
    case "type":
      return `Type changed from ${TYPE_WORD(c.from_value)} to ${TYPE_WORD(c.to_value)}`;
    case "fee":
      return `Fee changed from ${c.from_value ? inr(Number(c.from_value)) : "none"} to ${c.to_value ? inr(Number(c.to_value)) : "none"}`;
    case "status":
      return `Status changed from ${STATUS_WORD(c.from_value)} to ${STATUS_WORD(c.to_value)}`;
    case "batch":
      return "Moved to another batch";
    default:
      return "Dates changed";
  }
}

export function ChangePanel({
  s,
  e,
  agreement,
  history,
  closeHref,
  removeHref,
}: {
  s: StudentRow;
  e: EnrolmentRow;
  agreement: AgreementRow | null;
  history: ChangeRow[];
  closeHref: string;
  removeHref: string;
}) {
  return (
    <Drawer
      closeHref={closeHref}
      title="Change enrolment"
      sub={`${s.full_name}, ${e.batch?.code ?? "batch"}`}
      footer={
        <>
          <ButtonLink variant="danger" href={removeHref} scroll={false}>
            <Trash2 aria-hidden />
            Remove from batch
          </ButtonLink>
          <Spacer />
          <SubmitButton form="f-change">Save</SubmitButton>
        </>
      }
    >
      <ActionForm action={changeEnrollment} closeHref={closeHref} id="f-change" className="flex flex-col gap-4">
        <Hidden values={{ enrollment_id: e.id, code: s.code }} />
        <RadioSegment name="type" label="Student type" options={TYPE_OPTIONS} defaultValue={e.type} />
        <TextField
          idPrefix="ch"
          name="fee"
          label="Agreed fee (₹)"
          inputMode="numeric"
          defaultValue={e.fee_inr ?? (e.batch?.course_plan?.fee_inr ?? "")}
          hint="Whole rupees. Needed for Paid. Cleared for Free and Stipend."
        />
        <FormGrid>
          <TextField
            idPrefix="ch"
            name="stipend_monthly"
            label="Monthly stipend (₹)"
            inputMode="numeric"
            defaultValue={agreement?.monthly_inr ?? ""}
            hint="Only for Stipend."
          />
          <TextField idPrefix="ch" name="stipend_note" label="Agreed how" placeholder="Email 12 Nov" defaultValue={agreement?.agreed_note ?? ""} />
        </FormGrid>
        <TextAreaField idPrefix="ch" name="reason" label="Reason (for the record)" required hint="Saved in the change history with the date." />
      </ActionForm>
      <div>
        <h3 className="mb-2 text-xs font-semibold text-fg-2">Change history</h3>
        {history.length ? (
          <ul className="flex flex-col gap-3">
            {history.map((c) => (
              <li key={c.id} className="text-sm">
                <b className="block font-semibold">{changeText(c)}</b>
                {c.reason ? <p className="text-fg-2 break-words">{c.reason}</p> : null}
                <small className="text-xs text-fg-3">{formatDate(c.changed_at)}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-3">No changes yet.</p>
        )}
      </div>
    </Drawer>
  );
}

/* ---------- Remove from batch ---------- */
export function RemovePanel({ s, e, closeHref }: { s: StudentRow; e: EnrolmentRow; closeHref: string }) {
  const next = e.status === "assigned" ? "Withdrawn" : "Dropped";
  return (
    <Drawer
      closeHref={closeHref}
      title="Remove from batch"
      sub={`${s.full_name}, ${e.batch?.code ?? "batch"}`}
      footer={
        <>
          <Cancel href={closeHref} />
          <Spacer />
          <SubmitButton form="f-remove" variant="danger" pendingText="Removing…">
            Remove from batch
          </SubmitButton>
        </>
      }
    >
      <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
        The enrolment is kept as {next}, with your reason. Open stipend rows for it are voided. You can undo for 5 seconds.
      </Notice>
      <ActionForm action={removeEnrollment} undo={restoreEnrollment} closeHref={closeHref} id="f-remove">
        <Hidden values={{ enrollment_id: e.id, code: s.code }} />
        <TextAreaField idPrefix="rm" name="reason" label="Reason" required placeholder="Left for a full-time job" />
      </ActionForm>
    </Drawer>
  );
}

/* ---------- Edit profile ---------- */
export function EditPanel({ s, closeHref, archiveHref }: { s: StudentRow; closeHref: string; archiveHref: string }) {
  const archived = s.state === "archived";
  return (
    <Drawer
      closeHref={closeHref}
      title="Edit profile"
      sub={`${s.full_name}, ${s.code}`}
      footer={
        <>
          {archived ? null : (
            <ButtonLink variant="danger" href={archiveHref} scroll={false}>
              <Trash2 aria-hidden />
              Archive student
            </ButtonLink>
          )}
          <Spacer />
          <SubmitButton form="f-profile">Save</SubmitButton>
        </>
      }
    >
      <ActionForm action={updateProfile} closeHref={closeHref} id="f-profile">
        <Hidden values={{ id: s.id, code: s.code }} />
        <FormGrid>
          <TextField
            idPrefix="ep"
            name="name_on_documents"
            label="Name on documents"
            required
            defaultValue={s.name_on_documents}
            hint="Changing this affects new documents only."
            className="md:col-span-2"
          />
          <TextField idPrefix="ep" name="full_name" label="Full name" required defaultValue={s.full_name} className="md:col-span-2" />
          <TextField idPrefix="ep" name="phone" label="Mobile" required inputMode="tel" defaultValue={formatPhone(s.phone)} />
          <TextField idPrefix="ep" name="email" label="Email" required type="email" defaultValue={s.email} hint={s.user_id ? "This student already signs in. Their sign-in email stays the same." : undefined} />
          <TextField idPrefix="ep" name="city" label="City" defaultValue={s.city ?? ""} />
          <TextField idPrefix="ep" name="dob" label="Date of birth" type="date" defaultValue={s.dob ?? ""} />
          <TextField idPrefix="ep" name="college" label="College" required defaultValue={s.college} className="md:col-span-2" />
          <TextField idPrefix="ep" name="course" label="Course" defaultValue={s.course ?? ""} />
          <SelectField idPrefix="ep" name="year" label="Year" defaultValue={s.year_of_study ? String(s.year_of_study) : ""}>
            <option value="">Not given</option>
            {[1, 2, 3, 4, 5, 6].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </SelectField>
          <TextField idPrefix="ep" name="github_url" label="GitHub" placeholder="github.com/name" defaultValue={s.github_url ?? ""} />
          <TextField idPrefix="ep" name="linkedin_url" label="LinkedIn" placeholder="linkedin.com/in/name" defaultValue={s.linkedin_url ?? ""} />
        </FormGrid>
      </ActionForm>
    </Drawer>
  );
}

/* ---------- Archive ---------- */
export function ArchivePanel({ s, hasOpen, closeHref, cancelHref }: { s: StudentRow; hasOpen: boolean; closeHref: string; cancelHref: string }) {
  return (
    <Drawer
      closeHref={closeHref}
      title="Archive student"
      sub={`${s.full_name}, ${s.code}`}
      footer={
        hasOpen ? undefined : (
          <>
            <Cancel href={cancelHref} />
            <Spacer />
            <SubmitButton form="f-archive" variant="danger" pendingText="Archiving…">
              Archive student
            </SubmitButton>
          </>
        )
      }
    >
      {hasOpen ? (
        <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
          This student is still in a batch. Remove them from the batch first (Enrolment, Remove from batch).
        </Notice>
      ) : (
        <>
          <Notice icon={<Info aria-hidden />}>
            Nothing is deleted. Archived students cannot be assigned to a batch. You can undo for 5 seconds, or restore later from this page.
          </Notice>
          <ActionForm action={archiveStudent} undo={restoreStudent} closeHref={closeHref} id="f-archive">
            <Hidden values={{ id: s.id, code: s.code }} />
            <TextAreaField idPrefix="ar" name="reason" label="Reason" required placeholder="Duplicate record, or did not join" />
          </ActionForm>
        </>
      )}
    </Drawer>
  );
}

/* ---------- Move to another batch (transfer) ---------- */
export function TransferPanel({
  s,
  e,
  batches,
  seats,
  agreement,
  closeHref,
}: {
  s: StudentRow;
  e: EnrolmentRow;
  batches: BatchOption[];
  seats: Record<string, number>;
  agreement: AgreementRow | null;
  closeHref: string;
}) {
  const options = batches.filter((b) => b.id !== e.batch_id);
  const keeps =
    e.type === "paid"
      ? `Agreed fee ${inr(e.fee_inr)} is kept.`
      : e.type === "free"
        ? `Why free is kept: ${e.free_reason ?? "none"}.`
        : agreement
          ? `Stipend ${inr(agreement.monthly_inr)} a month is kept.`
          : "No stipend agreement yet. Add it later with Change.";
  return (
    <Drawer
      closeHref={closeHref}
      title="Move to another batch"
      sub={`${s.full_name}, now in ${e.batch?.code ?? "a batch"}`}
      footer={
        options.length ? (
          <>
            <Cancel href={closeHref} />
            <Spacer />
            <SubmitButton form="f-transfer" pendingText="Moving…">
              Move student
            </SubmitButton>
          </>
        ) : undefined
      }
    >
      {options.length === 0 ? (
        <EmptyState
          title="No other open batch"
          action={
            <ButtonLink href="/admin/batches" variant="primary">
              Go to Batches
            </ButtonLink>
          }
        >
          A student can move to a planned or running batch. Create one in Batches first.
        </EmptyState>
      ) : (
        <>
          <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
            The current enrolment is kept as Transferred, with your reason. There is no Undo. To undo, move the student back.
          </Notice>
          <DL
            items={[
              [
                "Student type",
                <Pill key="t" tone={TYPE[e.type].tone}>
                  {TYPE[e.type].label}
                </Pill>,
              ],
              ["Kept", keeps],
            ]}
          />
          <ActionForm action={transferEnrollment} closeHref={closeHref} id="f-transfer" className="flex flex-col gap-4">
            <Hidden values={{ enrollment_id: e.id, code: s.code }} />
            <SelectField idPrefix="tr" name="batch_id" label="Move to batch" required defaultValue="">
              <option value="" disabled>
                Pick a batch
              </option>
              {options.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code}, {planLabel(b.course_plan)}, {seats[b.id] ?? 0} of {b.capacity} seats
                </option>
              ))}
            </SelectField>
            <TextAreaField idPrefix="tr" name="reason" label="Reason" required placeholder="Evening timing suits better" hint="Saved in the change history with the date." />
            <TextField idPrefix="tr" name="capacity_reason" label="Reason to go over capacity" hint="Only needed when the batch is full." />
          </ActionForm>
        </>
      )}
    </Drawer>
  );
}
