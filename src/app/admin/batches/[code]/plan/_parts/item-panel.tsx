import { Ban, Info, Trash2, Undo2 } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { ActionForm, FieldError, SubmitButton } from "@/components/toast";
import { ButtonLink, EmptyState, Field, Input, Notice, Textarea } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { PLAN_KIND } from "@/lib/labels";
import { formatDate, formatDay, todayIST } from "@/lib/utils";
import { uuid } from "@/lib/validators";
import type { Batch, BatchPlan, BatchPlanItem, PlanItemStatusRow } from "@/lib/types";
import { addPlanItem, deletePlanItem, restorePlanItem, skipPlanItem, unskipPlanItem, updatePlanItem } from "@/server/actions/plan";
import { weekOf } from "@/app/plan/_lib/plan";
import { ItemFields } from "./item-fields";

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

function DateWeekFields({ batch, date, week }: { batch: Batch; date: string; week?: number | null }) {
  return (
    <>
      <Field
        label="Planned date"
        htmlFor="pi-date"
        required
        hint={`Inside the batch, ${formatDate(batch.start_date)} to ${formatDate(batch.end_date)}`}
      >
        <Input id="pi-date" name="planned_date" type="date" min={batch.start_date} max={batch.end_date} defaultValue={date} required />
        <FieldError name="planned_date" />
      </Field>
      <Field label="Week" htmlFor="pi-week" hint="Leave empty to work it out from the date">
        <Input id="pi-week" name="week" type="number" inputMode="numeric" min={1} max={60} step={1} defaultValue={week ?? ""} />
        <FieldError name="week" />
      </Field>
    </>
  );
}

/** ?item=<id> / ?item=new (and &skip=1) on the Plan tab. */
export async function ItemPanel({
  batch,
  plan,
  itemId,
  skip,
  planHref,
}: {
  batch: Batch;
  plan: BatchPlan;
  itemId: string;
  skip: boolean;
  planHref: string;
}) {
  const itemHref = (id: string) => `${planHref}?item=${id}`;

  /* ---------- new item ---------- */
  if (itemId === "new") {
    const today = todayIST();
    const date = today >= batch.start_date && today <= batch.end_date ? today : batch.start_date;
    return (
      <Drawer
        closeHref={planHref}
        title="Add plan item"
        sub="Goes into the draft until you publish."
        footer={
          <>
            <ButtonLink href={planHref} scroll={false} variant="ghost">
              Cancel
            </ButtonLink>
            <span className="flex-1 max-md:hidden" />
            <SubmitButton form="pi-form">Add to draft</SubmitButton>
          </>
        }
      >
        <ActionForm id="pi-form" action={addPlanItem} closeHref={planHref} className="flex flex-col gap-4">
          <input type="hidden" name="batch_plan_id" value={plan.id} />
          <ItemFields idp="pi">
            <DateWeekFields batch={batch} date={date} week={weekOf(date, batch.start_date)} />
          </ItemFields>
        </ActionForm>
      </Drawer>
    );
  }

  /* ---------- existing item ---------- */
  const missing = (
    <Drawer closeHref={planHref} title="Item not found">
      <EmptyState title="This plan item was not found">It may have been deleted, or the link is incomplete.</EmptyState>
    </Drawer>
  );
  if (!uuid.safeParse(itemId).success) return missing;
  const supabase = await createClient();
  const [itRes, stRes] = await Promise.all([
    supabase.from("batch_plan_items").select("*").eq("id", itemId).eq("batch_plan_id", plan.id).is("deleted_at", null).maybeSingle(),
    supabase.from("v_plan_item_status").select("*").eq("id", itemId).maybeSingle(),
  ]);
  const it = itRes.data as BatchPlanItem | null;
  const st = stRes.data as PlanItemStatusRow | null;
  if (!it) return missing;
  const sub = `${formatDay(it.planned_date)}, ${PLAN_KIND[it.kind].label}`;

  /* ---------- skip with a reason ---------- */
  if (skip && !it.skipped_at) {
    return (
      <Drawer
        closeHref={planHref}
        title="Skip this item"
        sub={it.title}
        footer={
          <>
            <ButtonLink href={itemHref(it.id)} scroll={false} variant="ghost">
              Cancel
            </ButtonLink>
            <span className="flex-1 max-md:hidden" />
            <SubmitButton form="pi-skip">Skip item</SubmitButton>
          </>
        }
      >
        <ActionForm id="pi-skip" action={skipPlanItem} closeHref={itemHref(it.id)} className="flex flex-col gap-4">
          <p className="text-sm text-fg-2">
            Skipping is tracking, not a plan change. Students see the item marked as skipped on the shared plan right away.
          </p>
          <input type="hidden" name="id" value={it.id} />
          <Field label="Reason" htmlFor="pi-reason" required hint="For example: covered together with the next session.">
            <Textarea id="pi-reason" name="skip_reason" rows={3} maxLength={300} required />
            <FieldError name="skip_reason" />
          </Field>
        </ActionForm>
      </Drawer>
    );
  }

  const status = st?.status;
  const notice =
    status === "delivered" ? (
      <Notice tone="success" icon={<Info aria-hidden />}>
        Done on {formatDay(st?.delivered_on)}. Status comes from Live track.
      </Notice>
    ) : status === "late" ? (
      <Notice tone="warn" icon={<Info aria-hidden />}>
        Done on {formatDay(st?.delivered_on)}, {days(Math.max(1, st?.delay_days ?? 1))} late. Status comes from Live track.
      </Notice>
    ) : status === "skipped" ? (
      <Notice tone="warn" icon={<Ban aria-hidden />}>
        Skipped. Reason: {it.skip_reason}
      </Notice>
    ) : status === "overdue" ? (
      <Notice tone="warn" icon={<Info aria-hidden />}>
        The date has passed and nothing is logged yet. Log it in Live track when it is given, or skip it.
      </Notice>
    ) : null;

  const done = status === "delivered" || status === "late";

  return (
    <Drawer
      closeHref={planHref}
      title="Plan item"
      sub={sub}
      footer={
        <>
          <SubmitButton form="pi-del" variant="danger" pendingText="Deleting…">
            <Trash2 aria-hidden />
            Delete
          </SubmitButton>
          <span className="flex-1 max-md:hidden" />
          {it.skipped_at ? (
            <SubmitButton form="pi-unskip" variant="secondary">
              <Undo2 aria-hidden />
              Un-skip
            </SubmitButton>
          ) : !done ? (
            <ButtonLink href={`${itemHref(it.id)}&skip=1`} scroll={false}>
              Skip
            </ButtonLink>
          ) : null}
          <SubmitButton form="pi-form">Save to draft</SubmitButton>
        </>
      }
    >
      {notice}
      <ActionForm key={it.id} id="pi-form" action={updatePlanItem} closeHref={planHref} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={it.id} />
        <ItemFields idp="pi" item={it}>
          <DateWeekFields batch={batch} date={it.planned_date} week={it.week} />
        </ItemFields>
      </ActionForm>
      <ActionForm id="pi-del" action={deletePlanItem} undo={restorePlanItem} closeHref={planHref} className="hidden">
        <input type="hidden" name="id" value={it.id} />
      </ActionForm>
      {it.skipped_at ? (
        <ActionForm id="pi-unskip" action={unskipPlanItem} className="hidden">
          <input type="hidden" name="id" value={it.id} />
        </ActionForm>
      ) : null}
    </Drawer>
  );
}
