import { Info } from "lucide-react";
import { ButtonLink, Card, CardHeader, Checkbox, Field, Input, Notice, Pill } from "@/components/ui";
import { Chevron, End, List, ListRow, MainCell, Wide } from "@/components/list";
import { Drawer } from "@/components/drawer";
import { ActionForm, FieldError, SubmitButton } from "@/components/toast";
import { createClient } from "@/lib/supabase/server";
import { inr } from "@/lib/utils";
import { updateCoursePlan } from "@/server/actions/settings";

type PlanRow = {
  id: string;
  duration_days: number;
  fee_inr: number;
  active: boolean;
  courses: { code: string; name: string } | null;
};

const CLOSE = "/admin/settings?sec=plans";

export async function PlansSection({ open }: { open?: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("course_plans").select("id, duration_days, fee_inr, active, courses(code, name)");
  const plans = ((data ?? []) as unknown as PlanRow[]).sort(
    (a, b) => Number(b.active) - Number(a.active) || (a.courses?.name ?? "").localeCompare(b.courses?.name ?? "") || a.duration_days - b.duration_days,
  );
  const sel = open ? plans.find((p) => p.id === open) : undefined;

  return (
    <>
      <Notice tone="info" icon={<Info aria-hidden />}>
        Plan templates (week-by-week items) are edited in Step C.
      </Notice>
      <Card>
        <CardHeader title="Course plans and fees" info="The fee here is the default when a paid student is assigned. Changing it does not change fees already agreed." />
        <List
          cols="minmax(0,2fr) 90px 90px 110px 20px"
          head={[["Course"], ["Length", "wide"], ["Status", "wide"], ["Fee", "wide-right"], ["", "wide"]]}
          empty="No course plans yet. Run the seed once on this database."
        >
          {plans.map((p, i) => (
            <ListRow key={p.id} href={`${CLOSE}&open=${p.id}`} i={i} selected={p.id === open}>
              <MainCell
                title={p.courses?.name ?? "Course"}
                sub={`${p.courses?.code ?? ""} ${p.duration_days} days`.trim()}
                narrow={p.active ? undefined : "inactive"}
              />
              <Wide>{p.duration_days} days</Wide>
              <Wide>{p.active ? <Pill tone="ok">Active</Pill> : <Pill>Inactive</Pill>}</Wide>
              <End>
                <span className="text-sm font-semibold tabular-nums">{inr(p.fee_inr)}</span>
              </End>
              <Chevron />
            </ListRow>
          ))}
        </List>
      </Card>

      {sel ? (
        <Drawer
          closeHref={CLOSE}
          title={sel.courses?.name ?? "Course plan"}
          sub={`${sel.duration_days} days`}
          footer={
            <>
              <ButtonLink href={CLOSE} scroll={false}>
                Cancel
              </ButtonLink>
              <SubmitButton form="plan-form">Save plan</SubmitButton>
            </>
          }
        >
          <ActionForm id="plan-form" action={updateCoursePlan} closeHref={CLOSE} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={sel.id} />
            <Field label="Fee in rupees" htmlFor="fee_inr" hint="Whole rupees. Used as the default for new paid students." required>
              <Input id="fee_inr" name="fee_inr" type="number" inputMode="numeric" min={0} step={1} defaultValue={sel.fee_inr} />
              <FieldError name="fee_inr" />
            </Field>
            <Checkbox name="active" defaultChecked={sel.active} label="Active. Shown when a student is assigned to a batch." />
          </ActionForm>
          <Notice tone="info" icon={<Info aria-hidden />}>
            Plan templates (week-by-week items) are edited in Step C.
          </Notice>
        </Drawer>
      ) : null}
    </>
  );
}
