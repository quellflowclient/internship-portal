/** Loading placeholders – used by loading.tsx files so navigation shows structure, not a spinner. */
import { cn } from "@/lib/utils";

export function Sk({ className }: { className?: string }) {
  return <div className={cn("qf-skeleton", className)} aria-hidden />;
}

export function ListSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <section className="rounded-xl border border-line bg-surface">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
          <Sk className="size-8 rounded-full" />
          <div className="flex-1">
            <Sk className="h-3 w-2/5" />
            <Sk className="mt-1.5 h-2.5 w-1/4" />
          </div>
          <Sk className="h-5 w-[72px] rounded-full" />
        </div>
      ))}
    </section>
  );
}

/** `header={false}` inside a layout that already shows the page header (batch tabs). */
export function PageSkeleton({ kpis = 4, rows = 7, header = true }: { kpis?: number; rows?: number; header?: boolean }) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading">
      {header ? (
        <>
          <Sk className="h-[26px] w-[220px] max-w-[70%]" />
          <Sk className="h-3.5 w-[320px] max-w-[80%]" />
        </>
      ) : null}
      {kpis ? (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
          {Array.from({ length: kpis }, (_, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-4">
              <Sk className="h-3 w-3/5" />
              <Sk className="mt-2 h-[22px] w-2/5" />
            </div>
          ))}
        </div>
      ) : null}
      <ListSkeleton rows={rows} />
    </div>
  );
}
