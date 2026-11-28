/**
 * Student → My plan (docs/18 §6, docs/19 §10). The latest PUBLISHED version of the student's batch plan,
 * read through get_my_plan(enrollment): done / skipped marks and the student's own attendance per item.
 * Shows 10 rows around today; "Show earlier" and "View more" widen the window (?from=&show=).
 */
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { Card, ChipLink, EmptyState, Notice, PageHeader, Pill, Segmented } from "@/components/ui";
import { DoneMark, KindLegend, PLAN_ROW, PlanDate, PlanTitle, WeekCard } from "@/components/plan";
import { requireRole } from "@/lib/auth/session";
import { ATTENDANCE_LABEL } from "@/lib/labels";
import { groupByWeek, safeHref } from "@/lib/plan";
import { hrefWith, PAGE_SIZE, sp, type SearchParams } from "@/lib/url";
import { cn, formatDate, todayIST } from "@/lib/utils";
import type { AttendanceMark, Tone } from "@/lib/types";
import { getMyEnrollments, getMyPlan, type MyPlanItem } from "../_parts/data";

export const metadata: Metadata = { title: "My plan" };

const ATT_TONE: Record<AttendanceMark, Tone> = { present: "ok", absent: "bad", leave: "mute" };
const PATH = "/student/plan";

function Status({ it, today }: { it: MyPlanItem; today: string }) {
  return (
    <span className="flex items-center gap-1.5 justify-self-end">
      {it.attendance ? (
        <Pill tone={ATT_TONE[it.attendance]}>
          <span className="sr-only">Your attendance: </span>
          {ATTENDANCE_LABEL[it.attendance]}
        </Pill>
      ) : null}
      {it.skipped ? <Pill tone="bad">Skipped</Pill> : it.done ? <DoneMark tip="Done" /> : it.date === today ? <Pill tone="acc">Today</Pill> : null}
    </span>
  );
}

export default async function StudentPlanPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["student"]);
  const params = await searchParams;
  const rows = await getMyEnrollments();

  if (!rows.length) {
    return (
      <>
        <PageHeader title="My plan" />
        <Card>
          <EmptyState title="You are not in a batch yet">Your batch plan appears here after the team adds you to a batch.</EmptyState>
        </Card>
      </>
    );
  }

  const wanted = sp(params, "e");
  const current = rows.find((r) => r.enrollment_id === wanted) ?? rows.find((r) => r.status === "active" || r.status === "assigned") ?? rows[0];
  const plan = await getMyPlan(current.enrollment_id);
  const today = todayIST();
  const items = plan?.items ?? [];

  // Window of rows: by default from two rows before today's (or the next) item, 10 rows long.
  const upcoming = items.findIndex((i) => i.date >= today);
  const anchor = upcoming === -1 ? Math.max(0, items.length - PAGE_SIZE) : Math.max(0, upcoming - 2);
  const fromParam = Number(sp(params, "from"));
  const from = Number.isInteger(fromParam) && fromParam >= 0 ? Math.min(fromParam, Math.max(0, items.length - 1)) : anchor;
  const show = Math.min(Math.max(Number(sp(params, "show")) || PAGE_SIZE, 1), 500);
  const to = Math.min(items.length, from + show); // exclusive
  const indexed = items.map((it, idx) => ({ ...it, idx }));
  const weeks = groupByWeek(indexed, (i) => i.date)
    .map((w) => ({ ...w, items: w.items.filter((i) => i.idx >= from && i.idx < to) }))
    .filter((w) => w.items.length);
  const earlierFrom = Math.max(0, from - PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="My plan"
        info="This is the plan your trainer published. A tick means it has been done. Your own attendance shows next to each session once it is marked."
        description={
          plan?.version ? `${plan.course}, batch ${plan.batch}. Version ${plan.version}, updated ${formatDate(plan.published_at)}` : `${current.course_name}, batch ${current.batch_code}`
        }
      />

      {rows.length > 1 ? (
        <Segmented
          label="Choose a batch"
          items={rows.map((r) => ({ href: `${PATH}?e=${r.enrollment_id}`, label: r.batch_code, active: r.enrollment_id === current.enrollment_id }))}
        />
      ) : null}

      {!plan?.version ? (
        <Card>
          <EmptyState title="No plan published yet">Your trainer has not published the plan for this batch yet. Check back soon.</EmptyState>
        </Card>
      ) : (
        <>
          {plan.change_note ? (
            <Notice tone="warn">
              <b>Update:</b> {plan.change_note}
            </Notice>
          ) : null}
          <KindLegend />

          {from > 0 ? (
            <div className="flex justify-center">
              <ChipLink href={hrefWith(PATH, params, { from: earlierFrom, show: to - earlierFrom })}>Show earlier ({from})</ChipLink>
            </div>
          ) : null}

          {weeks.length ? (
            weeks.map((w) => (
              <WeekCard key={w.week} week={w.week} range={w.range}>
                {w.items.map((it) => {
                  const isToday = it.date === today;
                  const links = (it.resources ?? []).map((r) => ({ ...r, href: safeHref(r.url) })).filter((r) => r.href);
                  return (
                    <div
                      key={it.seq}
                      aria-current={isToday ? "date" : undefined}
                      className={cn(PLAN_ROW, isToday && "bg-accent-soft", it.skipped && "text-fg-3")}
                    >
                      <PlanDate date={it.date} />
                      <span className="flex min-w-0 flex-col gap-1">
                        <PlanTitle kind={it.kind} title={it.title} />
                        {links.length ? (
                          <span className="flex flex-wrap gap-x-3 pl-[18px]">
                            {links.map((r) => (
                              <a
                                key={r.href}
                                href={r.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-accent-ink no-underline hover:underline md:min-h-0"
                              >
                                {r.label}
                                <ExternalLink className="size-3" aria-hidden />
                              </a>
                            ))}
                          </span>
                        ) : null}
                      </span>
                      <Status it={it} today={today} />
                    </div>
                  );
                })}
              </WeekCard>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-fg-3">The plan has no items yet.</p>
          )}

          {to < items.length ? (
            <div className="flex justify-center">
              <ChipLink href={hrefWith(PATH, params, { from, show: to - from + PAGE_SIZE })}>View more ({items.length - to} left)</ChipLink>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
