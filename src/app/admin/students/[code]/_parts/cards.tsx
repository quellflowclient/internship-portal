/** Student 360 cards. Enrolment and Profile own their data; the rest are read-only windows with a link to the owner screen. */
import * as React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleCheck,
  ExternalLink,
  Info,
  Layers,
  Mail,
  MessageCircle,
  Pen,
  Phone,
  StickyNote,
  Trash2,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import { CopyButton } from "@/components/toast";
import { prettySummary } from "@/lib/leads/view";
import { ButtonLink, Card, CardHeader, DL, IconLink, Meta, Notice, Pill } from "@/components/ui";
import { ACTIVITY_LABEL, DOC_DISPLAY, DOC_TYPE_LABEL, ENROLLMENT_STATUS, modeLabel, MONEY_CATEGORY_LABEL, TYPE } from "@/lib/labels";
import { formatPhone } from "@/lib/phone";
import { cn, formatDate, formatDateTime, formatDay, inr } from "@/lib/utils";
import type { ActivityKind, EnrollmentStats } from "@/lib/types";
import { planLabel, type FeeBalance } from "../../_parts/shared";
import { type ActivityRow, type AgreementRow, type DocRow, type EnrolmentRow, type MoneyRow, type StudentRow } from "./data";

const ROW = "flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-5 text-sm text-fg-3">{children}</p>;
}

