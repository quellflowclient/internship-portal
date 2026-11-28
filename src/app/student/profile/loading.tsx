import { Sk } from "@/components/skeleton";

/** Profile: avatar + name, the details form and the read-only card. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3.5">
        <Sk className="size-15 rounded-full" />
        <div className="flex-1">
          <Sk className="h-[24px] w-[180px] max-w-[70%]" />
          <Sk className="mt-2 h-3 w-[110px]" />
        </div>
      </div>
      {[4, 6].map((n, c) => (
        <section key={c} className="rounded-xl border border-line bg-surface">
          <div className="border-b border-line px-4 py-4">
            <Sk className="h-4 w-28" />
          </div>
          <div className="grid gap-3.5 p-4 md:grid-cols-2">
            {Array.from({ length: n }, (_, i) => (
              <div key={i}>
                <Sk className="h-3 w-20" />
                <Sk className="mt-2 h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
