/**
 * Compact lists (10 rows) with pagination on desktop and "View more" on phones.
 * A row is a link that opens the detail panel (?open=…) or a page. Server-safe (no hooks).
 *
 *   <List cols="minmax(0,2fr) 100px 120px 20px" head={[["Student"], ["Type", "wide"], …]}>
 *     <ListRow href=… i={0}> <MainCell …/> <Wide>…</Wide> <End>…</End> <Chevron/> </ListRow>
 *   </List>
 *   <Pager path="/admin/students" params={searchParams} total={58} page={1} show={0} />
 *
 * On phones every cell inside <Wide> is hidden and the row becomes "main + end".
 */
import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";
import { hrefWith, PAGE_SIZE, type SearchParams } from "@/lib/url";

export function List({
  cols,
  head,
  empty = "Nothing matches these filters.",
  children,
}: {
  cols: string;
  head?: [label: string, kind?: "wide" | "wide-right"][];
  empty?: React.ReactNode;
  children: React.ReactNode;
}) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <div style={{ ["--cols" as string]: cols }}>
      {head ? (
        <div className="qf-list-head h-[38px] rounded-t-xl border-b border-line bg-surface-2 text-xs font-medium text-fg-3">
          {head.map(([label, kind], i) => (
            <span key={i} className={cn(kind?.startsWith("wide") && "qf-wide", kind === "wide-right" && "justify-self-end")}>
              {label}
            </span>
          ))}
        </div>
      ) : null}
      {rows.length ? rows : <div className="px-4 py-10 text-center text-sm text-fg-3">{empty}</div>}
    </div>
  );
}

export function ListRow({ href, i = 0, selected, children }: { href: string; i?: number; selected?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      style={{ ["--i" as string]: Math.min(i, 10) }}
      className={cn(
        "qf-list-row qf-row min-h-[52px] border-b border-line py-2 text-fg no-underline transition-colors last:border-b-0 hover:bg-hover focus-visible:outline-offset-[-2px]",
        selected && "bg-accent-soft",
      )}
    >
      {children}
    </Link>
  );
}

/** First cell: optional avatar/icon, title and a sub line. `narrow` text shows only on phones. */
export function MainCell({ title, sub, narrow, avatar, icon }: { title: React.ReactNode; sub?: React.ReactNode; narrow?: React.ReactNode; avatar?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {avatar ? <Avatar name={avatar} /> : icon}
      <div className="min-w-0">
        <b className="line-clamp-2 font-semibold break-words md:line-clamp-1">{title}</b>
        {sub || narrow ? (
          <small className="block truncate text-xs text-fg-3">
            {sub}
            {narrow ? <span className="qf-narrow-only">{sub ? ", " : ""}{narrow}</span> : null}
          </small>
        ) : null}
      </div>
    </div>
  );
}

export function Wide({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return <span className={cn("qf-wide min-w-0 truncate text-sm", right && "justify-self-end", className)}>{children}</span>;
}

export function End({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center gap-1.5 justify-self-end whitespace-nowrap">{children}</span>;
}

export function Chevron() {
  return (
    <span className="qf-wide justify-self-end text-fg-3">
      <ChevronRight className="size-4" aria-hidden />
    </span>
  );
}

export function GroupHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-line bg-surface-2 px-4 py-2 text-xs font-semibold text-fg-3">{children}</div>;
}

export function Pager({
  path,
  params,
  total,
  page,
  show,
  per = PAGE_SIZE,
}: {
  path: string;
  params: SearchParams;
  total: number;
  page: number;
  show: number;
  per?: number;
}) {
  if (total === 0) return null;
  const pages = Math.max(1, Math.ceil(total / per));
  const shown = show || Math.min(page * per, total);
  const left = total - shown;
  const nums: (number | "…")[] = [];
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 1) nums.push(n);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  const from = (page - 1) * per + 1;
  const to = Math.min(page * per, total);
  const btn = "grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-xs font-semibold no-underline";
  return (
    <>
      {/* desktop */}
      <div className="hidden items-center justify-between gap-3 border-t border-line py-2.5 pr-3 pl-4 text-sm text-fg-3 md:flex">
        <span>{total > per ? `${from}–${to} of ${total}` : `${total} ${total === 1 ? "item" : "items"}`}</span>
        {total > per ? (
          <nav className="flex items-center gap-0.5" aria-label="Pages">
            {page > 1 ? (
              <Link className={cn(btn, "text-fg-2 hover:bg-hover")} href={hrefWith(path, params, { page: page - 1, show: null })} scroll={false} aria-label="Previous page">
                <ChevronLeft className="size-4" />
              </Link>
            ) : (
              <span className={cn(btn, "text-fg-3 opacity-40")} aria-hidden>
                <ChevronLeft className="size-4" />
              </span>
            )}
            {nums.map((n, i) =>
              n === "…" ? (
                <span key={`g${i}`} className="px-1">
                  …
                </span>
              ) : (
                <Link
                  key={n}
                  href={hrefWith(path, params, { page: n === 1 ? null : n, show: null })}
                  scroll={false}
                  aria-current={n === page ? "page" : undefined}
                  className={cn(btn, n === page ? "bg-accent-soft text-accent-ink" : "text-fg-2 hover:bg-hover")}
                >
                  {n}
                </Link>
              ),
            )}
            {page < pages ? (
              <Link className={cn(btn, "text-fg-2 hover:bg-hover")} href={hrefWith(path, params, { page: page + 1, show: null })} scroll={false} aria-label="Next page">
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span className={cn(btn, "text-fg-3 opacity-40")} aria-hidden>
                <ChevronRight className="size-4" />
              </span>
            )}
          </nav>
        ) : null}
      </div>
      {/* phone */}
      <div className="md:hidden">
        {left > 0 ? (
          <Link
            href={hrefWith(path, params, { show: shown + per, page: null })}
            scroll={false}
            className="flex h-12 items-center justify-center gap-2 rounded-b-xl border-t border-line text-sm font-semibold text-accent-ink no-underline hover:bg-hover"
          >
            View more <span className="font-medium text-fg-3">{left} left</span>
          </Link>
        ) : total > per ? (
          <p className="border-t border-line p-3 text-center text-xs text-fg-3">All {total} shown</p>
        ) : null}
      </div>
    </>
  );
}
