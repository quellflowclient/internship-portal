import { Info } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { ActionForm, FieldError, SubmitButton } from "@/components/toast";
import { ButtonLink, Field, Input, Notice, Textarea } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { markCompleted } from "@/server/actions/documents";
import type { ResultRow } from "./results";

/** Batch → Close → ?mark=<enrolment id>: mark completed with a result (a reason when before the end date). */
export function MarkPanel({ row, endDate, today, closeHref }: { row: ResultRow; endDate: string; today: string; closeHref: string }) {
  const early = endDate > today && row.status !== "completed";
  const formId = "f-mark";
  return (
    <Drawer
      closeHref={closeHref}
      title={row.status === "completed" ? "Edit result" : "Mark completed"}
      sub={row.student ? `${row.student.full_name}, ${row.student.code}` : undefined}
      footer={
        <>
          <ButtonLink href={closeHref} scroll={false} variant="ghost">
            Cancel
          </ButtonLink>
          <span className="flex-1 max-md:hidden" />
          <SubmitButton form={formId}>{row.status === "completed" ? "Save result" : "Mark completed"}</SubmitButton>
        </>
      }
    >
      {early ? (
        <Notice tone="warn" icon={<Info aria-hidden />}>
          The enrolment ends on {formatDate(`${endDate}T00:00:00+05:30`)}. Completing it now makes it an early completion: the certificate prints today as the end date.
        </Notice>
      ) : null}
      <ActionForm id={formId} action={markCompleted} closeHref={closeHref} className="flex flex-col gap-4">
        <input type="hidden" name="enrollment_id" value={row.id} />
        <Field label="Result" htmlFor="mk-result" required hint="Printed on the certificate where the template has {result}.">
          <Input id="mk-result" name="result_note" defaultValue={row.result_note ?? "Completed"} maxLength={200} />
          <FieldError name="result_note" />
        </Field>
        <Field label={early ? "Reason for completing early" : "Note for the log"} htmlFor="mk-reason" required={early}>
          <Textarea id="mk-reason" name="change_reason" maxLength={300} placeholder={early ? "e.g. Leaving early for exams, all work done" : "Optional"} />
          <FieldError name="change_reason" />
        </Field>
      </ActionForm>
    </Drawer>
  );
}
