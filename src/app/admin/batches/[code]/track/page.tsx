import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { ButtonLink, Card, EmptyState, InfoTip, Pill, Toolbar } from "@/components/ui";
import { Chevron, End, List, ListRow, MainCell, Pager, Wide } from "@/components/list";
import { createClient } from "@/lib/supabase/server";
import { PLAN_KIND } from "@/lib/labels";
import { hrefWith, paging, sp, type SearchParams } from "@/lib/url";
import { formatDay } from "@/lib/utils";
import { KindDot } from "@/app/plan/_lib/plan-ui";
import { batchPath, getBatch } from "@/server/queries/batch";
import { planLink, type EntryRow, type ItemStatus } from "./_parts/data";
import { SessionPanel } from "./_parts/session-panel";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return { title: `Live track ${decodeURIComponent(code)}` };
}

export default async function TrackPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<SearchParams> }) {
  const [{ code: raw }, query] = await Promise.all([params, searchParams]);
  const data = await getBatch(decodeURIComponent(raw));
  if (!data) notFound();
  const b = data.batch;
  const path = batchPath(b.code, "track");
  const pg = paging(query);
  const supabase = await createClient();

  const open = sp(query, "open");
  const isNew = sp(query, "new") === "1";
  const logHref = hrefWith(path, query, { new: 1, open: null, item: null });
  const closeHref = hrefWith(path, query, { new: null, open: null, item: null });

  const [list, fromPlan, statusRes] = await Promise.all([
    supabase
      .from("track_entries")
      .select("id, plan_item_id, held_on, kind, title", { count: "exact" })
      .eq("batch_id", b.id)
      .is("deleted_at", null)
      .order("held_on", { ascending: false })
      .order("created_at", { ascending: false })
      .range(pg.from, pg.to),
    supabase
      .from("track_entries")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", b.id)
      .is("deleted_at", null)
      .not("plan_item_id", "is", null),
    supabase
      .from("v_plan_item_status")
      .select("id, planned_date, kind, title, status, delay_days, delivered_on")
      .eq("batch_id", b.id)
      .order("planned_date")
      .order("seq"),
  ]);
  const entries = (list.data ?? []) as EntryRow[];
  const total = list.count ?? 0;
  const planned = fromPlan.count ?? 0;
  const statuses = (statusRes.data ?? []) as ItemStatus[];
  const byItem = new Map(statuses.map((s) => [s.id, s]));

  const att = new Map<string, { present: number; marked: number }>();
  if (entries.length) {
    const { data: rows } = await supabase
      .from("attendance")
      .select("track_entry_id, mark")
      .in(
        "track_entry_id",
        entries.map((e) => e.id),
      );
    for (const r of (rows ?? []) as { track_entry_id: string; mark: string }[]) {
      const a = att.get(r.track_entry_id) ?? { present: 0, marked: 0 };
      a.marked += 1;
      if (r.mark === "present") a.present += 1;
      att.set(r.track_entry_id, a);
    }
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <Pill>{total} logged</Pill>
          <Pill tone="acc">{planned} from plan</Pill>
          <Pill tone="vio">{total - planned} unplanned</Pill>
          <InfoTip text="What actually happened. Logging from a plan item marks it done; the plan text never changes." />
        </div>
        <span className="flex-1" />
        <ButtonLink variant="primary" href={logHref} scroll={false} className="max-md:w-full">
          <Plus aria-hidden />
          Log session
        </ButtonLink>
      </Toolbar>

      <Card>
        {total === 0 ? (
          <EmptyState
            title="Nothing logged yet"
            action={
              <ButtonLink variant="primary" href={logHref} scroll={false}>
                <Plus aria-hidden />
                Log session
              </ButtonLink>
            }
          >
            After each class, log what was given and who was there. It takes a minute from your phone.
          </EmptyState>
        ) : (
          <>
            <List
              cols="110px minmax(0,2fr) 190px 90px 20px"
              head={[["Date", "wide"], ["What happened"], ["Plan link", "wide"], ["Present", "wide-right"], ["", "wide"]]}
            >
              {entries.map((e, i) => {
                const link = planLink(e, e.plan_item_id ? byItem.get(e.plan_item_id) : undefined);
                const a = att.get(e.id);
                return (
                  <ListRow key={e.id} href={hrefWith(path, query, { open: e.id, new: null, item: null })} i={i} selected={open === e.id}>
                    <Wide className="font-semibold">{formatDay(e.held_on)}</Wide>
                    <MainCell
                      icon={<KindDot kind={e.kind} />}
                      title={e.title}
                      sub={PLAN_KIND[e.kind].label}
                      narrow={formatDay(e.held_on)}
                    />
                    <Wide>
                      <Pill tone={link.tone}>{link.label}</Pill>
                    </Wide>
                    <End>
                      {a ? (
                        <span className="text-sm font-semibold">
                          {a.present} / {a.marked}
                          <span className="sr-only"> present</span>
                        </span>
                      ) : (
                        <span className="text-sm text-fg-3">—</span>
                      )}
                    </End>
                    <Chevron />
                  </ListRow>
                );
              })}
            </List>
            <Pager path={path} params={query} total={total} page={pg.page} show={pg.show} />
          </>
        )}
      </Card>

      {isNew || open ? (
        <SessionPanel
          batchId={b.id}
          entryId={isNew ? undefined : open}
          itemId={isNew ? sp(query, "item") : undefined}
          statuses={statuses}
          closeHref={closeHref}
        />
      ) : null}
    </div>
  );
}
