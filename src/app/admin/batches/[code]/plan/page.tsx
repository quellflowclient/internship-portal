import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Eye, PenLine, Plus, Printer } from "lucide-react";
import { ActionForm, CopyButton, FieldError, SubmitButton } from "@/components/toast";
import { Bar, Button, Card, CardHeader, EmptyState, Field, IconAnchor, IconLink, Input, Notice, Pill } from "@/components/ui";
import { WhatsAppIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { formatDate, formatDay, cn } from "@/lib/utils";
import { sp, type SearchParams } from "@/lib/url";
import type { BatchPlanVersion, PlanItemStatusRow } from "@/lib/types";
import { batchPath, getBatch } from "@/server/queries/batch";
import { publishPlan } from "@/server/actions/plan";
import { groupByWeek } from "@/app/plan/_lib/plan";
import { DoneMark, KindDot, KindLegend, PLAN_ROW, WeekCard } from "@/app/plan/_lib/plan-ui";
import { ItemPanel } from "./_parts/item-panel";
import { ShareToggle } from "./_parts/share-toggle";

export const metadata: Metadata = { title: "Batch plan" };

const PLAN_INFO = "The plan is a reference. Logging a session in Live track never changes the plan text; it only marks items done.";

async function siteOrigin() {
  const env = publicEnv().NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

function StatusEnd({ it }: { it: PlanItemStatusRow }) {
  switch (it.status) {
    case "delivered":
      return <DoneMark tip={`Done on ${formatDay(it.delivered_on)}`} />;
    case "late":
      return <Pill tone="warn">+{days(Math.max(1, it.delay_days ?? 1))}</Pill>;
    case "overdue":
      return <Pill tone="warn">Overdue</Pill>;
    case "skipped":
      return <Pill tone="bad">Skipped</Pill>;
    default:
      return null;
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-fg-2">{label}</span>
      {children}
    </div>
  );
}

export default async function BatchPlanPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<SearchParams> }) {
  const [{ code: raw }, query] = await Promise.all([params, searchParams]);
  const code = decodeURIComponent(raw);
  const data = await getBatch(code);
  if (!data) notFound();
  const { batch, plan, progress } = data;
  const planHref = batchPath(batch.code, "plan");

  if (!plan) {
    return (
      <Card className="mt-1">
        <EmptyState title="This batch has no plan record">Plans are created with the batch. Ask an owner to check the batch setup.</EmptyState>
      </Card>
    );
  }

  const supabase = await createClient();
  const [itemsRes, verRes] = await Promise.all([
    supabase.from("v_plan_item_status").select("*").eq("batch_plan_id", plan.id).order("planned_date").order("seq"),
    plan.published_version > 0
      ? supabase
          .from("batch_plan_versions")
          .select("version, published_at, change_note")
          .eq("batch_plan_id", plan.id)
          .eq("version", plan.published_version)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const items = (itemsRes.data ?? []) as PlanItemStatusRow[];
  const live = verRes.data as Pick<BatchPlanVersion, "version" | "published_at" | "change_note"> | null;
  const weeks = groupByWeek(items, (i) => i.planned_date);

  const done = progress?.done ?? items.filter((i) => i.status === "delivered" || i.status === "late").length;
  const planned = progress?.planned ?? items.length;
  const behind = progress?.days_behind ?? 0;
  const late = items.filter((i) => i.status === "late").length;
  const nextId = progress?.next_item_id ?? null;

  const origin = await siteOrigin();
  const shareUrl = `${origin}/plan/${plan.share_token}`;
  const course = batch.course_plans.courses.name;
  const waText = `${course} plan for batch ${batch.code}: ${shareUrl}`;
  const nextVersion = plan.published_version + 1;
  const canPublish = plan.published_version === 0 || plan.has_unpublished_changes;

  const itemParam = sp(query, "item");

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:gap-5">
        {/* ---------- plan ---------- */}
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="flex items-center justify-between gap-3">
            <KindLegend />
            <IconLink href={`${planHref}?item=new`} scroll={false} label="Add plan item" outline>
              <Plus aria-hidden />
            </IconLink>
          </div>
          {weeks.length ? (
            weeks.map((w) => (
              <WeekCard key={w.week} week={w.week} range={w.range}>
                {w.items.map((it) => (
                  <Link
                    key={it.id}
                    href={`${planHref}?item=${it.id}`}
                    scroll={false}
                    aria-current={itemParam === it.id ? "true" : undefined}
                    className={cn(
                      PLAN_ROW,
                      "text-fg no-underline transition-colors last:rounded-b-xl hover:bg-hover focus-visible:outline-offset-[-2px]",
                      it.id === nextId && "bg-accent-soft hover:bg-accent-soft",
                    )}
                  >
                    <span className="text-xs font-medium text-fg-3 md:text-sm">{formatDay(it.planned_date)}</span>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <KindDot kind={it.kind} />
                      <b className="min-w-0 truncate font-semibold">{it.title}</b>
                      {it.id === nextId ? <span className="sr-only">(next item)</span> : null}
                    </span>
                    <span className="flex items-center justify-self-end">
                      <StatusEnd it={it} />
                    </span>
                  </Link>
                ))}
              </WeekCard>
            ))
          ) : (
            <Card>
              <EmptyState
                title="The plan has no items yet"
                action={
                  <Link href={`${planHref}?item=new`} scroll={false} className="text-sm font-semibold text-accent-ink">
                    Add plan item
                  </Link>
                }
              >
                Add the first item or create the batch from a course plan that has a template.
              </EmptyState>
            </Card>
          )}
        </div>

        {/* ---------- side ---------- */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title="Progress" info={PLAN_INFO} />
            <div className="flex flex-col gap-2.5 p-4">
              <Row label="Done">
                <b>
                  {done} of {planned}
                </b>
              </Row>
              <Bar pct={planned ? (done / planned) * 100 : 0} label={`${done} of ${planned} done`} />
              <Row label="Schedule">
                {behind > 0 ? <b className="text-warn">{days(behind)} behind</b> : <b className="text-ok">On track</b>}
              </Row>
              <Row label="Late, skipped, unplanned">
                <b>
                  {late}, {progress?.skipped ?? 0}, {progress?.unplanned ?? 0}
                </b>
              </Row>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Share with students"
              info="Students see the published version through one fixed link. Turn the link off to hide the page."
              actions={
                plan.published_version > 0 ? (
                  <Pill tone="ok" dot>
                    Version {plan.published_version} live
                  </Pill>
                ) : (
                  <Pill tone="warn" dot>
                    Not published yet
                  </Pill>
                )
              }
            />
            <div className="flex flex-col gap-3 p-4">
              {plan.has_unpublished_changes && plan.published_version > 0 ? (
                <Notice tone="warn" icon={<PenLine aria-hidden />}>
                  The draft has changes students cannot see yet.
                </Notice>
              ) : null}
              {live ? (
                <p className="text-xs text-fg-3">
                  Version {live.version} published {formatDate(live.published_at)}
                  {live.change_note ? `: ${live.change_note}` : ""}
                </p>
              ) : null}

              <ActionForm key={plan.published_version} action={publishPlan} className="flex flex-col gap-3">
                <input type="hidden" name="batch_id" value={batch.id} />
                <Field label="Change note shown to students" htmlFor="pl-note" hint="Optional. For example: Quiz 2 moved to Friday.">
                  <Input id="pl-note" name="change_note" maxLength={200} disabled={!canPublish} />
                  <FieldError name="change_note" />
                </Field>
                {canPublish ? (
                  <SubmitButton pendingText="Publishing…" className="w-full">
                    Publish version {nextVersion}
                  </SubmitButton>
                ) : (
                  <>
                    <Button type="button" disabled className="w-full">
                      Publish version {nextVersion}
                    </Button>
                    <p className="text-xs text-fg-3">Nothing has changed since version {plan.published_version}.</p>
                  </>
                )}
              </ActionForm>

              <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 py-1 pr-1 pl-2.5">
                <code className="min-w-0 flex-1 font-mono text-xs font-medium break-all text-fg">{shareUrl}</code>
                <CopyButton text={shareUrl} label="Copy the share link" small />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <IconAnchor href={`https://wa.me/?text=${encodeURIComponent(waText)}`} label="Share the link on WhatsApp" outline className="text-wa">
                  <WhatsAppIcon />
                </IconAnchor>
                <IconAnchor href={shareUrl} label="Open the shared page" outline>
                  <Eye aria-hidden />
                </IconAnchor>
                <IconAnchor href={`${shareUrl}?print=1`} label="Print or save as PDF" outline>
                  <Printer aria-hidden />
                </IconAnchor>
              </div>
              {plan.published_version === 0 ? (
                <p className="text-xs text-fg-3">The link shows a “not active” page until the first version is published.</p>
              ) : null}
              <div className="flex flex-col gap-2.5 border-t border-line pt-3">
                <ShareToggle planId={plan.id} field="share_enabled" checked={plan.share_enabled} label="Link is active" />
                <ShareToggle planId={plan.id} field="show_done_marks" checked={plan.show_done_marks} label="Show done marks" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {itemParam ? <ItemPanel batch={batch} plan={plan} itemId={itemParam} skip={sp(query, "skip") === "1"} planHref={planHref} /> : null}
    </>
  );
}
