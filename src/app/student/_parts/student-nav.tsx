"use client";

/** Student app tabs: a top nav from tablet up, a fixed bottom tab bar on phones (docs/18 §6, preview "bottomnav"). */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FileText, House, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string; short: string; icon: LucideIcon };
const TABS: Tab[] = [
  { href: "/student", label: "Home", short: "Home", icon: House },
  { href: "/student/plan", label: "My plan", short: "Plan", icon: CalendarDays },
  { href: "/student/documents", label: "Documents", short: "Docs", icon: FileText },
  { href: "/student/profile", label: "Profile", short: "Profile", icon: UserRound },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/student" ? pathname === "/student" : pathname.startsWith(href));
}

/** `toSign` puts a dot on Documents while something waits for the student's signature. */
export function TopNav({ toSign }: { toSign: number }) {
  const isActive = useActive();
  return (
    <nav aria-label="Main" className="hidden items-center gap-0.5 md:flex">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm no-underline transition-colors",
              active ? "bg-accent-soft font-semibold text-accent-ink" : "font-medium text-fg-2 hover:bg-hover hover:text-fg",
            )}
          >
            <Icon className="size-[18px]" aria-hidden />
            {label}
            {href === "/student/documents" && toSign ? (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-bad px-1.5 text-[11px] font-bold text-bg">
                {toSign}
                <span className="sr-only"> to sign</span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomTabs({ toSign }: { toSign: number }) {
  const isActive = useActive();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface px-1 pt-1 pb-[calc(4px+env(safe-area-inset-bottom,0px))] md:hidden print:hidden"
    >
      {TABS.map(({ href, short, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold no-underline",
              active ? "text-accent-ink" : "text-fg-3",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {short}
            {href === "/student/documents" && toSign ? (
              <>
                <span className="absolute top-1.5 left-[calc(50%+6px)] size-2 rounded-full bg-bad" aria-hidden />
                <span className="sr-only">, {toSign} to sign</span>
              </>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
