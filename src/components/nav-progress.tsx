"use client";

/**
 * Thin progress bar at the top while a page or panel loads, so a click always shows a response.
 * Starts on same-site link clicks (and the "qf-nav-start" event from router.push calls),
 * finishes when the URL changes.
 */
import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function startNavProgress() {
  window.dispatchEvent(new Event("qf-nav-start"));
}

export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = React.useState<"idle" | "loading" | "done">("idle");

  React.useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
    const t = setTimeout(() => setState((s) => (s === "done" ? "idle" : s)), 350);
    return () => clearTimeout(t);
  }, [pathname, search]);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setState("loading");
    };
    const onStart = () => setState("loading");
    document.addEventListener("click", onClick, true);
    window.addEventListener("qf-nav-start", onStart);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("qf-nav-start", onStart);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[400] h-[3px] origin-left bg-accent transition-[transform,opacity]",
        state === "loading" && "scale-x-[0.8] opacity-100 duration-[2500ms] ease-out",
        state === "done" && "scale-x-100 opacity-0 duration-300",
        state === "idle" && "scale-x-0 opacity-0 duration-0",
      )}
    />
  );
}
