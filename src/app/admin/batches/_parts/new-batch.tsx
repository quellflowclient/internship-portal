import { Info } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { ActionForm, SubmitButton } from "@/components/toast";
import { ButtonLink, EmptyState, FormGrid, Notice } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { todayIST } from "@/lib/utils";
import { createBatch } from "@/server/actions/batches";
import { DaysField, Spacer, TextField } from "./fields";
import { PlanSelect } from "./plan-select";
import { nextMonday, planLabel, type CoursePlanRow } from "./shared";

/** Batches → ?new=1. Code, end date and the draft plan are made by the database (create_batch). */
export async function NewBatchPanel({ closeHref }: { closeHref: string }) {
  const supabase = await createClient();
  const [plansRes, templatesRes] = await Promise.all([
    supabase.from("course_plans").select("id, duration_days, fee_inr, course:courses(code, name, active)").eq("active", true),
    supabase.from("plan_templates").select("course_plan_id").eq("active", true),
  ]);
  const withTemplate = new Set(((templatesRes.data ?? []) as { course_plan_id: string }[]).map((t) => t.course_plan_id));
  const plans = ((plansRes.data ?? []) as unknown as CoursePlanRow[])
    .filter((p) => p.course?.active !== false)
    .sort((a, b) => (a.course?.name ?? "").localeCompare(b.course?.name ?? "") || a.duration_days - b.duration_days)
    .map((p) => ({ id: p.id, label: planLabel(p), hasTemplate: withTemplate.has(p.id) }));

  return (
    <Drawer
      closeHref={closeHref}
      title="New batch"
      sub="The plan is copied from the course template. You can edit it before publishing."
      footer={
        <>
          <ButtonLink variant="ghost" href={closeHref} scroll={false}>
            Cancel
          </ButtonLink>
          <Spacer />
          {plans.length ? (
            <SubmitButton form="f-new-batch" pendingText="Creating…">
              Create batch
            </SubmitButton>
          ) : null}
        </>
      }
    >
      {plans.length ? (
        <>
          <ActionForm action={createBatch} id="f-new-batch">
            <FormGrid>
              <PlanSelect options={plans} />
              <TextField idPrefix="nb" name="start_date" label="Start date" type="date" required defaultValue={nextMonday(todayIST())} />
              <TextField idPrefix="nb" name="capacity" label="Seats" required inputMode="numeric" defaultValue="20" />
              <DaysField defaultDays={[1, 2, 3, 4, 5]} className="md:col-span-2" />
              <TextField
                idPrefix="nb"
                name="session_time"
                label="Session time"
                placeholder="6–7 pm IST"
                hint="Shown to students as written."
                className="md:col-span-2"
              />
            </FormGrid>
          </ActionForm>
          <Notice icon={<Info aria-hidden />}>The batch code and end date are set from the course plan and the start date.</Notice>
        </>
      ) : (
        <EmptyState
          title="No active course plan"
          action={
            <ButtonLink href="/admin/settings" variant="secondary">
              Open Settings
            </ButtonLink>
          }
        >
          Add or turn on a course plan in Settings first.
        </EmptyState>
      )}
    </Drawer>
  );
}
