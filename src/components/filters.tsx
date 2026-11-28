"use client";

/** Search box and select filters that write to the URL (paging and the open panel reset on change). */
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

function useSetParam() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return React.useCallback(
    (key: string, value: string) => {
      const q = new URLSearchParams(params.toString());
      if (value) q.set(key, value);
      else q.delete(key);
      q.delete("page");
      q.delete("show");
      q.delete("open");
      const s = q.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [router, pathname, params],
  );
}

export function SearchBox({ param = "q", placeholder, className }: { param?: string; placeholder: string; className?: string }) {
  const params = useSearchParams();
  const setParam = useSetParam();
  const [value, setValue] = React.useState(params.get(param) ?? "");
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => setValue(params.get(param) ?? ""), [params, param]);

  return (
    <label
      className={cn(
        "flex h-11 min-w-0 flex-[1_1_220px] items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-fg-3 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)] md:h-9 md:max-w-[320px]",
        className,
      )}
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <input
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setParam(param, v.trim()), 250);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full min-w-0 border-0 bg-transparent text-fg outline-none placeholder:text-fg-3"
        autoComplete="off"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          className="-mr-2 grid size-10 shrink-0 place-items-center rounded-md text-fg-3 hover:text-fg md:-mr-1.5 md:size-7"
          onClick={() => {
            setValue("");
            setParam(param, "");
          }}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </label>
  );
}

export function FilterSelect({
  param,
  options,
  label,
  className,
}: {
  param: string;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  const params = useSearchParams();
  const setParam = useSetParam();
  return (
    <select
      aria-label={label}
      value={params.get(param) ?? ""}
      onChange={(e) => setParam(param, e.target.value)}
      className={cn(
        "h-11 max-w-full rounded-lg border border-line-strong bg-surface px-2.5 text-sm font-medium text-fg md:h-9",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
