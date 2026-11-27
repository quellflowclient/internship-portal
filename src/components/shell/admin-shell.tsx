"use client";

/**
 * Admin app shell: light sidebar (full ≥1024px, icon rail 768–1023px, drawer on phones),
 * top bar with global search, notifications link and account menu.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  FileText,
  FolderKanban,
  KeyRound,
  Layers,
  LayoutGrid,
  LogOut,
  Menu,
  Settings,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Avatar, IconButton, IconLink, Logo } from "@/components/ui";
import { GlobalSearch } from "@/components/shell/global-search";
import { signOut } from "@/server/actions/auth";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; badgeKey?: "leads" | "documents" };
const NAV: { section?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutGrid },
      { href: "/admin/leads", label: "Leads", icon: Target, badgeKey: "leads" },
    ],
  },
  {
    section: "People and batches",
    items: [
      { href: "/admin/students", label: "Students", icon: Users },
      { href: "/admin/batches", label: "Batches", icon: Layers },
      { href: "/admin/projects", label: "Projects", icon: FolderKanban },
    ],
  },
  {
    section: "Records",
    items: [
      { href: "/admin/payments", label: "Payments", icon: Wallet },
      { href: "/admin/documents", label: "Documents", icon: FileText, badgeKey: "documents" },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AdminShell({
  name,
  subtitle,
  badges,
  attention,
  children,
}: {
  name: string;
  subtitle: string;
  badges: { leads?: number; documents?: number };
  attention: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date());

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[68px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
      {open ? <div className="fixed inset-0 z-30 bg-[var(--scrim)] md:hidden" onClick={() => setOpen(false)} aria-hidden /> : null}
      <aside
        aria-label="Navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col gap-4 overflow-y-auto border-r border-line bg-side px-3 py-3.5 transition-transform duration-200 md:sticky md:top-0 md:z-auto md:h-dvh md:w-auto md:translate-x-0 md:px-2.5 lg:px-3",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Link href="/admin" className="flex items-center gap-2.5 px-1.5 py-1 text-fg no-underline md:max-lg:justify-center">
          <Logo />
          <span className="leading-tight md:max-lg:hidden">
            <b className="block text-md">Quellflow</b>
            <small className="block text-xs text-fg-3">Admin portal</small>
          </span>
        </Link>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((group, gi) => (
            <React.Fragment key={gi}>
              {group.section ? <div className="px-2.5 pt-3 pb-1 text-xs font-medium text-fg-3 md:max-lg:hidden">{group.section}</div> : null}
              {group.items.map(({ href, label, icon: Icon, badgeKey }) => {
                const active = isActive(href);
                const badge = badgeKey ? badges[badgeKey] : undefined;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    data-tip={label}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-lg px-2.5 text-base font-medium no-underline transition-colors md:h-[38px] md:max-lg:justify-center",
                      active ? "bg-accent-soft font-semibold text-accent-ink" : "text-fg-2 hover:bg-hover hover:text-fg",
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" aria-hidden />
                    <span className="md:max-lg:hidden">{label}</span>
                    {badge ? (
                      <span
                        className={cn(
                          "ml-auto grid h-5 min-w-[22px] place-items-center rounded-full px-1.5 text-[11px] font-bold md:max-lg:hidden",
                          active ? "bg-accent text-accent-fg" : "bg-surface text-fg-2 shadow-[inset_0_0_0_1px_var(--line)]",
                        )}
                      >
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </React.Fragment>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 border-t border-line px-1.5 pt-3 md:max-lg:justify-center">
          <Avatar name={name} />
          <span className="min-w-0 leading-tight md:max-lg:hidden">
            <b className="block truncate text-sm">{name}</b>
            <small className="block text-xs text-fg-3">{subtitle}</small>
          </span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface px-2.5 md:gap-3 md:px-6">
          <IconButton label="Open menu" className="md:hidden" onClick={() => setOpen(true)}>
            <Menu aria-hidden />
          </IconButton>
          <Link href="/admin" className="flex items-center gap-2 text-fg no-underline md:hidden">
            <Logo className="size-7" />
            <b className="text-md">Quellflow</b>
          </Link>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1.5">
            <span className="mr-1.5 hidden text-sm whitespace-nowrap text-fg-3 lg:inline">{today}</span>
            <IconLink href="/admin" label={attention ? `${attention} items need attention` : "Nothing needs attention"} className="relative">
              <Bell aria-hidden />
              {attention ? <span className="absolute top-2 right-2 size-2 rounded-full border-2 border-surface bg-bad" aria-hidden /> : null}
            </IconLink>
            <details className="relative">
              <summary className="list-none cursor-pointer rounded-full [&::-webkit-details-marker]:hidden" aria-label="Account menu">
                <Avatar name={name} />
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-pop">
                <p className="truncate px-2.5 pt-1.5 pb-2 text-xs text-fg-3">{name}</p>
                <Link href="/account/password" className="flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm text-fg no-underline hover:bg-hover">
                  <KeyRound className="size-4" aria-hidden /> Change password
                </Link>
                <form action={signOut}>
                  <button type="submit" className="flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-fg hover:bg-hover">
                    <LogOut className="size-4" aria-hidden /> Sign out
                  </button>
                </form>
              </div>
            </details>
          </div>
        </header>
        <main className="px-4 pt-4 pb-10 md:px-7 md:pt-6">
          <div key={pathname} className="qf-enter mx-auto flex max-w-[1200px] flex-col gap-5">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
