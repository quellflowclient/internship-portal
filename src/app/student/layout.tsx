import Link from "next/link";
import { FileText, LogOut } from "lucide-react";
import { Logo } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { signOut } from "@/server/actions/auth";

/** Minimal student shell for Step B. The full student app (Home, Plan, Docs, Profile + bottom tabs) comes in Step F. */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["student"]);
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-surface px-4">
        <Link href="/student" className="flex items-center gap-2 text-fg no-underline">
          <Logo className="size-7" />
          <b className="text-md">Quellflow</b>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/student/documents"
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-fg-2 no-underline hover:bg-hover hover:text-fg md:h-10"
          >
            <FileText className="size-[18px]" aria-hidden />
            Documents
          </Link>
          <form action={signOut}>
            <button type="submit" aria-label="Sign out" data-tip="Sign out" className="grid size-11 place-items-center rounded-lg text-fg-2 hover:bg-hover md:size-10">
              <LogOut className="size-[18px]" aria-hidden />
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pt-5 pb-10">{children}</main>
    </div>
  );
}
