import Link from "next/link";
import { FileText, Mail, Phone, RefreshCw, StickyNote, Trash2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Drawer } from "@/components/drawer";
import { ActionForm, CopyButton, FieldError, SubmitButton } from "@/components/toast";
import { Avatar, ButtonLink, DL, EmptyState, Field, FormGrid, IconAnchor, Input, Notice, RadioSegment, Select, Textarea, toneClass } from "@/components/ui";
import { WhatsAppIcon, waLink } from "@/components/icons";
import { ACTIVITY_LABEL, LOST_REASON_LABEL, SOURCE_LABEL, STAGE } from "@/lib/labels";
import { hrefWith, type SearchParams } from "@/lib/url";
import { cn, formatDateTime } from "@/lib/utils";
import { formatPhone } from "@/lib/phone";
import { uuid } from "@/lib/validators";
import { OPEN_STAGES, answerRows, daysAgoText, prettySummary } from "@/lib/leads/view";
import { logActivity, markLost, restoreLead, updateLead } from "@/server/actions/leads";
import type { Activity, ActivityKind, Lead, Tone } from "@/lib/types";

const PATH = "/admin/leads";
const HISTORY_LIMIT = 20;

const KIND_ICON: Record<ActivityKind, { icon: React.ReactNode; tone: Tone }> = {
  call: { icon: <Phone aria-hidden />, tone: "acc" },
  whatsapp: { icon: <WhatsAppIcon />, tone: "ok" },
  email: { icon: <Mail aria-hidden />, tone: "info" },
  meeting: { icon: <Users aria-hidden />, tone: "vio" },
  note: { icon: <StickyNote aria-hidden />, tone: "mute" },
  system: { icon: <RefreshCw aria-hidden />, tone: "mute" },
};

const LOG_KINDS = (["call", "whatsapp", "email", "meeting", "note"] as const).map((k) => ({ value: k, label: ACTIVITY_LABEL[k] }));

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-fg-2">{children}</h3>;
}

