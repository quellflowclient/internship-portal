import { Info, TriangleAlert } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { ActionForm, FieldError, SubmitButton } from "@/components/toast";
import { ButtonLink, Field, FormGrid, Input, Notice } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { inr } from "@/lib/utils";
import { saveAgreement } from "@/server/actions/payments";
import { currentMonth, isUuid, monthLabel } from "./shared";
import type { AgreementRow } from "./stipend";

/** Payments → Stipend run → ?agreement=<enrolment id>: monthly amount from a month on. */
export async function AgreementPanel({
  enrollmentId,
  closeHref,
}: {
  enrollmentId: string;
  closeHref: string;
}) {
  const supabase = await createClient();
  const { data } = isUuid(enrollmentId)
    ? await supabase
        .from("enrollments")
        .select(
          "id, type, student:students(code, full_name), batch:batches(code), agreements:stipend_agreements(id, monthly_inr, from_month, to_month, agreed_note, created_at)",
        )
        .eq("id", enrollmentId)
        .maybeSingle()
    : { data: null };
  const e = data as unknown as {
    id: string;
    type: string;
    student: { code: string; full_name: string } | null;
    batch: { code: string } | null;
    agreements: AgreementRow[];
  } | null;

  if (!e || e.type !== "stipend") {
    return (
      <Drawer closeHref={closeHref} title="Stipend amount">
        <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
          This is not a stipend enrolment. Open it again from the Agreements
          list.
        </Notice>
      </Drawer>
    );
  }

  const history = [...(e.agreements ?? [])].sort((a, b) =>
    b.from_month.localeCompare(a.from_month),
  );
  const latest = history[0];
  const thisMonth = currentMonth();
  const defaultFrom =
    latest && latest.from_month.slice(0, 7) > thisMonth
      ? latest.from_month.slice(0, 7)
      : thisMonth;

  return (
    <Drawer
      closeHref={closeHref}
      title="Stipend amount"
      sub={`${e.student?.full_name ?? "—"}, ${e.batch?.code ?? "—"}`}
      footer={
        <>
          <ButtonLink variant="ghost" href={closeHref} scroll={false}>
            Cancel
          </ButtonLink>
          <span className="flex-1 max-md:hidden" />
          <SubmitButton form="f-agreement">Save amount</SubmitButton>
        </>
      }
    >
      <ActionForm action={saveAgreement} closeHref={closeHref} id="f-agreement">
        <input type="hidden" name="enrollment_id" value={e.id} />
        <FormGrid>
          <Field label="Monthly amount (₹)" htmlFor="ag-amount" required>
            <Input
              id="ag-amount"
              name="monthly_inr"
              inputMode="numeric"
              autoComplete="off"
              defaultValue={latest ? String(latest.monthly_inr) : ""}
              className="tabular-nums"
            />
            <FieldError name="monthly_inr" />
          </Field>
          <Field label="From month" htmlFor="ag-from" required>
            <Input
              id="ag-from"
              type="month"
              name="from_month"
              defaultValue={defaultFrom}
              placeholder="YYYY-MM"
            />
            <FieldError name="from_month" />
          </Field>
          <Field
            label="Note"
            htmlFor="ag-note"
            hint="Where it was agreed, e.g. email 12 Nov."
            className="md:col-span-2"
          >
            <Input id="ag-note" name="agreed_note" maxLength={200} />
            <FieldError name="agreed_note" />
          </Field>
        </FormGrid>
      </ActionForm>
      <Notice icon={<Info aria-hidden />}>
        Unpaid rows from that month on take the new amount. Paid months are not
        changed.
      </Notice>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-fg-2">History</span>
        {history.length ? (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
            {history.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <span className="min-w-0">
                  <b className="block font-semibold">
                    {monthLabel(a.from_month.slice(0, 7))}
                    {a.to_month
                      ? ` to ${monthLabel(a.to_month.slice(0, 7))}`
                      : " onwards"}
                  </b>
                  {a.agreed_note ? (
                    <small className="block truncate text-xs text-fg-3">
                      {a.agreed_note}
                    </small>
                  ) : null}
                </span>
                <span className="font-semibold whitespace-nowrap tabular-nums">
                  {inr(a.monthly_inr)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-3">
            No amount set yet. The enrolment needs one before it can become
            active.
          </p>
        )}
      </div>
    </Drawer>
  );
}
