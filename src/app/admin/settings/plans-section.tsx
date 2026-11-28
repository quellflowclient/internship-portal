import Link from "next/link";
import { CalendarDays, Info } from "lucide-react";
import { ButtonLink, Card, CardHeader, Checkbox, Field, IconLink, Input, Notice, Pill } from "@/components/ui";
import { End, List, MainCell, Wide } from "@/components/list";
import { Drawer } from "@/components/drawer";
import { ActionForm, FieldError, SubmitButton } from "@/components/toast";
import { createClient } from "@/lib/supabase/server";
import { cn, inr } from "@/lib/utils";
import { updateCoursePlan } from "@/server/actions/settings";
import { TemplateDrawer } from "./_plan-template/template-drawer";

type PlanRow = {
  id: string;
  duration_days: number;
  fee_inr: number;
  active: boolean;
  courses: { code: string; name: string } | null;
};

const CLOSE = "/admin/settings?sec=plans";

export async function PlansSection({ open, tpl, ti }: { open?: string; tpl?: string; ti?: string }) {
  const supabase = await createClient();
  const [{ data }, { data: tplData }] = await Promise.all([
    supabase.from("course_plans").select("id, duration_days, fee_inr, active, courses(code, name)"),
    supabase.from("plan_templates").select("course_plan_id, plan_template_items(count)").eq("active", true),
  ]);
  const plans = ((data ?? []) as unknown as PlanRow[]).sort(
    (a, b) => Number(b.active) - Number(a.active) || (a.courses?.name ?? "").localeCompare(b.courses?.name ?? "") || a.duration_days - b.duration_days,
  );
  const tplCount = new Map(
    ((tplData ?? []) as unknown as { course_plan_id: string; plan_template_items: { count: number }[] }[]).map((t) => [
      t.course_plan_id,
      t.plan_template_items[0]?.count ?? 0,
    ]),
  );
  const itemsText = (id: string) => {
    const n = tplCount.get(id);
    return n === undefined ? "No template" : `${n} ${n === 1 ? "item" : "items"}`;
  };
  const sel = open ? plans.find((p) => p.id === open) : undefined;
  const tplPlan = tpl && !sel ? plans.find((p) => p.id === tpl) : undefined;

  return (
    <>
      <Card>
        <CardHeader title="Course plans and fees" info="The fee here is the default when a paid student is assigned. Changing it does not change fees already agreed." />
        <List
          cols="minmax(0,2fr) 90px 110px 90px 110px 36px"
          head={[["Course"], ["Length", "wide"], ["Template", "wide"], ["Status", "wide"], ["Fee", "wide-right"], ["", "wide"]]}
          empty="No course plans yet. Run the seed once on this database."
        >
          {plans.map((p, i) => (
            // The row is a stretched link to the fee panel; "Plan template" is a separate link (links cannot nest).
            <div
              key={p.id}
              style={{ ["--i" as string]: Math.min(i, 10) }}
              className={cn(
                "qf-list-row qf-row relative min-h-[52px] border-b border-line py-2 transition-colors last:border-b-0 hover:bg-hover",
                (p.id === open || p.id === tpl) && "bg-accent-soft",
              )}
            >
              <MainCell
                title={
                  <Link href={`${CLOSE}&open=${p.id}`} scroll={false} className="text-fg no-underline after:absolute after:inset-0 after:content-['']">
                    {p.courses?.name ?? "Course"}
                  </Link>
                }
                sub={`${p.courses?.code ?? ""} ${p.duration_days} days`.trim()}
                narrow={[itemsText(p.id), p.active ? null : "inactive"].filter(Boolean).join(", ")}
              />
              <Wide>{p.duration_days} days</Wide>
              <Wide>{itemsText(p.id)}</Wide>
              <Wide>{p.active ? <Pill tone="ok">Active</Pill> : <Pill>Inactive</Pill>}</Wide>
              <End>
                <span className="text-sm font-semibold tabular-nums">{inr(p.fee_inr)}</span>
                <IconLink href={`${CLOSE}&tpl=${p.id}`} scroll={false} label="Plan template" className="relative z-[1] md:hidden">
                  <CalendarDays aria-hidden />
                </IconLink>
              </End>
              <span className="qf-wide justify-self-end">
                <IconLink href={`${CLOSE}&tpl=${p.id}`} scroll={false} label="Plan template" className="relative z-[1]">
                  <CalendarDays aria-hidden />
                </IconLink>
              </span>
            </div>
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
            New batches get their week-by-week plan from the{" "}
            <Link href={`${CLOSE}&tpl=${sel.id}`} scroll={false} className="font-semibold text-accent-ink">
              plan template
            </Link>{" "}
            ({itemsText(sel.id).toLowerCase()}).
          </Notice>
        </Drawer>
      ) : null}

      {tplPlan ? (
        <TemplateDrawer
          coursePlan={{ id: tplPlan.id, duration_days: tplPlan.duration_days, name: tplPlan.courses?.name ?? "Course plan" }}
          ti={ti}
          closeHref={CLOSE}
        />
      ) : null}
    </>
  );
}