export async function LeadPanel({
  id,
  lost,
  params,
  closeHref,
  today,
}: {
  id: string;
  lost: boolean;
  params: SearchParams;
  closeHref: string;
  today: string;
}) {
  const notFound = (
    <Drawer closeHref={closeHref} title="Lead not found">
      <EmptyState title="This lead was not found">It may have been removed, or the link is incomplete.</EmptyState>
    </Drawer>
  );
  if (!uuid.safeParse(id).success) return notFound;

  const supabase = await createClient();
  const [leadRes, actRes] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("activities")
      .select("id, lead_id, student_id, enrollment_id, kind, summary, outcome, occurred_at, created_by")
      .eq("lead_id", id)
      .order("occurred_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);
  const lead = leadRes.data as Lead | null;
  if (!lead) return notFound;
  const activities = (actRes.data ?? []) as Activity[];

  let studentCode: string | null = null;
  if (lead.student_id) {
    const { data } = await supabase.from("students").select("code").eq("id", lead.student_id).maybeSingle();
    studentCode = (data as { code: string } | null)?.code ?? null;
  }

  const panelHref = hrefWith(PATH, params, { open: lead.id, lost: null, new: null });
  const isOpen = OPEN_STAGES.includes(lead.stage);
  const isLost = lead.stage === "lost";
  const isConverted = lead.stage === "converted";

  const icons = (
    <>
      {lead.phone ? (
        <IconAnchor href={waLink(lead.phone)} label={`WhatsApp ${lead.full_name}`} className="text-wa">
          <WhatsAppIcon />
        </IconAnchor>
      ) : null}
      {lead.phone ? <CopyButton icon="phone" text={lead.phone} label={`Copy mobile ${formatPhone(lead.phone)}`} /> : null}
      {lead.email ? <CopyButton icon="mail" text={lead.email} label={`Copy email ${lead.email}`} /> : null}
    </>
  );
  const head = { closeHref, title: lead.full_name, lead: <Avatar name={lead.full_name} size="lg" />, icons };

  /* ---------- Mark lost (small form) ---------- */
  if (lost && isOpen) {
    return (
      <Drawer
        {...head}
        sub="Mark as lost"
        footer={
          <>
            <ButtonLink href={panelHref} scroll={false} variant="ghost">
              Cancel
            </ButtonLink>
            <span className="flex-1 max-md:hidden" />
            <SubmitButton form="lead-lost" variant="danger" pendingText="Saving…">
              Mark lost
            </SubmitButton>
          </>
        }
      >
        <ActionForm action={markLost} undo={restoreLead} closeHref={panelHref} id="lead-lost" className="flex flex-col gap-3.5">
          <p className="text-sm text-fg-2">
            The lead moves to Lost with the reason saved. You can undo right after, or re-open the lead later.
          </p>
          <input type="hidden" name="id" value={lead.id} />
          <Field label="Reason" htmlFor="ll-reason" required>
            <Select id="ll-reason" name="lost_reason" defaultValue="" required>
              <option value="" disabled>
                Pick a reason
              </option>
              {Object.entries(LOST_REASON_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <FieldError name="lost_reason" />
          </Field>
          <Field label="Note" htmlFor="ll-note" hint="Optional. For example: joined another institute in Rajkot.">
            <Textarea id="ll-note" name="lost_note" maxLength={500} />
            <FieldError name="lost_note" />
          </Field>
        </ActionForm>
      </Drawer>
    );
  }

  /* ---------- Lead details ---------- */
  const age = daysAgoText(lead.submitted_at ?? lead.created_at, today);
  const courseYear = [lead.course, lead.year_of_study ? `year ${lead.year_of_study}` : null].filter(Boolean).join(", ");
  const details: [React.ReactNode, React.ReactNode][] = [
    ["Code", lead.code],
    ["Interested in", lead.interested_track ?? "—"],
    ["Source", age ? `${SOURCE_LABEL[lead.source]}, ${age}` : SOURCE_LABEL[lead.source]],
    ["Mobile", formatPhone(lead.phone)],
  ];
  if (lead.email) details.push(["Email", lead.email]);
  if (courseYear) details.push(["Course", courseYear]);
  if (lead.last_contacted_at) details.push(["Last contact", formatDateTime(lead.last_contacted_at)]);
  if (isLost && lead.lost_reason) {
    details.push(["Lost reason", lead.lost_note ? `${LOST_REASON_LABEL[lead.lost_reason]}. ${lead.lost_note}` : LOST_REASON_LABEL[lead.lost_reason]]);
  }

  const answers = answerRows(lead.answers);
  const history = activities.map((a) => ({
    id: a.id,
    kind: a.kind,
    title: a.outcome ? `${ACTIVITY_LABEL[a.kind]}, ${a.outcome}` : ACTIVITY_LABEL[a.kind],
    text: prettySummary(a.summary),
    when: formatDateTime(a.occurred_at),
  }));
  const showFormItem = lead.source === "form" && activities.length < HISTORY_LIMIT;

  const footer = isOpen ? (
    <>
      <ButtonLink href={hrefWith(PATH, params, { open: lead.id, lost: 1, new: null })} scroll={false} variant="danger">
        <Trash2 aria-hidden />
        Mark lost
      </ButtonLink>
      <span className="flex-1 max-md:hidden" />
      <ButtonLink href={`/admin/students?new=1&lead=${lead.id}`} variant="primary">
        Convert to student
      </ButtonLink>
    </>
  ) : undefined;

  return (
    <Drawer {...head} sub={lead.college ?? lead.code} footer={footer}>
      {isConverted ? (
        <Notice tone="success">
          Converted to student{" "}
          {studentCode ? (
            <Link href={`/admin/students/${encodeURIComponent(studentCode)}`} className="font-semibold text-accent-ink">
              {studentCode}
            </Link>
          ) : (
            "(record not found)"
          )}
          . Edit the person in Students from now on.
        </Notice>
      ) : null}
      {isLost ? <Notice tone="warn">This lead is marked lost. Pick a stage below to re-open it.</Notice> : null}

      {!isConverted ? (
        <ActionForm
          key={`${lead.stage}-${lead.next_follow_up_on ?? ""}`}
          action={updateLead}
          id="lead-stage"
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="id" value={lead.id} />
          <FormGrid>
            <Field label={isLost ? "Re-open as" : "Stage"} htmlFor="ld-stage">
              <Select id="ld-stage" name="stage" defaultValue={isLost ? "contacted" : lead.stage}>
                {OPEN_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {STAGE[st].label}
                  </option>
                ))}
              </Select>
              <FieldError name="stage" />
            </Field>
            <Field label="Next follow-up" htmlFor="ld-next">
              <Input id="ld-next" name="next_follow_up_on" type="date" defaultValue={lead.next_follow_up_on ?? ""} />
              <FieldError name="next_follow_up_on" />
            </Field>
          </FormGrid>
          <div className="flex justify-end">
            <SubmitButton variant="secondary">{isLost ? "Re-open lead" : "Save"}</SubmitButton>
          </div>
        </ActionForm>
      ) : null}

      <DL items={details} />

      {answers.length ? (
        <section className="flex flex-col gap-2.5">
          <SectionTitle>Form answers</SectionTitle>
          <DL
            items={answers.map((r) => [
              r.label,
              r.href ? (
                <a href={r.href} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-ink">
                  {hostOf(r.href)}
                </a>
              ) : (
                <span className="whitespace-pre-line">{r.text}</span>
              ),
            ])}
          />
        </section>
      ) : null}

      {!isConverted ? (
        <ActionForm key={`log-${activities[0]?.id ?? "none"}`} action={logActivity} id="lead-log" className="flex flex-col gap-3 border-t border-line pt-4">
          <SectionTitle>Log an activity</SectionTitle>
          <input type="hidden" name="lead_id" value={lead.id} />
          <RadioSegment name="kind" label="Type" options={LOG_KINDS} defaultValue="call" />
          <Field label="What happened" htmlFor="la-summary" required>
            <Textarea id="la-summary" name="summary" maxLength={1000} placeholder="Shared the 60-day plan. Will confirm after talking to parents." />
            <FieldError name="summary" />
          </Field>
          <Field label="Outcome" htmlFor="la-outcome" hint="Optional, a few words. For example: will call back Monday.">
            <Input id="la-outcome" name="outcome" maxLength={200} autoComplete="off" />
            <FieldError name="outcome" />
          </Field>
          <div className="flex justify-end">
            <SubmitButton variant="secondary">Save activity</SubmitButton>
          </div>
        </ActionForm>
      ) : null}

      <section className="flex flex-col gap-2.5 border-t border-line pt-4">
        <SectionTitle>History</SectionTitle>
        {history.length || showFormItem ? (
          <ul className="flex flex-col gap-3.5">
            {history.map((h) => (
              <TimelineItem key={h.id} icon={KIND_ICON[h.kind].icon} tone={KIND_ICON[h.kind].tone} title={h.title} text={h.text} when={h.when} />
            ))}
            {showFormItem ? (
              <TimelineItem
                icon={<FileText aria-hidden />}
                tone="info"
                title="Form submitted"
                text={lead.interested_track ? `Applied for ${lead.interested_track}` : "Applied on the Google Form"}
                when={formatDateTime(lead.submitted_at ?? lead.created_at)}
              />
            ) : null}
          </ul>
        ) : (
          <p className="text-sm text-fg-3">Nothing logged yet.</p>
        )}
      </section>
    </Drawer>
  );
}

function hostOf(href: string): string {
  try {
    const u = new URL(href);
    return u.hostname.replace(/^www\./, "") + (u.pathname.length > 1 ? u.pathname.slice(0, 24) + (u.pathname.length > 24 ? "…" : "") : "");
  } catch {
    return href;
  }
}

function TimelineItem({ icon, tone, title, text, when }: { icon: React.ReactNode; tone: Tone; title: string; text: string; when: string }) {
  return (
    <li className="flex gap-3">
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4", toneClass(tone))}>{icon}</span>
      <div className="min-w-0 text-sm">
        <b className="block font-semibold">{title}</b>
        <p className="break-words whitespace-pre-line text-fg-2">{text}</p>
        <small className="text-xs text-fg-3">{when}</small>
      </div>
    </li>
  );
}
