"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { tab: "", label: "Overview" },
  { tab: "plan", label: "Plan" },
  { tab: "track", label: "Live track" },
  { tab: "students", label: "Students" },
  { tab: "projects", label: "Projects" },
  { tab: "close", label: "Close batch" },
];

/** Batch sections. Each tab is its own route under /admin/batches/<code>/…. */
export function BatchTabs({ code, counts }: { code: string; counts: { students?: number } }) {
  const pathname = usePathname();
  const base = `/admin/batches/${encodeURIComponent(code)}`;
  return (
    <nav aria-label="Batch sections" className="flex gap-0.5 overflow-x-auto border-b border-line [scrollbar-width:none]">
      {TABS.map(({ tab, label }) => {
        const href = tab ? `${base}/${tab}` : base;
        const active = tab ? pathname.startsWith(href) : pathname === base;
        const count = tab === "students" ? counts.students : undefined;
        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-11 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap no-underline focus-visible:outline-offset-[-2px] md:min-h-0",
              active ? "border-accent font-semibold text-accent-ink" : "border-transparent font-medium text-fg-2 hover:text-fg",
            )}
          >
            {label}
            {count !== undefined ? <span className="rounded-full bg-surface-2 px-1.5 text-[11px] font-bold text-fg-2">{count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
