"use client";

/**
 * The detail panel: side panel on desktop, bottom sheet on phones.
 * Open it by rendering it when ?open=… (or ?new=1) is in the URL; closing navigates to `closeHref`.
 * Never use a modal for details (impeccable/ui-ux guidance) – this panel keeps the list in view.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { IconButton } from "@/components/ui";
import { startNavProgress } from "@/components/nav-progress";

export function Drawer({
  closeHref,
  title,
  sub,
  lead,
  icons,
  footer,
  children,
}: {
  closeHref: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  lead?: React.ReactNode;
  icons?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const closeBtn = React.useRef<HTMLButtonElement>(null);
  const close = React.useCallback(() => {
    setOpen(false);
    startNavProgress();
    setTimeout(() => router.push(closeHref, { scroll: false }), 180);
  }, [router, closeHref]);

  React.useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
    };
  }, [close]);

  return (
    <div className={open ? "qf-panel-open fixed inset-0 z-50" : "fixed inset-0 z-50"}>
      <div className="qf-scrim absolute inset-0 bg-[var(--scrim)]" onClick={close} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="qf-panel-title"
        className="qf-panel absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-[18px] bg-surface shadow-pop md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[min(460px,100%)] md:rounded-none md:border-l md:border-line"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong md:hidden" aria-hidden />
        <header className="flex items-start gap-3 border-b border-line py-3 pr-3 pl-4.5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {lead}
            <div className="min-w-0">
              <h2 id="qf-panel-title" className="line-clamp-2 text-md font-semibold break-words">
                {title}
              </h2>
              {sub ? <p className="line-clamp-2 text-xs break-words text-fg-3">{sub}</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {icons}
            <IconButton ref={closeBtn} label="Close" onClick={close}>
              <X aria-hidden />
            </IconButton>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4.5">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap items-center gap-2 border-t border-line px-4.5 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] max-md:[&>*]:flex-[1_1_auto]">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
