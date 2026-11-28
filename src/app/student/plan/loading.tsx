import { Sk } from "@/components/skeleton";

/** My plan: header, legend and two week cards. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading">
      <div>
        <Sk className="h-[26px] w-[140px]" />
        <Sk className="mt-2 h-3.5 w-[300px] max-w-[85%]" />
      </div>
      <Sk className="h-3 w-[260px] max-w-[80%]" />
      {[0, 1].map((w) => (
        <section key={w} className="rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <Sk className="h-3.5 w-16" />
            <Sk className="h-3 w-20" />
          </div>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-b-0">
              <Sk className="h-3 w-10 md:w-20" />
              <Sk className="h-3 flex-1" />
              <Sk className="size-[22px] rounded-full" />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
