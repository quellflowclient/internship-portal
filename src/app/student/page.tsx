/**
 * Student → Home (docs/18 §6, docs/19 §10). Greeting, "To do" (documents to sign) and one card per enrolment:
 * course, batch, dates, timing, today's or next plan item, attendance and the batch links.
 * Never shows fees, stipend amounts or the student type (D-04).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CircleCheck, PenLine } from "lucide-react";
import { Card, CardHeader, DL, EmptyState, InfoTip, Kpi, Meta, PageHeader, Pill } from "@/components/ui";
import { KindDot } from "@/components/plan";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { ACCEPT_DOC_TYPES, DOC_TYPE_LABEL, ENROLLMENT_STATUS, PLAN_KIND } from "@/lib/labels";
import { cn, formatDate, formatDay, todayIST } from "@/lib/utils";
import type { DocType } from "@/lib/types";
import { getMyEnrollments, getMyPlan, nextItem, type MyEnrollment, type MyPlan } from "./_parts/data";
import { BatchLinks } from "./_parts/batch-links";

export const metadata: Metadata = { title: "Home" };

type ToSign = { id: string; type: DocType; version: number; issued_at: string | null };

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

/** "Day 9 of 30", "Starts 01 Dec 2026", or null after the end. */
function dayOf(e: MyEnrollment, today: string): string | null {
  const n = dayDiff(e.end_date, e.start_date) + 1;
  const x = dayDiff(today, e.start_date) + 1;
  if (x < 1) return `Starts ${formatDate(e.start_date)}`;
  return x > n ? null : `Day ${x} of ${n}`;
}

function NextUp({ e, plan, today, planHref }: { e: MyEnrollment; plan: MyPlan | null; today: string; planHref: string }) {
  if (!plan?.version) return <p className="text-sm text-fg-3">The plan appears here when your trainer publishes it.</p>;
  const next = nextItem(plan.items, today);
  if (!next) return <p className="text-sm text-fg-3">No more plan items in this batch.</p>;
  const isToday = next.date === today;
  return (
    <Link
      href={planHref}
      className={cn(
        "flex items-center gap-3 rounded-[10px] border px-3.5 py-3 text-fg no-underline transition-colors hover:border-accent",
        isToday ? "border-accent bg-accent-soft" : "border-line bg-surface-2",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <Pill tone={isToday ? "acc" : "mute"}>{isToday ? "Today" : "Next"}</Pill>
          <span className="inline-flex items-center gap-1.5 text-xs text-fg-2">
            <KindDot kind={next.kind} />
            {PLAN_KIND[next.kind].label}
          </span>
        </span>
        <b className="text-md leading-snug font-semibold break-words">{next.title}</b>
        <span className="text-xs text-fg-2">
          <Meta items={[isToday ? "Today" : formatDay(next.date), e.session_time ? `${e.session_time} IST` : null]} />
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-fg-3" aria-hidden />
    </Link>
  );
}

export default async function StudentHome() {
  const { profile } = await requireRole(["student"]);
  const supabase = await createClient();
  const today = todayIST();
  const [rows, docsRes] = await Promise.all([
    getMyEnrollments(),
    // RLS: only the student's own non-draft documents.
    supabase.from("documents").select("id, type, version, issued_at").eq("status", "issued").in("type", ACCEPT_DOC_TYPES).order("issued_at"),
  ]);
  const plans = await Promise.all(rows.map((r) => getMyPlan(r.enrollment_id)));
  const toSign = (docsRes.data ?? []) as ToSign[];
  const first = rows.find((r) => r.status === "active" || r.status === "assigned") ?? rows[0];
  const firstName = profile.full_name?.trim().split(/\s+/)[0] || "there";

  return (
    <>
      <PageHeader
        title={`Hi ${firstName}`}
        description={first ? <Meta items={[`${first.course_name}, ${first.duration_days} days`, dayOf(first, today)]} /> : "Your batch, plan and documents appear here."}
      />

      <Card>
        <CardHeader title="To do" info="Documents waiting for you. You sign them in the portal by typing your name." />
        {toSign.length ? (
          <ul>
            {toSign.map((d) => (
              <li key={d.id} className="border-t border-line first:border-t-0">
                <Link href={`/student/documents/${d.id}`} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 text-fg no-underline hover:bg-hover">
                  <span className="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-warn-soft text-warn [&_svg]:size-[17px]">
                    <PenLine aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="text-sm break-words">
                      Sign {DOC_TYPE_LABEL[d.type]}
                      {d.version > 1 ? ` v${d.version}` : ""}
                    </b>
                    <small className="text-xs text-fg-2">Sent {formatDate(d.issued_at)}, takes 2 minutes</small>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-fg-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-3 px-4 py-2 text-sm text-fg-2">
            <CircleCheck className="size-[18px] shrink-0 text-ok" aria-hidden />
            <span className="min-w-0 flex-1">Nothing to sign right now.</span>
            <Link href="/student/documents" className="inline-flex min-h-11 items-center font-semibold text-accent-ink no-underline">
              Documents
            </Link>
          </div>
        )}
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState title="You are not in a batch yet">The Quellflow team will add you to a batch. You will see its plan and links here.</EmptyState>
        </Card>
      ) : (
        rows.map((r, i) => {
          const plan = plans[i];
          const items = plan?.items ?? [];
          const doneCount = items.filter((it) => it.done).length;
          const planHref = rows.length > 1 ? `/student/plan?e=${r.enrollment_id}` : "/student/plan";
          return (
            <Card key={r.enrollment_id} aria-label={`${r.course_name}, batch ${r.batch_code}`}>
              <CardHeader
                title={`${r.course_name}, ${r.duration_days} days`}
                actions={
                  <Pill tone={ENROLLMENT_STATUS[r.status].tone} dot>
                    {ENROLLMENT_STATUS[r.status].label}
                  </Pill>
                }
              />
              <div className="flex flex-col gap-4 p-4">
                <NextUp e={r} plan={plan} today={today} planHref={planHref} />
                <DL
                  items={[
                    ["Batch", r.batch_code],
                    ["Dates", `${formatDate(r.start_date)} to ${formatDate(r.end_date)}`],
                    ["Timing", r.session_time ? `${r.session_time} IST` : "Shared in the WhatsApp group"],
                  ]}
                />
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <Kpi
                    label="Attendance"
                    value={r.attendance_pct != null ? `${r.attendance_pct}%` : "—"}
                    sub={r.attendance_pct != null ? "of marked sessions" : "Not marked yet"}
                  />
                  <Kpi label="Tasks" value={r.tasks_pct != null ? `${r.tasks_pct}%` : "—"} sub={r.tasks_pct != null ? "submitted" : "None given yet"} />
                  {plan?.version ? <Kpi label="Plan" value={`${doneCount} of ${items.length}`} sub="items done" href={planHref} /> : null}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1">
                    <h3 className="text-xs font-semibold text-fg-2">Batch links</h3>
                    <InfoTip text="Your batch uses these free tools. Tap an icon to open it." />
                  </div>
                  <BatchLinks e={r} />
                </div>
              </div>
            </Card>
          );
        })
      )}
    </>
  );
}
