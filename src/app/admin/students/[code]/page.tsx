import { notFound } from "next/navigation";
import { ArchiveRestore, TriangleAlert } from "lucide-react";
import { WhatsAppIcon, waLink } from "@/components/icons";
import { ActionButton, CopyButton } from "@/components/toast";
import { Avatar, Crumbs, IconAnchor, Meta, Notice, PageHeader, Pill } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { DISPLAY_STATUS, TYPE } from "@/lib/labels";
import { formatPhone } from "@/lib/phone";
import { hrefWith, sp, type SearchParams } from "@/lib/url";
import type { EnrollmentStats, StudentListRow } from "@/lib/types";
import { restoreStudent } from "@/server/actions/students";
import { STUDENTS_PATH, studentHref, yearFolder, type FeeBalance } from "../_parts/shared";
import { DocumentsCard, EnrolmentCard, FilesCard, PaymentsCard, ProfileCard, TimelineCard } from "./_parts/cards";
import { ArchivePanel, AssignPanel, ChangePanel, EditPanel, RemovePanel } from "./_parts/panels";
import {
  OPEN_STATUSES,
  type ActivityRow,
  type AgreementRow,
  type BatchOption,
  type ChangeRow,
  type DocRow,
  type EnrolmentRow,
  type MoneyRow,
  type StudentRow,
} from "./_parts/data";

const PLAN_SELECT = "id, duration_days, fee_inr, course:courses(code, name)";

