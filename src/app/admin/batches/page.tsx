import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { ButtonLink, Card, EmptyState, PageHeader, Pill, Segmented, Toolbar } from "@/components/ui";
import { Chevron, End, List, ListRow, MainCell, Pager, Wide } from "@/components/list";
import { createClient } from "@/lib/supabase/server";
import { BATCH_STATUS } from "@/lib/labels";
import { filterHref, hrefWith, paging, sp, type SearchParams } from "@/lib/url";
import { formatDate } from "@/lib/utils";
import type { BatchPlan, BatchProgress, BatchStatus, StudentType } from "@/lib/types";
import { BatchCard, type CardBatch } from "./_parts/batch-card";
import { NewBatchPanel } from "./_parts/new-batch";
import { BATCHES_PATH, emptyMix, type TypeMix } from "./_parts/shared";

export const metadata: Metadata = { title: "Batches" };

type Tab = "running" | "planned" | "closed";
const TABS: { key: Tab; label: string; statuses: BatchStatus[] }[] = [
  { key: "running", label: "Running", statuses: ["running"] },
  { key: "planned", label: "Planned", statuses: ["planned"] },
  { key: "closed", label: "Closed", statuses: ["completed", "cancelled"] },
];

type BatchListRow = {
  id: string;
  code: string;
  status: BatchStatus;
  start_date: string;
  end_date: string;
  schedule_days: number[];
  session_time: string | null;
  capacity: number;
  course_plans: { duration_days: number; courses: { name: string } | null } | null;
};

type PlanState = Pick<BatchPlan, "batch_id" | "published_version" | "has_unpublished_changes">;

const SELECT = "id, code, status, start_date, end_date, schedule_days, session_time, capacity, course_plans(duration_days, courses(name))";
const titleOf = (b: BatchListRow) => `${b.course_plans?.courses?.name ?? "Course"}, ${b.course_plans?.duration_days ?? "?"} days`;

const EMPTY: Record<Tab, { title: string; body: string }> = {
  running: { title: "No batch is running", body: "A planned batch starts running on its start date." },
  planned: { title: "No planned batches", body: "Create a batch from a course plan. Its plan is copied from the course template." },
  closed: { title: "No closed batches yet", body: "Completed and cancelled batches show here." },
};

export default async function BatchesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const tab = TABS.find((t) => t.key === sp(params, "status")) ?? TABS[0];
  const isNew = sp(params, "new") === "1";
  const pg = paging(params);
  const closed = tab.key === "closed";

  const countOf = (statuses: BatchStatus[]) => supabase.from("batches").select("id", { count: "exact", head: true }).in("status", statuses);
  const base = supabase.from("batches").select(SELECT, { count: "exact" }).in("status", tab.statuses);
  const list = closed ? base.order("end_date", { ascending: false }).order("code").range(pg.from, pg.to) : base.order("start_date").order("code");

  const [listRes, ...countRes] = await Promise.all([list, ...TABS.map((t) => countOf(t.statuses))]);
  const rows = (listRes.data ?? []) as unknown as BatchListRow[];
  const counts = Object.fromEntries(TABS.map((t, i) => [t.key, countRes[i].count ?? 0])) as Record<Tab, number>;
  const ids = rows.map((r) => r.id);

  const none = Promise.resolve({ data: [] as unknown[] });
  const [progressRes, plansRes, enrolRes] = await Promise.all([
    ids.length && !closed ? supabase.from("v_batch_progress").select("*").in("batch_id", ids) : none,
    ids.length && tab.key === "planned"
      ? supabase.from("batch_plans").select("batch_id, published_version, has_unpublished_changes").in("batch_id", ids)
      : none,
    ids.length
      ? supabase
          .from("enrollments")
          .select("batch_id, type, status")
          .in("batch_id", ids)
          .in("status", closed ? ["completed", "not_completed"] : ["assigned", "active"])
      : none,
  ]);

  const progress = new Map(((progressRes.data ?? []) as BatchProgress[]).map((p) => [p.batch_id, p]));
  const plans = new Map(((plansRes.data ?? []) as PlanState[]).map((p) => [p.batch_id, p]));
  const mixes = new Map<string, TypeMix>();
  const finished = new Map<string, { completed: number; total: number }>();
  for (const e of (enrolRes.data ?? []) as { batch_id: string; type: StudentType; status: string }[]) {
    const m = mixes.get(e.batch_id) ?? emptyMix();
    m[e.type] += 1;
    mixes.set(e.batch_id, m);
    const f = finished.get(e.batch_id) ?? { completed: 0, total: 0 };
    f.total += 1;
    if (e.status === "completed") f.completed += 1;
    finished.set(e.batch_id, f);
  }

  const newHref = hrefWith(BATCHES_PATH, params, { new: 1 });
  const newButton = (variant: "primary" | "secondary") => (
    <ButtonLink variant={variant} href={newHref} scroll={false}>
      <Plus aria-hidden />
      New batch
    </ButtonLink>
  );
  const empty = EMPTY[tab.key];

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title="Batches"
        info="A new batch copies its plan from the course template. Students are assigned from Student 360."
        description="Plans and sessions live inside each batch."
        actions={newButton("primary")}
      />

      <Toolbar>
        <Segmented
          label="Batch status"
          items={TABS.map((t) => ({
            href: filterHref(BATCHES_PATH, params, { status: t.key === "running" ? null : t.key }),
            label: `${t.label} ${counts[t.key]}`,
            active: t.key === tab.key,
          }))}
        />
      </Toolbar>

      {closed ? (
        <Card>
          {rows.length ? (
            <>
              <List
                cols="minmax(0,2fr) 230px 110px 120px 20px"
                head={[["Batch"], ["Dates", "wide"], ["Completed", "wide-right"], ["Status"], ["", "wide"]]}
              >
                {rows.map((b, i) => {
                  const st = BATCH_STATUS[b.status];
                  const f = finished.get(b.id);
                  return (
                    <ListRow key={b.id} href={`${BATCHES_PATH}/${encodeURIComponent(b.code)}`} i={i}>
                      <MainCell title={titleOf(b)} sub={b.code} narrow={`ended ${formatDate(b.end_date)}`} />
                      <Wide className="text-fg-2">
                        {formatDate(b.start_date)} to {formatDate(b.end_date)}
                      </Wide>
                      <Wide right className="font-semibold">
                        {f ? `${f.completed} of ${f.total}` : "—"}
                      </Wide>
                      <End>
                        <Pill tone={st.tone} dot>
                          {st.label}
                        </Pill>
                      </End>
                      <Chevron />
                    </ListRow>
                  );
                })}
              </List>
              <Pager path={BATCHES_PATH} params={params} total={listRes.count ?? 0} page={pg.page} show={pg.show} />
            </>
          ) : (
            <EmptyState title={empty.title}>{empty.body}</EmptyState>
          )}
        </Card>
      ) : rows.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 md:gap-4">
          {rows.map((b) => {
            const card: CardBatch = { ...b, title: titleOf(b) };
            return (
              <BatchCard key={b.id} b={card} progress={progress.get(b.id) ?? null} plan={plans.get(b.id) ?? null} mix={mixes.get(b.id) ?? emptyMix()} />
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState title={empty.title} action={newButton("secondary")}>
            {empty.body}
          </EmptyState>
        </Card>
      )}

      {isNew ? <NewBatchPanel closeHref={hrefWith(BATCHES_PATH, params, { new: null })} /> : null}
    </div>
  );
}
