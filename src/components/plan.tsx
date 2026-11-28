/** Small plan building blocks shared by the admin Plan tab and the public share page (server-safe, no hooks). */
import * as React from "react";
import { Check } from "lucide-react";
import { PLAN_KIND, PLAN_KINDS } from "@/lib/labels";
import { cn, formatDay, formatDayShort } from "@/lib/utils";
import type { PlanKind } from "@/lib/types";

/** The kind's colour square. Always shown next to the kind's text or the item title. */
export function KindDot({ kind }: { kind: PlanKind }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-[2px] print:[print-color-adjust:exact]", PLAN_KIND[kind].dot)} />;
}

export function KindLegend({ className }: { className?: string }) {
  return (
    <ul aria-label="Kinds of plan items" className={cn("flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-2", className)}>
      {PLAN_KINDS.map((k) => (
        <li key={k} className="inline-flex items-center gap-1.5">
          <KindDot kind={k} />
          {PLAN_KIND[k].label}
        </li>
      ))}
    </ul>
  );
}

/** One week of the plan: a card with "Week N" and its date range. */
export function WeekCard({ week, range, children }: { week: number; range: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-line bg-surface print:break-inside-avoid print:border-fg-3 print:bg-transparent">
      <h3 className="flex items-center justify-between gap-2 rounded-t-xl border-b border-line bg-surface-2 px-4 py-2.5 text-sm font-semibold print:bg-transparent">
        <span>Week {week}</span>
        <span className="text-xs font-medium text-fg-3">{range}</span>
      </h3>
      {children}
    </section>
  );
}

/** One plan row: date, kind square + title (up to two lines), status at the end. */
export const PLAN_ROW =
  "grid min-h-12 grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-3.5 py-2.5 text-sm last:border-b-0 md:grid-cols-[92px_minmax(0,1fr)_auto] md:px-4";

/** The row's date on one line: "Tue 8" on phones (the month is in the week heading), "Tue 8 Dec" from tablet up. */
export function PlanDate({ date }: { date: string }) {
  return (
    <span className="text-xs font-medium whitespace-nowrap text-fg-3 md:text-sm">
      <span className="md:hidden">{formatDayShort(date)}</span>
      <span className="hidden md:inline">{formatDay(date)}</span>
    </span>
  );
}

/** Kind square + title. The title wraps to two lines and is never cut to a few letters. */
export function PlanTitle({ kind, title, children }: { kind: PlanKind; title: string; children?: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <KindDot kind={kind} />
      <b className="line-clamp-2 min-w-0 font-semibold break-words print:line-clamp-none">{title}</b>
      {children}
    </span>
  );
}

/** A small ✓ circle. `tip` is the tooltip and accessible name. */
export function DoneMark({ tip }: { tip: string }) {
  return (
    <span
      role="img"
      aria-label={tip}
      data-tip={tip}
      className="grid size-[22px] shrink-0 place-items-center rounded-full bg-ok-soft text-ok print:bg-transparent"
    >
      <Check className="size-3.5" strokeWidth={2.6} aria-hidden />
    </span>
  );
}
