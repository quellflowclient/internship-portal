import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";
import { Wordmark } from "@/components/ui";
import { signOut } from "@/server/actions/auth";
import { ROLE_LABEL } from "@/lib/labels";
import type { Profile } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Sidebar on desktop, bottom tab bar on mobile (docs/11_UI_UX_GUIDE.md). */
export function AppShell({ nav, profile, children }: { nav: NavItem[]; profile: Profile; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden bg-navy text-white lg:flex lg:flex-col">
        <div className="px-6 py-6">
          <Wordmark />
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/85 hover:bg-white/10 hover:text-white"
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <UserBox profile={profile} />
      </aside>

      <header className="flex items-center justify-between bg-navy px-4 py-3 text-white lg:hidden">
        <Wordmark />
        <form action={signOut}>
          <button type="submit" className="flex min-h-11 items-center gap-1 text-sm text-white/85" aria-label="Sign out">
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </header>

      <main className="px-4 pt-6 pb-24 sm:px-6 lg:px-10 lg:pb-10">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 grid border-t border-line bg-white lg:hidden" style={{ gridTemplateColumns: `repeat(${Math.min(nav.length, 5)}, 1fr)` }}>
        {nav.slice(0, 5).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-ink">
            <Icon className="h-5 w-5" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function UserBox({ profile }: { profile: Profile }) {
  return (
    <div className="border-t border-white/10 p-4">
      <p className="truncate text-sm font-semibold">{profile.full_name ?? profile.email}</p>
      <p className="truncate text-xs text-white/60">{ROLE_LABEL[profile.role]}</p>
      <form action={signOut} className="mt-3">
        <button type="submit" className="flex items-center gap-2 text-xs text-white/75 hover:text-white">
          <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out
        </button>
      </form>
    </div>
  );
}