/* ---------- Enrolment (owner) ---------- */
export function EnrolmentCard({
  current,
  past,
  stats,
  agreement,
  assignedBy,
  minAtt,
  minTask,
  archived,
  href,
}: {
  current: EnrolmentRow | null;
  past: EnrolmentRow[];
  stats: EnrollmentStats | null;
  agreement: AgreementRow | null;
  assignedBy: string | null;
  minAtt: number;
  minTask: number;
  archived: boolean;
  href: (changes: Record<string, string | null>) => string;
}) {
  return (
    <Card>
      <CardHeader
        title="Enrolment"
        info="Batch assignment, type change and removal from a batch happen only here."
        actions={
          current ? (
            <ButtonLink size="sm" href={href({ panel: "change", e: current.id })} scroll={false}>
              <Pen aria-hidden />
              Change
            </ButtonLink>
          ) : null
        }
      />
      <div className="flex flex-col gap-4 p-4">
        {current ? (
          <>
            <DL
              items={[
                ["Batch", current.batch ? `${current.batch.code}, ${planLabel(current.batch.course_plan)}` : null],
                ["Student type", TYPE[current.type].label],
                [
                  "Status",
                  <Pill key="s" tone={ENROLLMENT_STATUS[current.status].tone} dot>
                    {ENROLLMENT_STATUS[current.status].label}
                  </Pill>,
                ],
                ["Assigned on", `${formatDate(current.assigned_on)}${assignedBy ? ` by ${assignedBy}` : ""}`],
                ["Dates", `${formatDate(current.start_date)} to ${formatDate(current.end_date)}`],
                ...(current.type === "paid" ? ([["Agreed fee", inr(current.fee_inr)]] as [string, string][]) : []),
                ...(current.type === "free" ? ([["Why free", current.free_reason]] as [string, string | null][]) : []),
                ...(current.type === "stipend"
                  ? ([["Stipend", agreement ? `${inr(agreement.monthly_inr)} a month` : "No agreement yet"]] as [string, string][])
                  : []),
                ["Attendance", stats?.attendance_pct != null ? `${stats.attendance_pct}% (${stats.present} of ${stats.marked} sessions)` : "No sessions marked yet"],
                ["Tasks", stats?.tasks_pct != null ? `${stats.tasks_pct}% (${stats.done} of ${stats.given} done)` : "No tasks given yet"],
                ...(current.capacity_override_reason ? ([["Over capacity", current.capacity_override_reason]] as [string, string][]) : []),
              ]}
            />
            <Eligibility stats={stats} minAtt={minAtt} minTask={minTask} />
            {current.type === "stipend" && !agreement ? (
              <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
                Add the monthly stipend amount with Change. It is needed before the enrolment becomes active.
              </Notice>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <ButtonLink size="sm" href={href({ panel: "transfer", e: current.id })} scroll={false}>
                <Layers aria-hidden />
                Move to another batch
              </ButtonLink>
              <ButtonLink variant="danger" size="sm" href={href({ panel: "remove", e: current.id })} scroll={false}>
                <Trash2 aria-hidden />
                Remove from batch
              </ButtonLink>
            </div>
          </>
        ) : (
          <>
            <Notice icon={<Info aria-hidden />}>
              {archived
                ? "Archived students cannot be assigned. Restore the student first."
                : "Not in a batch yet. Assign a batch to start sessions, plan sharing and documents."}
            </Notice>
            {archived ? null : (
              <div>
                <ButtonLink variant="primary" href={href({ panel: "assign", e: null })} scroll={false}>
                  <Layers aria-hidden />
                  Assign to batch
                </ButtonLink>
              </div>
            )}
          </>
        )}
        {past.length ? (
          <div>
            <h3 className="mb-1.5 text-xs font-semibold text-fg-2">Earlier enrolments</h3>
            <ul className="rounded-lg border border-line">
              {past.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-sm last:border-b-0">
                  <span className="min-w-0">
                    <b className="block font-semibold break-words">{e.batch?.code ?? "Batch"}</b>
                    <small className="block truncate text-xs text-fg-3">
                      {TYPE[e.type].label}, {formatDate(e.start_date)}
                      {e.exit_reason ? `, ${e.exit_reason}` : ""}
                    </small>
                  </span>
                  <Pill tone={ENROLLMENT_STATUS[e.status].tone} dot>
                    {ENROLLMENT_STATUS[e.status].label}
                  </Pill>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function Eligibility({ stats, minAtt, minTask }: { stats: EnrollmentStats | null; minAtt: number; minTask: number }) {
  if (!stats || (stats.marked === 0 && stats.given === 0)) {
    return (
      <Notice icon={<Info aria-hidden />}>
        The certificate needs {minAtt}% attendance and {minTask}% of tasks done. Nothing is marked yet.
      </Notice>
    );
  }
  if (stats.eligible) {
    return (
      <Notice tone="success" icon={<CircleCheck aria-hidden />}>
        On track for the certificate: attendance {stats.attendance_pct ?? 0}% (needs {minAtt}%)
        {stats.tasks_pct != null ? `, tasks ${stats.tasks_pct}% (needs ${minTask}%)` : ""}.
      </Notice>
    );
  }
  const low: string[] = [];
  if ((stats.attendance_pct ?? 0) < minAtt) low.push(`attendance ${stats.attendance_pct ?? 0}% (needs ${minAtt}%)`);
  if (stats.tasks_pct != null && stats.tasks_pct < minTask) low.push(`tasks ${stats.tasks_pct}% (needs ${minTask}%)`);
  return (
    <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
      Below the minimum for the certificate: {low.join(", ") || "attendance or tasks"}.
    </Notice>
  );
}

/* ---------- Profile (owner) ---------- */
export function ProfileCard({ s, editHref }: { s: StudentRow; editHref: string }) {
  const course = [s.course, s.year_of_study ? `year ${s.year_of_study}` : null].filter(Boolean).join(", ");
  return (
    <Card>
      <CardHeader
        title="Profile"
        info="Student details are edited only here. Students can change their own mobile, city, GitHub and LinkedIn."
        actions={
          <IconLink href={editHref} scroll={false} label="Edit profile" outline>
            <Pen aria-hidden />
          </IconLink>
        }
      />
      <div className="p-4">
        <DL
          items={[
            ["Mobile", formatPhone(s.phone)],
            ["Email", s.email],
            ["Name on documents", s.name_on_documents],
            ["City", s.city],
            ["College", s.college],
            ["Course", course || null],
            ["GitHub", s.github_url ? <ExtLink key="g" href={s.github_url} /> : null],
            ["LinkedIn", s.linkedin_url ? <ExtLink key="l" href={s.linkedin_url} /> : null],
            ["Date of birth", s.dob ? formatDate(s.dob) : null],
          ]}
        />
      </div>
    </Card>
  );
}

function ExtLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-ink">
      {href.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")}
    </a>
  );
}

/* ---------- Payments (read-only) ---------- */
export function PaymentsCard({ entries, fb, href }: { entries: MoneyRow[]; fb: FeeBalance | null; href: string }) {
  return (
    <Card>
      <CardHeader
        title="Payments"
        info="Read-only here. Payments are recorded and edited only in Payments."
        actions={
          <IconLink href={href} label="Open in Payments (record or edit there)" outline>
            <ExternalLink aria-hidden />
          </IconLink>
        }
      />
      {entries.length ? (
        <ul>
          {entries.map((m) => {
            const inflow = m.direction === "in";
            const Icon = inflow ? ArrowDownLeft : ArrowUpRight;
            const expected = m.status === "expected";
            return (
              <li key={m.id} className={ROW}>
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4", inflow ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")}>
                  <Icon aria-label={inflow ? "Money in" : "Money out"} />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-sm font-semibold break-words">{MONEY_CATEGORY_LABEL[m.category]}</b>
                  <small className="block truncate text-xs text-fg-3">
                    {expected
                      ? `Due ${formatDay(m.due_on)}`
                      : [formatDay(m.paid_on), m.mode ? modeLabel(m.mode) : null].filter(Boolean).join(", ")}
                  </small>
                </span>
                <b className={cn("text-sm whitespace-nowrap", expected ? "text-fg-3" : inflow ? "text-ok" : "text-bad")}>
                  {inflow ? "+" : "−"}
                  {inr(m.amount_inr)}
                </b>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>No payments recorded.</Empty>
      )}
      {fb && fb.agreed > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
          <Meta className="text-fg-2" items={[`Agreed ${inr(fb.agreed)}`, `Paid ${inr(fb.paid)}`, fb.refunded ? `Refunded ${inr(fb.refunded)}` : null]} />
          {fb.pending > 0 ? <Pill tone="warn">{inr(fb.pending)} pending</Pill> : <Pill tone="ok">Fee paid</Pill>}
        </div>
      ) : null}
    </Card>
  );
}

/* ---------- Documents (read-only) ---------- */
export function DocumentsCard({ docs, href }: { docs: DocRow[]; href: string }) {
  return (
    <Card>
      <CardHeader
        title="Documents"
        info="Read-only here. Documents are issued and revoked only in Documents."
        actions={
          <IconLink href={href} label="Open in Documents (issue or revoke there)" outline>
            <ExternalLink aria-hidden />
          </IconLink>
        }
      />
      {docs.length ? (
        <ul>
          {docs.map((d) => {
            const st = DOC_DISPLAY[d.display_status] ?? { label: d.display_status, tone: "mute" as const };
            return (
              <li key={d.id} className={ROW}>
                <span className="min-w-0 flex-1">
                  <b className="block text-sm font-semibold break-words">{DOC_TYPE_LABEL[d.type]}</b>
                  <small className="block truncate text-xs text-fg-3">{d.number ?? "Draft"}</small>
                </span>
                <Pill tone={st.tone} dot>
                  {st.label}
                </Pill>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>No documents yet.</Empty>
      )}
    </Card>
  );
}

/* ---------- Timeline ---------- */
const KIND_ICON: Record<ActivityKind, LucideIcon> = {
  call: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  meeting: Users,
  note: StickyNote,
  system: Info,
};

export function TimelineCard({ items }: { items: ActivityRow[] }) {
  return (
    <Card>
      <CardHeader title="Timeline" info="Calls, messages and automatic updates, newest first. The lead history is included." />
      {items.length ? (
        <ul className="flex flex-col gap-4 p-4">
          {items.map((a) => {
            const Icon = KIND_ICON[a.kind];
            return (
              <li key={a.id} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink [&_svg]:size-4">
                  <Icon aria-hidden />
                </span>
                <div className="min-w-0 text-sm">
                  <b className="block font-semibold break-words">{prettySummary(a.summary)}</b>
                  {a.outcome ? <p className="text-fg-2 break-words">{a.outcome}</p> : null}
                  <Meta className="text-xs text-fg-3" items={[ACTIVITY_LABEL[a.kind], formatDateTime(a.occurred_at)]} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>Nothing logged yet.</Empty>
      )}
    </Card>
  );
}

/* ---------- Files on the office PC ---------- */
export function FilesCard({ path }: { path: string }) {
  return (
    <Card>
      <CardHeader title="Files on the office PC" info="The root folder is set in Settings. Nothing is uploaded to the portal." />
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 py-1 pr-1 pl-3">
          <code className="min-w-0 flex-1 text-xs break-all">{path}</code>
          <CopyButton text={path} label="Copy folder path" small />
        </div>
        <small className="text-xs text-fg-3">KYC, payment screenshots and signed PDFs. The portal stores only this path.</small>
      </div>
    </Card>
  );
}
