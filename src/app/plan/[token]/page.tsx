/**
 * Public, read-only batch plan (docs/19 DB-9, P3). Always the latest published version, read through
 * get_shared_plan(token) – granted to anon, returns null when the link is off or nothing is published.
 * No personal data and no fees here (D-04).
 */
import type { Metadata } from "next";
import { cache } from "react";
import { GraduationCap, ListVideo, Video } from "lucide-react";
import { Logo, Meta, Notice, Pill } from "@/components/ui";
import { WhatsAppIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDay } from "@/lib/utils";
import { sp, type SearchParams } from "@/lib/url";
import type { PlanKind } from "@/lib/types";
import { groupByWeek, safeHref } from "../_lib/plan";
import { DoneMark, KindDot, KindLegend, PLAN_ROW, WeekCard } from "../_lib/plan-ui";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

type SharedItem = { seq: number; week: number; date: string; kind: PlanKind; title: string; done: boolean; skipped: boolean };
type SharedPlan = {
  batch: string;
  course: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  session_time: string | null;
  version: number;
  published_at: string;
  change_note: string | null;
  links: { whatsapp: string | null; classroom: string | null; meet: string | null; playlist: string | null };
  items: SharedItem[];
};

const loadPlan = cache(async (token: string): Promise<SharedPlan | null> => {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_plan", { p_token: token });
  if (error || !data) return null;
  return data as SharedPlan;
});

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const plan = await loadPlan(token);
  return { title: plan ? `${plan.course} plan` : "Plan link not active", robots: { index: false, follow: false } };
}

function Header() {
  return (
    <header className="border-b border-line bg-surface print:border-0 print:bg-transparent">
      <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-4 py-3.5 font-bold">
        <Logo />
        Quellflow
      </div>
    </header>
  );
}

const PRINT = "print:bg-transparent print:text-black print:**:text-black";

export default async function SharedPlanPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<SearchParams> }) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const plan = await loadPlan(token);

  if (!plan) {
    return (
      <div className="min-h-dvh bg-bg">
        <Header />
        <main className="mx-auto flex max-w-2xl flex-col items-center gap-2 px-4 py-16 text-center">
          <h1 className="text-lg font-bold">This plan link is not active</h1>
          <p className="max-w-md text-sm text-fg-2">Ask in your batch WhatsApp group for the current plan link.</p>
        </main>
      </div>
    );
  }

  const links = [
    { href: safeHref(plan.links.whatsapp), label: "WhatsApp", icon: <WhatsAppIcon className="text-wa" /> },
    { href: safeHref(plan.links.classroom), label: "Classroom", icon: <GraduationCap aria-hidden /> },
    { href: safeHref(plan.links.meet), label: "Meet", icon: <Video aria-hidden /> },
    { href: safeHref(plan.links.playlist), label: "Recordings", icon: <ListVideo aria-hidden /> },
  ].filter((l) => l.href);
  const weeks = groupByWeek(plan.items, (i) => i.date);

  return (
    <div className={`min-h-dvh bg-bg ${PRINT}`}>
      <Header />
      <main className="mx-auto flex max-w-2xl flex-col gap-3.5 px-4 pt-5 pb-10 print:pt-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold md:text-xl">
              {plan.course}, {plan.duration_days}-day plan
            </h1>
            <div className="mt-1 text-sm text-fg-2">
              <Meta items={[`Batch ${plan.batch}`, `${formatDate(plan.start_date)} to ${formatDate(plan.end_date)}`, plan.session_time]} />
            </div>
            <p className="mt-0.5 text-xs text-fg-3">
              Version {plan.version}, updated {formatDate(plan.published_at)}
            </p>
          </div>
          <PrintButton auto={sp(query, "print") === "1"} />
        </div>

        {plan.change_note ? (
          <Notice tone="warn">
            <b>Update:</b> {plan.change_note}
          </Notice>
        ) : null}

        {links.length ? (
          <nav aria-label="Batch links" className="flex flex-wrap gap-2 print:hidden">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-xs font-semibold text-fg-2 no-underline hover:bg-hover [&_svg]:size-4"
              >
                {l.icon}
                {l.label}
              </a>
            ))}
          </nav>
        ) : null}

        <KindLegend />

        {weeks.length ? (
          weeks.map((w) => (
            <WeekCard key={w.week} week={w.week} range={w.range}>
              {w.items.map((it) => (
                <div key={it.seq} className={PLAN_ROW}>
                  <span className="text-xs font-medium text-fg-3 md:text-sm">{formatDay(it.date)}</span>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <KindDot kind={it.kind} />
                    <b className="min-w-0 font-semibold">{it.title}</b>
                  </span>
                  <span className="flex items-center justify-self-end">
                    {it.skipped ? <Pill tone="bad">Skipped</Pill> : it.done ? <DoneMark tip="Done" /> : null}
                  </span>
                </div>
              ))}
            </WeekCard>
          ))
        ) : (
          <p className="py-6 text-center text-sm text-fg-3">The plan has no items yet.</p>
        )}

        <p className="text-center text-xs text-fg-3">Read-only plan with no personal data.</p>
      </main>
    </div>
  );
}
