import Link from "next/link";
import { Info, Plus, Trash2 } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { GroupHeader } from "@/components/list";
import { ActionForm, FieldError, SubmitButton } from "@/components/toast";
import { ButtonLink, EmptyState, Field, Input, Notice } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validators";
import type { PlanTemplateItem } from "@/lib/types";
import { addTemplateItem, deleteTemplateItem, updateTemplateItem } from "@/server/actions/plan-templates";
import { ItemFields } from "@/app/admin/batches/[code]/plan/_parts/item-fields";
import { KindDot } from "@/app/plan/_lib/plan-ui";

type CoursePlan = { id: string; duration_days: number; name: string };

function WeekDayFields({ week, day, maxDay }: { week: number; day: number; maxDay: number }) {
  return (
    <>
      <Field label="Week" htmlFor="ti-week" required>
        <Input id="ti-week" name="week" type="number" inputMode="numeric" min={1} max={20} step={1} defaultValue={week} required />
        <FieldError name="week" />
      </Field>
      <Field label="Day number" htmlFor="ti-day" required hint="Working day of the batch. Day 1 is the start date.">
        <Input id="ti-day" name="day_offset" type="number" inputMode="numeric" min={1} max={maxDay} step={1} defaultValue={day} required />
        <FieldError name="day_offset" />
      </Field>
    </>
  );
}

/** ?sec=plans&tpl=<course plan id>[&ti=<item id>|new] – the course plan's active template. */
export async function TemplateDrawer({ coursePlan, ti, closeHref }: { coursePlan: CoursePlan; ti?: string; closeHref: string }) {
  const listHref = `${closeHref}&tpl=${coursePlan.id}`;
  const supabase = await createClient();
  const { data: tpl } = await supabase
    .from("plan_templates")
    .select("id, version")
    .eq("course_plan_id", coursePlan.id)
    .eq("active", true)
    .maybeSingle();
  const template = tpl as { id: string; version: number } | null;
  const items = template
    ? (((await supabase.from("plan_template_items").select("*").eq("template_id", template.id).order("seq")).data ?? []) as PlanTemplateItem[])
    : [];
  const sub = `${coursePlan.name}, ${coursePlan.duration_days} days${template ? `, version ${template.version}` : ""}`;
  const last = items[items.length - 1];

  /* ---------- add ---------- */
  if (ti === "new") {
    return (
      <Drawer
        closeHref={listHref}
        title="Add template item"
        sub={sub}
        footer={
          <>
            <ButtonLink href={listHref} scroll={false} variant="ghost">
              Cancel
            </ButtonLink>
            <span className="flex-1 max-md:hidden" />
            <SubmitButton form="ti-form">Add item</SubmitButton>
          </>
        }
      >
        {!template ? <Notice tone="info">This course plan has no template yet. Adding the first item creates version 1.</Notice> : null}
        <ActionForm id="ti-form" action={addTemplateItem} closeHref={listHref} className="flex flex-col gap-4">
          <input type="hidden" name="course_plan_id" value={coursePlan.id} />
          <ItemFields idp="ti">
            <WeekDayFields
              week={last?.week ?? 1}
              day={Math.min((last?.day_offset ?? 0) + 1, coursePlan.duration_days)}
              maxDay={coursePlan.duration_days}
            />
          </ItemFields>
        </ActionForm>
      </Drawer>
    );
  }

  /* ---------- edit one item ---------- */
  if (ti) {
    const it = uuid.safeParse(ti).success ? items.find((i) => i.id === ti) : undefined;
    if (!it) {
      return (
        <Drawer closeHref={listHref} title="Item not found" sub={sub}>
          <EmptyState title="This template item was not found">It may have been deleted.</EmptyState>
        </Drawer>
      );
    }
    return (
      <Drawer
        closeHref={listHref}
        title="Template item"
        sub={`Week ${it.week}, day ${it.day_offset}`}
        footer={
          <>
            <SubmitButton form="ti-del" variant="danger" pendingText="Deleting…">
              <Trash2 aria-hidden />
              Delete
            </SubmitButton>
            <span className="flex-1 max-md:hidden" />
            <ButtonLink href={listHref} scroll={false} variant="ghost">
              Cancel
            </ButtonLink>
            <SubmitButton form="ti-form">Save item</SubmitButton>
          </>
        }
      >
        <ActionForm key={it.id} id="ti-form" action={updateTemplateItem} closeHref={listHref} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={it.id} />
          <ItemFields idp="ti" item={it}>
            <WeekDayFields week={it.week} day={it.day_offset} maxDay={coursePlan.duration_days} />
          </ItemFields>
        </ActionForm>
        <ActionForm id="ti-del" action={deleteTemplateItem} closeHref={listHref} className="hidden">
          <input type="hidden" name="id" value={it.id} />
        </ActionForm>
      </Drawer>
    );
  }

  /* ---------- list ---------- */
  const weeks = new Map<number, PlanTemplateItem[]>();
  for (const it of items) weeks.set(it.week, [...(weeks.get(it.week) ?? []), it]);

  return (
    <Drawer
      closeHref={closeHref}
      title="Plan template"
      sub={sub}
      footer={
        <>
          <ButtonLink href={`${closeHref}&open=${coursePlan.id}`} scroll={false} variant="ghost">
            Fee and status
          </ButtonLink>
          <span className="flex-1 max-md:hidden" />
          <ButtonLink href={`${listHref}&ti=new`} scroll={false} variant="primary">
            <Plus aria-hidden />
            Add item
          </ButtonLink>
        </>
      }
    >
      <Notice tone="info" icon={<Info aria-hidden />}>
        Used when a new batch is created. Running batches keep their own copy.
      </Notice>
      {items.length ? (
        <div className="overflow-hidden rounded-xl border border-line">
          {[...weeks.entries()]
            .sort(([a], [b]) => a - b)
            .map(([week, list]) => (
              <div key={week}>
                <GroupHeader>Week {week}</GroupHeader>
                {list.map((it) => (
                  <Link
                    key={it.id}
                    href={`${listHref}&ti=${it.id}`}
                    scroll={false}
                    className="grid min-h-12 grid-cols-[56px_minmax(0,1fr)] items-center gap-3 border-b border-line px-4 py-2.5 text-sm text-fg no-underline last:border-b-0 hover:bg-hover"
                  >
                    <span className="text-xs font-medium text-fg-3">Day {it.day_offset}</span>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <KindDot kind={it.kind} />
                      <b className="min-w-0 truncate font-semibold">{it.title}</b>
                    </span>
                  </Link>
                ))}
              </div>
            ))}
        </div>
      ) : (
        <EmptyState title="No template items yet">
          New batches of this course plan start with an empty plan. Add the first item to create the template.
        </EmptyState>
      )}
    </Drawer>
  );
}
