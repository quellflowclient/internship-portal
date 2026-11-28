import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Notice, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { sp, type SearchParams } from "@/lib/url";
import { cn } from "@/lib/utils";
import { OrgSection } from "./org-section";
import { PlansSection } from "./plans-section";
import { NumbersSection } from "./numbers-section";
import { FilesSection } from "./files-section";
import { UsersSection } from "./users-section";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS = [
  { key: "org", label: "Organisation" },
  { key: "plans", label: "Course plans and fees" },
  { key: "numbers", label: "Document numbers" },
  { key: "files", label: "Local files and rules" },
  { key: "users", label: "Users and access" },
] as const;
type Sec = (typeof SECTIONS)[number]["key"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { profile } = await requireRole(["admin"]);
  const raw = sp(params, "sec");
  const sec: Sec = SECTIONS.some((s) => s.key === raw) ? (raw as Sec) : "org";
  const isOwner = profile.is_owner;
  const open = sp(params, "open");
  const isNew = sp(params, "new") === "1";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Settings" description="Everything the portal shows comes from here" />
      {!isOwner ? (
        <Notice tone="info" icon={<Lock aria-hidden />}>
          Only an owner can change these settings. You can view them, and you can change course plan fees.
        </Notice>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[200px_minmax(0,1fr)] md:gap-5">
        <nav
          aria-label="Settings sections"
          className="flex gap-0.5 overflow-x-auto rounded-xl border border-line bg-surface p-1.5 [scrollbar-width:none] md:flex-col"
        >
          {SECTIONS.map((s) => (
            <Link
              key={s.key}
              href={`/admin/settings?sec=${s.key}`}
              scroll={false}
              aria-current={sec === s.key ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2.5 text-sm whitespace-nowrap no-underline md:py-2",
                sec === s.key ? "bg-accent-soft font-semibold text-accent-ink" : "font-medium text-fg-2 hover:bg-hover hover:text-fg",
              )}
            >
              {s.label}
            </Link>
          ))}
        </nav>
        <div className="flex min-w-0 flex-col gap-4">
          {sec === "org" ? <OrgSection canEdit={isOwner} /> : null}
          {sec === "plans" ? <PlansSection open={open} tpl={sp(params, "tpl")} ti={sp(params, "ti")} /> : null}
          {sec === "numbers" ? <NumbersSection /> : null}
          {sec === "files" ? <FilesSection canEdit={isOwner} /> : null}
          {sec === "users" ? <UsersSection isOwner={isOwner} selfId={profile.id} open={open} isNew={isNew} /> : null}
        </div>
      </div>
    </div>
  );
}
