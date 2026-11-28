import Link from "next/link";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ACCEPT_DOC_TYPES } from "@/lib/labels";
import { signOut } from "@/server/actions/auth";
import { BottomTabs, TopNav } from "./_parts/student-nav";

/** Student app shell (Step F): Home, My plan, Documents, Profile. Top nav from tablet up, bottom tabs on phones. */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["student"]);
  const supabase = await createClient();
  // RLS: only the student's own non-draft documents.
  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("status", "issued")
    .in("type", ACCEPT_DOC_TYPES);
  const toSign = count ?? 0;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-surface print:hidden">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <Link href="/student" className="flex items-center gap-2 text-fg no-underline">
            <Logo className="size-7" />
            <b className="text-md">Quellflow</b>
          </Link>
          <div className="flex items-center gap-1">
            <TopNav toSign={toSign} />
            <form action={signOut}>
              <button type="submit" aria-label="Sign out" data-tip="Sign out" className="grid size-11 place-items-center rounded-lg text-fg-2 hover:bg-hover md:size-10">
                <LogOut className="size-[18px]" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pt-5 pb-[calc(88px+env(safe-area-inset-bottom,0px))] md:pb-10">{children}</main>
      <BottomTabs toSign={toSign} />
    </div>
  );
}