export default async function Student360({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ code: rawCode }, query] = await Promise.all([params, searchParams]);
  let code: string;
  try {
    code = decodeURIComponent(rawCode);
  } catch {
    notFound();
  }
  const supabase = await createClient();

  const { data: sData } = await supabase.from("students").select("*").eq("code", code).maybeSingle();
  const s = sData as StudentRow | null;
  if (!s) notFound();

  const base = studentHref(s.code);
  const panel = sp(query, "panel");
  const href = (changes: Record<string, string | null>) => hrefWith(base, query, changes);
  const closeHref = href({ panel: null, e: null });

  const activityQuery = supabase
    .from("activities")
    .select("id, kind, summary, outcome, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(15);

  const [listRes, enrolRes, statsRes, fbRes, moneyRes, docsRes, actRes, settingsRes, ayRes] = await Promise.all([
    supabase.from("v_student_list").select("type, display_status").eq("id", s.id).maybeSingle(),
    supabase
      .from("enrollments")
      .select(
        `id, batch_id, type, status, assigned_on, start_date, end_date, fee_inr, free_reason, exit_reason, capacity_override_reason, created_by,
         batch:batches(id, code, course_plan:course_plans(${PLAN_SELECT}))`,
      )
      .eq("student_id", s.id)
      .order("start_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("v_enrollment_stats").select("*").eq("student_id", s.id),
    supabase.from("v_fee_balance").select("agreed, paid, refunded, pending").eq("student_id", s.id).maybeSingle(),
    supabase
      .from("money_entries")
      .select("id, category, direction, amount_inr, status, paid_on, due_on, mode")
      .eq("student_id", s.id)
      .neq("status", "void")
      .order("paid_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("v_document_list").select("id, type, number, display_status").eq("student_id", s.id).order("issued_at", { ascending: false, nullsFirst: true }),
    s.lead_id ? activityQuery.or(`student_id.eq.${s.id},lead_id.eq.${s.lead_id}`) : activityQuery.eq("student_id", s.id),
    supabase.from("org_settings").select("local_files_root, min_attendance_pct, min_task_pct").eq("id", 1).maybeSingle(),
    supabase.rpc("academic_year_label", { p_at: s.created_at }),
  ]);

  const listRow = listRes.data as Pick<StudentListRow, "type" | "display_status"> | null;
  const enrolments = (enrolRes.data ?? []) as unknown as EnrolmentRow[];
  const current = enrolments.find((e) => OPEN_STATUSES.includes(e.status)) ?? null;
  const past = enrolments.filter((e) => e !== current);
  const statsAll = (statsRes.data ?? []) as EnrollmentStats[];
  const stats = current ? statsAll.find((x) => x.enrollment_id === current.id) ?? null : null;
  const fb = fbRes.data as FeeBalance | null;
  const settings = settingsRes.data as { local_files_root: string; min_attendance_pct: number; min_task_pct: number } | null;
  const minAtt = settings?.min_attendance_pct ?? 75;
  const minTask = settings?.min_task_pct ?? 70;

  // The enrolment a panel acts on (?e=…), defaulting to the current one; only open enrolments can change.
  const eParam = sp(query, "e");
  const target = (eParam ? enrolments.find((e) => e.id === eParam) : current) ?? null;
  const targetOpen = target && OPEN_STATUSES.includes(target.status) ? target : null;

  const [agreementRes, creatorRes, historyRes, batchRes] = await Promise.all([
    current?.type === "stipend" || (panel === "change" && targetOpen)
      ? supabase
          .from("stipend_agreements")
          .select("id, enrollment_id, monthly_inr, from_month, to_month, agreed_note")
          .eq("enrollment_id", (panel === "change" && targetOpen ? targetOpen : current)!.id)
          .order("from_month", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    current?.created_by
      ? supabase.from("profiles").select("full_name, email").eq("id", current.created_by).maybeSingle()
      : Promise.resolve({ data: null }),
    panel === "change" && targetOpen
      ? supabase
          .from("enrollment_changes")
          .select("id, change, from_value, to_value, reason, changed_at")
          .eq("enrollment_id", targetOpen.id)
          .order("changed_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    panel === "assign"
      ? supabase
          .from("batches")
          .select(`id, code, capacity, status, start_date, course_plan_id, course_plan:course_plans(${PLAN_SELECT})`)
          .in("status", ["planned", "running"])
          .order("start_date")
      : Promise.resolve({ data: [] }),
  ]);
  const agreement = agreementRes.data as AgreementRow | null;
  const creator = creatorRes.data as { full_name: string | null; email: string } | null;
  const history = (historyRes.data ?? []) as ChangeRow[];
  const batches = (batchRes.data ?? []) as unknown as BatchOption[];

  let seats: Record<string, number> = {};
  if (panel === "assign" && batches.length) {
    const { data } = await supabase
      .from("enrollments")
      .select("batch_id")
      .in("batch_id", batches.map((b) => b.id))
      .in("status", OPEN_STATUSES);
    seats = ((data ?? []) as { batch_id: string }[]).reduce<Record<string, number>>((acc, r) => {
      acc[r.batch_id] = (acc[r.batch_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  const root = settings?.local_files_root ?? "";
  const folder = `${root}${root && !/[\\/]$/.test(root) ? "\\" : ""}${yearFolder(ayRes.data as string | null)}\\students\\${s.code}_${s.full_name
    .trim()
    .split(/\s+/)
    .join("-")}\\`;

  const type = listRow?.type ?? current?.type ?? s.planned_type;
  const status = listRow ? DISPLAY_STATUS[listRow.display_status] : null;
  const wa = waLink(s.phone);
  const courseYear = [s.course, s.year_of_study ? `year ${s.year_of_study}` : null].filter(Boolean).join(", ");
  const archived = s.state === "archived";

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <Crumbs items={[{ label: "Students", href: STUDENTS_PATH }, { label: s.full_name }]} />
      <PageHeader
        lead={<Avatar name={s.full_name} size="xl" />}
        title={s.full_name}
        description={
          <div className="flex flex-col gap-2">
            <Meta items={[s.code, s.college, courseYear || null]} />
            <div className="flex flex-wrap gap-2">
              {type ? <Pill tone={TYPE[type].tone}>{TYPE[type].label}</Pill> : null}
              {status ? (
                <Pill tone={status.tone} dot>
                  {status.label}
                </Pill>
              ) : null}
            </div>
          </div>
        }
        actions={
          <>
            {wa ? (
              <IconAnchor href={wa} label={`WhatsApp ${s.full_name}`} outline>
                <WhatsAppIcon className="text-wa" />
              </IconAnchor>
            ) : null}
            <CopyButton text={s.phone} label={`Copy mobile ${formatPhone(s.phone)}`} outline />
            <CopyButton text={s.email} label={`Copy email ${s.email}`} outline />
          </>
        }
      />

      {archived ? (
        <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Archived{s.archived_reason ? `: ${s.archived_reason}` : ""}. Restore to assign a batch again.</span>
            <ActionButton action={restoreStudent.bind(null, s.id)} variant="secondary">
              <ArchiveRestore aria-hidden />
              Restore student
            </ActionButton>
          </div>
        </Notice>
      ) : null}

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <EnrolmentCard
            current={current}
            past={past}
            stats={stats}
            agreement={current?.type === "stipend" && agreement?.enrollment_id === current.id ? agreement : null}
            assignedBy={creator ? creator.full_name || creator.email : null}
            minAtt={minAtt}
            minTask={minTask}
            archived={archived}
            href={href}
          />
          <TimelineCard items={(actRes.data ?? []) as ActivityRow[]} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <ProfileCard s={s} editHref={href({ panel: "edit", e: null })} />
          <PaymentsCard entries={(moneyRes.data ?? []) as MoneyRow[]} fb={fb} href={`/admin/payments?q=${encodeURIComponent(s.full_name)}`} />
          <DocumentsCard docs={(docsRes.data ?? []) as DocRow[]} href={`/admin/documents?q=${encodeURIComponent(s.code)}`} />
          <FilesCard path={folder} />
        </div>
      </div>

      {panel === "assign" && !archived ? <AssignPanel s={s} batches={batches} seats={seats} closeHref={closeHref} /> : null}
      {panel === "change" && targetOpen ? (
        <ChangePanel
          s={s}
          e={targetOpen}
          agreement={agreement}
          history={history}
          closeHref={closeHref}
          removeHref={href({ panel: "remove", e: targetOpen.id })}
        />
      ) : null}
      {panel === "remove" && targetOpen ? <RemovePanel s={s} e={targetOpen} closeHref={closeHref} /> : null}
      {panel === "edit" ? <EditPanel s={s} closeHref={closeHref} archiveHref={href({ panel: "archive", e: null })} /> : null}
      {panel === "archive" && !archived ? (
        <ArchivePanel s={s} hasOpen={Boolean(current)} closeHref={closeHref} cancelHref={href({ panel: "edit", e: null })} />
      ) : null}
    </div>
  );
}
