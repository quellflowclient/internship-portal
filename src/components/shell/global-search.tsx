"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { IconButton, Pill } from "@/components/ui";
import { searchAll, type SearchHit } from "@/server/actions/search";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<SearchHit["kind"], string> = { student: "Student", lead: "Lead", document: "Document", project: "Project" };

/** Top-bar search. "/" focuses it. On phones it opens as a full-width row under the bar. */
export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [open, setOpen] = React.useState(false);
  const [mobile, setMobile] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [pending, start] = React.useTransition();
  const input = React.useRef<HTMLInputElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/input|textarea|select/i.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        setMobile(true);
        input.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const run = (v: string) => {
    clearTimeout(timer.current);
    if (v.trim().length < 2) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(() => start(async () => setHits(await searchAll(v))), 200);
  };

  const close = () => {
    setOpen(false);
    setMobile(false);
  };

  return (
    <>
      <IconButton label="Search" className="md:hidden" onClick={() => { setMobile(true); setTimeout(() => input.current?.focus(), 0); }}>
        <Search aria-hidden />
      </IconButton>
      <div
        className={cn(
          "relative md:block md:w-full md:max-w-[360px]",
          mobile ? "absolute inset-x-0 top-14 z-30 block border-b border-line bg-surface p-2.5 md:static md:border-0 md:p-0" : "hidden",
        )}
      >
        <label className="flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-fg-3 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)] md:h-9">
          <Search className="size-4 shrink-0" aria-hidden />
          <input
            ref={input}
            value={q}
            role="combobox"
            aria-expanded={open && hits.length > 0}
            aria-controls="qf-search-results"
            aria-label="Search students, leads, documents and projects"
            placeholder="Search students, leads, documents"
            className="w-full min-w-0 border-0 bg-transparent text-fg outline-none placeholder:text-fg-3"
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setActive(0);
              run(e.target.value);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, hits.length - 1));
              if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
              if (e.key === "Enter" && hits[active]) {
                router.push(hits[active].href);
                close();
              }
            }}
          />
          {mobile ? (
            <button type="button" aria-label="Close search" className="-mr-2 grid size-10 shrink-0 place-items-center rounded-md text-fg-3 md:hidden" onClick={close}>
              <X className="size-4" aria-hidden />
            </button>
          ) : (
            <kbd className="hidden rounded border border-line-strong px-1.5 font-mono text-[11px] text-fg-3 md:inline">/</kbd>
          )}
        </label>
        {open && q.trim().length >= 2 ? (
          <div id="qf-search-results" role="listbox" className="absolute inset-x-2.5 top-full z-40 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface shadow-pop md:inset-x-0">
            {hits.length ? (
              hits.map((h, i) => (
                <Link
                  key={h.kind + h.id}
                  href={h.href}
                  role="option"
                  aria-selected={i === active}
                  onClick={close}
                  className={cn("flex items-center gap-3 border-b border-line px-3 py-2.5 text-fg no-underline last:border-b-0", i === active ? "bg-hover" : "hover:bg-hover")}
                >
                  <span className="min-w-0 flex-1">
                    <b className="line-clamp-2 text-sm break-words">{h.title}</b>
                    <small className="block truncate text-xs text-fg-3">
                      {h.code}
                      {h.subtitle ? `, ${h.subtitle}` : ""}
                    </small>
                  </span>
                  <Pill>{KIND_LABEL[h.kind]}</Pill>
                </Link>
              ))
            ) : (
              <p className="px-3 py-3 text-sm text-fg-3">{pending ? "Searching…" : "No matches"}</p>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
