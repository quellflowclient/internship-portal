import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity as ActivityIcon,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock,
  FileText,
  Layers,
  Mail,
  MessageCircle,
  Phone,
  StickyNote,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Bar, ButtonLink, Card, CardHeader, Kpi, KpiGrid, PageHeader, Pill, toneClass } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_LABEL, STAGE, STAGES } from "@/lib/labels";
import type { ActivityKind, AttentionRow, BatchProgress, DisplayStatus, LeadStage, StudentType, Tone } from "@/lib/types";
import { cn, formatDateTime, inr, todayIST } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const IST = "Asia/Kolkata";
const DAY = 86_400_000;

type RunningBatch = { id: string; code: string; course_plans: { duration_days: number; courses: { name: string } | null } | null };
type RecentActivity = {
  id: string;
  kind: ActivityKind;
  summary: string;
  occurred_at: string;
  lead_id: string | null;
  student_id: string | null;
  leads: { full_name: string } | null;
  students: { full_name: string; code: string } | null;
};

/* ---------- helpers ---------- */
function greeting(now: Date) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: IST }).format(now));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function attentionHref(r: AttentionRow): string {
  if (r.key.startsWith("behind_")) return `/admin/batches/${encodeURIComponent(r.key.slice(7))}`;
  if (r.key.startsWith("ending_")) return `/admin/batches/${encodeURIComponent(r.key.slice(7))}/close`;
  switch (r.route) {
    case "a-leads":
      return "/admin/leads?due=1";
    case "a-documents":
      return "/admin/documents?status=awaiting";
    case "a-payments":
      return r.filters?.tab ? "/admin/payments?tab=stipend" : "/admin/payments?proof=missing";
    case "a-students":
      return "/admin/students?batch=none";
    default:
      return "/admin/batches";
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function attentionText(r: AttentionRow): string {
  if (r.key.startsWith("behind_")) return `${r.key.slice(7)} is ${plural(r.n, "day")} behind plan`;
  if (r.key.startsWith("ending_")) return `${r.key.slice(7)} ends in ${plural(r.n, "day")}`;
  return `${r.n} ${r.label}`;
}

function attentionIcon(r: AttentionRow): LucideIcon {
  if (r.key === "follow_ups") return Clock;
  if (r.key === "docs_waiting") return FileText;
  if (r.key === "proof_missing" || r.key === "stipend_due") return Wallet;
  if (r.key === "not_assigned") return Users;
  if (r.key.startsWith("ending_")) return CalendarClock;
  return Layers;
}

const ACT_ICON: Record<ActivityKind, { icon: LucideIcon; tone: Tone }> = {
  call: { icon: Phone, tone: "acc" },
  whatsapp: { icon: MessageCircle, tone: "ok" },
  email: { icon: Mail, tone: "info" },
  meeting: { icon: CalendarDays, tone: "vio" },
  note: { icon: StickyNote, tone: "mute" },
  system: { icon: ActivityIcon, tone: "info" },
};

function relTime(iso: string, now: Date): string {
  const d = new Date(iso);
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${plural(mins, "minute")} ago`;
  if (mins < 60 * 6) return `${plural(Math.round(mins / 60), "hour")} ago`;
  const day = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(x);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: IST }).format(d);
  if (day(d) === day(now)) return `Today, ${time}`;
  if (day(d) === day(new Date(now.getTime() - DAY))) return `Yesterday, ${time}`;
  return formatDateTime(d);
}

/* ---------- page ---------- */
export default async function AdminDashboard() {
  const { profile } = await requireRole(["admin"]);
  const supabase = await createClient();
  const now = new Date();
  const today = todayIST();
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthStartTs = `${monthStart}T00:00:00+05:30`;
  const weekAgo = new Date(now.getTime() - 7 * DAY).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY).toISOString();

  const [leads7, leadsPrev, students, money, fees, awaiting, attention, progress, batches, monthLeads, activity] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", twoWeeksAgo).lt("created_at", weekAgo),
    supabase.from("v_student_list").select("type").in("display_status", ["active", "at_risk"] satisfies DisplayStatus[]),
    supabase.from("v_money_month").select("money_in").eq("month", monthStart).maybeSingle(),
    supabase.from("v_fee_balance").select("pending").gt("pending", 0),
    supabase.from("v_document_list").select("id", { count: "exact", head: true }).eq("display_status", "awaiting"),
    supabase.from("v_attention").select("key, tone, n, label, route, filters"),
    supabase.from("v_batch_progress").select("*").eq("status", "running"),
    supabase.from("batches").select("id, code, course_plans(duration_days, courses(name))").eq("status", "running"),
    supabase.from("leads").select("stage").gte("created_at", monthStartTs),
    supabase
      .from("activities")
      .select("id, kind, summary, occurred_at, lead_id, student_id, leads(full_name), students(full_name, code)")
      .order("occurred_at", { ascending: false })
      .limit(6),
  ]);

  /* KPIs */
  const new7 = leads7.count ?? 0;
  const diff = new7 - (leadsPrev.count ?? 0);
  const studentTypes = (students.data ?? []) as { type: StudentType | null }[];
  const byType = (t: StudentType) => studentTypes.filter((s) => s.type === t).length;
  const moneyIn = (money.data as { money_in: number } | null)?.money_in ?? 0;
  const pendingFees = ((fees.data ?? []) as { pending: number }[]).reduce((s, r) => s + (r.pending ?? 0), 0);
  const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: IST }).format(now);

  /* Needs attention */
  const attn = ((attention.data ?? []) as AttentionRow[]).filter((r) => r.n > 0);

  /* Running batches */
  const names = new Map(((batches.data ?? []) as unknown as RunningBatch[]).map((b) => [b.id, b]));
  const running = ((progress.data ?? []) as BatchProgress[]).sort((a, b) => b.days_behind - a.days_behind || a.code.localeCompare(b.code));

  /* Funnel: leads created this month, by current stage */
  const stageCounts = new Map<LeadStage, number>();
  for (const l of (monthLeads.data ?? []) as { stage: LeadStage }[]) stageCounts.set(l.stage, (stageCounts.get(l.stage) ?? 0) + 1);
  const funnelStages = STAGES.filter((s) => s !== "lost");
  const totalMonth = (monthLeads.data ?? []).length;
  const maxStage = Math.max(1, ...funnelStages.map((s) => stageCounts.get(s) ?? 0));
  const converted = stageCounts.get("converted") ?? 0;
  const lost = stageCounts.get("lost") ?? 0;

  const recent = (activity.data ?? []) as unknown as RecentActivity[];
  const firstName = (profile.full_name ?? profile.email.split("@")[0]).trim().split(/\s+/)[0];
  const fullDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: IST }).format(now);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`${greeting(now)}, ${firstName}`}
        description={fullDate}
        info="Your daily overview. Every number and item opens the screen where it is handled."
      />

      <KpiGrid>
        <Kpi
          label="New leads, last 7 days"
          value={new7}
          sub={diff === 0 ? "Same as previous week" : `${diff > 0 ? "+" : "−"}${Math.abs(diff)} vs previous week`}
          tone={diff > 0 ? "ok" : diff < 0 ? "bad" : undefined}
          href="/admin/leads"
        />
        <Kpi
          label="Active students"
          value={studentTypes.length}
          sub={`${byType("paid")} paid, ${byType("free")} free, ${byType("stipend")} stipend`}
          href="/admin/students"
        />
        <Kpi
          label={`Money in, ${monthName}`}
          value={inr(moneyIn)}
          sub={pendingFees > 0 ? `${inr(pendingFees)} fees pending` : "No fees pending"}
          tone={pendingFees > 0 ? "warn" : undefined}
          href="/admin/payments"
        />
        <Kpi label="Awaiting acceptance" value={awaiting.count ?? 0} sub="documents sent to students" href="/admin/documents?status=awaiting" />
      </KpiGrid>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Needs attention"
            info="Each item opens the exact screen where it is fixed."
            actions={attn.length ? <Pill tone="warn">{plural(attn.length, "item")}</Pill> : undefined}
          />
          {attn.length ? (
            <ul>
              {attn.map((r) => {
                const Icon = attentionIcon(r);
                return (
                  <li key={r.key} className="border-t border-line first:border-t-0">
                    <Link href={attentionHref(r)} className="flex min-h-[52px] items-center gap-3 px-4 py-2.5 text-fg no-underline transition-colors hover:bg-hover">
                      <span className={cn("grid size-[34px] shrink-0 place-items-center rounded-[9px]", toneClass(r.tone))}>
                        <Icon className="size-[17px]" aria-hidden />
                      </span>
                      <b className="min-w-0 flex-1 text-sm font-semibold">{attentionText(r)}</b>
                      <ChevronRight className="size-4 shrink-0 text-fg-3" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-fg-3">Nothing needs attention today.</p>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Running batches"
            actions={
              <ButtonLink href="/admin/batches" variant="ghost" size="sm">
                All batches
              </ButtonLink>
            }
          />
          {running.length ? (
            <ul>
              {running.map((p) => {
                const b = names.get(p.batch_id);
                const course = b?.course_plans?.courses?.name;
                const name = course && b?.course_plans ? `${course}, ${b.course_plans.duration_days} days` : p.code;
                const behind = p.days_behind > 0;
                const pct = p.planned > 0 ? (p.done / p.planned) * 100 : 0;
                const dayX = Math.min(Math.max(p.day_x, 1), p.day_n);
                return (
                  <li key={p.batch_id} className="border-t border-line first:border-t-0">
                    <Link href={`/admin/batches/${encodeURIComponent(p.code)}`} className="flex items-center gap-3 px-4 py-3 text-fg no-underline transition-colors hover:bg-hover">
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-sm font-semibold">{name}</b>
                        <small className="block truncate text-xs text-fg-3">
                          {p.code}, day {dayX} of {p.day_n}
                        </small>
                        <span className="mt-2 block">
                          <Bar pct={pct} tone={behind ? "warn" : "acc"} label={`${p.done} of ${p.planned} planned items done`} />
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        {behind ? (
                          <Pill tone="warn" dot>
                            {plural(p.days_behind, "day")} behind
                          </Pill>
                        ) : (
                          <Pill tone="ok" dot>
                            On track
                          </Pill>
                        )}
                        <small className="mt-1.5 block text-xs text-fg-3">
                          {p.done} of {p.planned} done
                        </small>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-fg-3">No batch is running right now.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Lead funnel, ${monthName}`} info="Leads created this month, by the stage they are in now." />
          <div className="flex flex-col gap-1 p-4">
            {funnelStages.map((s) => {
              const n = stageCounts.get(s) ?? 0;
              return (
                <Link
                  key={s}
                  href={`/admin/leads?stage=${s}`}
                  className="grid grid-cols-[92px_minmax(0,1fr)_32px] items-center gap-2.5 rounded-md py-1 text-sm text-fg no-underline hover:bg-hover"
                >
                  <span className="text-fg-2">{STAGE[s].label}</span>
                  <span className="h-5 overflow-hidden rounded-md bg-surface-2">
                    <span
                      className={cn("block h-full rounded-md", s === "converted" ? "bg-ok" : "bg-accent")}
                      style={{ width: `${Math.round((n / maxStage) * 100)}%` }}
                    />
                  </span>
                  <b className="text-right tabular-nums">{n}</b>
                </Link>
              );
            })}
            <p className="mt-2 text-xs text-fg-3">
              {totalMonth
                ? `${Math.round((converted / totalMonth) * 100)}% of this month’s ${plural(totalMonth, "lead")} converted. ${lost} lost, with the reason saved on each lead.`
                : "No leads yet this month."}
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent activity" />
          {recent.length ? (
            <ul className="p-4">
              {recent.map((a, i) => {
                const { icon: Icon, tone } = ACT_ICON[a.kind] ?? ACT_ICON.note;
                const who = a.students?.full_name ?? a.leads?.full_name;
                const href = a.students?.code
                  ? `/admin/students/${encodeURIComponent(a.students.code)}`
                  : a.lead_id
                    ? `/admin/leads?open=${a.lead_id}`
                    : "/admin/leads";
                return (
                  <li key={a.id} className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
                    {i < recent.length - 1 ? <span className="absolute top-8 bottom-0.5 left-[13.5px] w-px bg-line" aria-hidden /> : null}
                    <span className={cn("grid size-7 place-items-center rounded-full", toneClass(tone))}>
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <Link href={href} className="min-w-0 rounded-md text-fg no-underline hover:bg-hover">
                      <b className="block text-sm font-semibold">
                        {ACTIVITY_LABEL[a.kind]}
                        {who ? `, ${who}` : ""}
                      </b>
                      <p className="line-clamp-2 text-sm text-fg-2">{a.summary}</p>
                      <small className="text-xs text-fg-3">{relTime(a.occurred_at, now)}</small>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-fg-3">No activity yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
