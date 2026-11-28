import { Info } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { ActionForm, FieldError, SubmitButton } from "@/components/toast";
import { ButtonLink, Field, Input, Notice, Segmented, Textarea } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { saveResult } from "@/server/actions/batch-close";
import type { ResultRow } from "./results";

export type Outcome = "completed" | "not_completed";

/**
 * Batch → Close → ?mark=<enrolment id>[&result=not]: set the result.
 * Completed needs a result line (a reason when before the end date); Not completed needs a note.
 */
export function MarkPanel({
  row,
  outcome,
  endDate,
  today,
  closeHref,
  markHref,
}: {
  row: ResultRow;
  outcome: Outcome;
  endDate: string;
  today: string;
  closeHref: string;
  markHref: (enrollmentId: string, outcome?: Outcome) => string;
}) {
  const completed = outcome === "completed";
  const early = completed && endDate > today && row.status !== "completed";
  const formId = "f-mark";
  const editing = row.status === outcome;
  const title = editing ? "Edit result" : completed ? "Mark completed" : "Mark not completed";
  return (
    <Drawer
      closeHref={closeHref}
      title={title}
      sub={row.student ? `${row.student.full_name}, ${row.student.code}` : undefined}
      footer={
        <>
          <ButtonLink href={closeHref} scroll={false} variant="ghost">
            Cancel
          </ButtonLink>
          <span className="flex-1 max-md:hidden" />
          <SubmitButton form={formId}>{editing ? "Save result" : title}</SubmitButton>
        </>
      }
    >
      <Segmented
        label="Result"
        items={[
          { href: markHref(row.id, "completed"), label: "Completed", active: completed },
          { href: markHref(row.id, "not_completed"), label: "Not completed", active: !completed },
        ]}
      />
      {early ? (
        <Notice tone="warn" icon={<Info aria-hidden />}>
          The enrolment ends on {formatDate(`${endDate}T00:00:00+05:30`)}. Completing it now makes it an early completion: the certificate prints today as the end date.
        </Notice>
      ) : null}
      {!completed ? (
        <Notice icon={<Info aria-hidden />}>No certificate is issued for a not completed enrolment. The note is kept in the enrolment log.</Notice>
      ) : null}
      <ActionForm key={outcome} id={formId} action={saveResult} closeHref={closeHref} className="flex flex-col gap-4">
        <input type="hidden" name="enrollment_id" value={row.id} />
        <input type="hidden" name="outcome" value={outcome} />
        {completed ? (
          <>
            <Field label="Result" htmlFor="mk-result" required hint="Printed on the certificate where the template has {result}.">
              <Input
                id="mk-result"
                name="result_note"
                defaultValue={row.status === "completed" ? (row.result_note ?? "Completed") : "Completed"}
                maxLength={200}
              />
              <FieldError name="result_note" />
            </Field>
            <Field label={early ? "Reason for completing early" : "Note for the log"} htmlFor="mk-reason" required={early}>
              <Textarea id="mk-reason" name="change_reason" maxLength={300} placeholder={early ? "e.g. Leaving early for exams, all work done" : "Optional"} />
              <FieldError name="change_reason" />
            </Field>
          </>
        ) : (
          <Field label="Note" htmlFor="mk-note" required hint="Why the internship was not completed.">
            <Textarea
              id="mk-note"
              name="result_note"
              maxLength={300}
              defaultValue={row.status === "not_completed" ? (row.result_note ?? "") : ""}
              placeholder="e.g. Stopped attending after week 2"
            />
            <FieldError name="result_note" />
          </Field>
        )}
      </ActionForm>
    </Drawer>
  );
}
