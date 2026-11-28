/** One batch as a card on the Batches list (Running and Planned). The whole card opens the batch. */
import type { ReactNode } from "react";
import Link from "next/link";
import { Bar, Pill } from "@/components/ui";
import { BATCH_STATUS, scheduleLabel, TYPE } from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";
import type { BatchPlan, BatchProgress, BatchStatus, StudentType } from "@/lib/types";
import { plural, type TypeMix } from "./shared";

export interface CardBatch {
  id: string;
  code: string;
  status: BatchStatus;
  start_date: string;
  end_date: string;
  schedule_days: number[];
  session_time: string | null;
  capacity: number;
  title: string;
}

const MIX: { t: StudentType; fill: string }[] = [
  { t: "paid", fill: "bg-accent" },
  { t: "free", fill: "bg-line-strong" },
  { t: "stipend", fill: "bg-vio" },
];

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="flex items-center justify-between gap-3 text-sm">
      <span className="text-fg-2">{label}</span>
      <b className="font-semibold">{value}</b>
    </span>
  );
}

function planState(plan: Pick<BatchPlan, "published_version" | "has_unpublished_changes"> | null) {
  if (!plan || plan.published_version === 0) return <Pill tone="warn">Plan in draft</Pill>;
  if (plan.has_unpublished_changes) return <Pill tone="warn">Changes not published</Pill>;
  return <Pill tone="ok">Version {plan.published_version} live</Pill>;
}

export function BatchCard({
  b,
  progress,
  plan,
  mix,
}: {
  b: CardBatch;
  progress: BatchProgress | null;
  plan: Pick<BatchPlan, "published_version" | "has_unpublished_changes"> | null;
  mix: TypeMix;
}) {
  const st = BATCH_STATUS[b.status];
  const students = mix.paid + mix.free + mix.stipend;
  const done = progress?.done ?? 0;
  const planned = progress?.planned ?? 0;
  const behind = (progress?.days_behind ?? 0) > 0;
  const running = b.status === "running";

  return (
    <Link
      href={`/admin/batches/${encodeURIComponent(b.code)}`}
      className="flex min-w-0 flex-col gap-3.5 rounded-xl border border-line bg-surface p-4 text-fg no-underline transition-colors hover:border-accent"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-fg-3">{b.code}</span>
        <Pill tone={st.tone} dot>
          {st.label}
        </Pill>
      </span>
      <span className="min-w-0">
        <h3 className="text-md font-semibold break-words">{b.title}</h3>
        <span className="mt-0.5 block text-xs text-fg-3">
          {formatDate(b.start_date)} to {formatDate(b.end_date)}
        </span>
        <span className="block text-xs text-fg-3">
          {scheduleLabel(b.schedule_days)}
          {b.session_time ? `, ${b.session_time}` : ""}
        </span>
      </span>

      {running ? (
        <span className="flex flex-col gap-1.5">
          <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-sm">
            <span className="text-fg-2">Plan done</span>
            <span className="flex items-center gap-2">
              {behind ? (
                <Pill tone="warn" dot>
                  {plural(progress?.days_behind ?? 0, "day")} behind
                </Pill>
              ) : (
                <Pill tone="ok" dot>
                  On track
                </Pill>
              )}
              <b className="font-semibold">
                {done} of {planned}
              </b>
            </span>
          </span>
          <Bar pct={planned > 0 ? (done / planned) * 100 : 0} tone={behind ? "warn" : "acc"} label={`${done} of ${planned} planned items done`} />
        </span>
      ) : (
        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-sm">
          <span className="text-fg-2">Plan</span>
          <span className="flex items-center gap-2">
            {planState(plan)}
            <b className="font-semibold">{plural(planned, "item")}</b>
          </span>
        </span>
      )}

      <span className="flex flex-col gap-1.5">
        <Row label={running ? "Students" : "Assigned"} value={`${students} of ${b.capacity}`} />
        <span className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={MIX.map(({ t }) => `${TYPE[t].label} ${mix[t]}`).join(", ")}>
          {MIX.map(({ t, fill }) => (mix[t] > 0 ? <span key={t} className={cn("block h-full", fill)} style={{ flexGrow: mix[t] }} /> : null))}
        </span>
        <span className="flex flex-wrap gap-x-3.5 gap-y-0.5 text-xs text-fg-3" aria-hidden>
          {MIX.map(({ t, fill }) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-sm", fill)} />
              {TYPE[t].label} {mix[t]}
            </span>
          ))}
        </span>
      </span>
    </Link>
  );
}
