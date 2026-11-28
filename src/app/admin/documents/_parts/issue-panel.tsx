import { Eye } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { SubmitButton } from "@/components/toast";
import { Button, ButtonLink, Notice } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { DOC_TYPE_LABEL, ENROLLMENT_STATUS } from "@/lib/labels";
import type { DocType, EnrollmentStatus, Profile } from "@/lib/types";
import { sp, type SearchParams } from "@/lib/url";
import { DOC_TYPES } from "@/server/documents/rules";
import type { DocData } from "@/server/documents/snapshot";
import { IssueForm } from "./issue-form";
import { isUuid, type IssueInitial, type SignatoryChoice, type StudentChoice, type TemplateChoice } from "./shared";

type StudentRow = {
  id: string;
  code: string;
  full_name: string;
  enrollments: { id: string; type: string; status: EnrollmentStatus; start_date: string; batch: { code: string } | null }[];
  project_members: { project: { id: string; name: string; kind: string } | null }[];
};

type DraftRow = {
  id: string;
  type: DocType;
  student_id: string;
  enrollment_id: string | null;
  project_id: string | null;
  issue_note: string | null;
  event: { title?: string | null; dates?: string | null } | null;
  data: Partial<DocData> | null;
  signatory_id: string | null;
  supersedes_id: string | null;
  version: number;
};

const STUDENT_FIELDS =
  "id, code, full_name, enrollments(id, type, status, start_date, batch:batches(code)), project_members(project:projects(id, name, kind))";
const FORM_ID = "f-doc";

/** Documents → ?new=1 (prefill: type, student, enrollment) or ?new=1&draft=<id> (edit a draft / a new version). */
export async function IssuePanel({ params, profile, closeHref }: { params: SearchParams; profile: Profile; closeHref: string }) {
  const supabase = await createClient();
  const draftParam = sp(params, "draft");
  const draftRes = isUuid(draftParam)
    ? await supabase
        .from("documents")
        .select("id, type, student_id, enrollment_id, project_id, issue_note, event, data, signatory_id, supersedes_id, version")
        .eq("id", draftParam)
        .eq("status", "draft")
        .maybeSingle()
    : { data: null };
  const draft = draftRes.data as DraftRow | null;
  const prefillStudent = draft?.student_id ?? sp(params, "student");

  const [studentsRes, extraRes, statsRes, tplRes, sigRes, supRes] = await Promise.all([
    supabase.from("students").select(STUDENT_FIELDS).in("state", ["active", "alumni"]).order("full_name"),
    isUuid(prefillStudent) ? supabase.from("students").select(STUDENT_FIELDS).eq("id", prefillStudent).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("v_enrollment_stats").select("enrollment_id, attendance_pct, tasks_pct, eligible"),
    supabase.from("document_templates").select("id, type, version, title, background_path").eq("active", true),
    supabase.from("signatories").select("id, name, title, title_on_docs, profile_id").eq("is_active", true).order("sort"),
    draft?.supersedes_id ? supabase.from("documents").select("number").eq("id", draft.supersedes_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const rows = (studentsRes.data ?? []) as unknown as StudentRow[];
  const extra = extraRes.data as unknown as StudentRow | null;
  if (extra && !rows.some((r) => r.id === extra.id)) rows.unshift(extra);
  const stats = new Map(
    ((statsRes.data ?? []) as { enrollment_id: string; attendance_pct: number | null; tasks_pct: number | null; eligible: boolean }[]).map((s) => [
      s.enrollment_id,
      s,
    ]),
  );
  const students: StudentChoice[] = rows.map((s) => ({
    id: s.id,
    label: `${s.full_name}, ${s.code}`,
    enrolments: [...(s.enrollments ?? [])]
      .filter((e) => e.status !== "transferred")
      .sort((a, b) => b.start_date.localeCompare(a.start_date))
      .map((e) => {
        const st = stats.get(e.id);
        return {
          id: e.id,
          label: `${e.batch?.code ?? "Batch"}, ${ENROLLMENT_STATUS[e.status]?.label ?? e.status}`,
          type: e.type,
          status: e.status,
          attendance: st?.attendance_pct ?? null,
          tasks: st?.tasks_pct ?? null,
          eligible: !!st?.eligible,
        };
      }),
    projects: (s.project_members ?? []).flatMap((m) => (m.project ? [m.project] : [])),
  }));

  const templates = (tplRes.data ?? []) as TemplateChoice[];
  const sigRows = (sigRes.data ?? []) as { id: string; name: string; title: string; title_on_docs: string | null; profile_id: string | null }[];
  const mine = sigRows.find((r) => r.profile_id === profile.id) ?? null;
  const signatories: SignatoryChoice[] = sigRows.map((r) => ({
    id: r.id,
    label: `${r.name}, ${r.title_on_docs?.trim() || r.title}${r.profile_id === profile.id ? " (you)" : ""}`,
    mine: r.profile_id === profile.id,
  }));

  const typeParam = sp(params, "type");
  const type = draft?.type ?? ((DOC_TYPES as string[]).includes(typeParam ?? "") ? (typeParam as DocType) : "offer");
  const initial: IssueInitial = {
    draftId: draft?.id ?? "",
    type,
    studentId: students.some((s) => s.id === prefillStudent) ? (prefillStudent as string) : "",
    enrollmentId: draft?.enrollment_id ?? (isUuid(sp(params, "enrollment")) ? (sp(params, "enrollment") as string) : ""),
    projectId: draft?.project_id ?? "",
    body: draft?.data?.body ?? "",
    eventTitle: draft?.event?.title ?? draft?.data?.event_title ?? "",
    eventDates: draft?.event?.dates ?? draft?.data?.event_dates ?? "",
    issueNote: draft?.issue_note ?? "",
    signatoryId: draft?.signatory_id ?? mine?.id ?? "",
  };
  const supersedes = (supRes.data as { number: string | null } | null)?.number ?? null;
  const previewHref = draft ? `/api/documents/${draft.id}/pdf` : null;

  return (
    <Drawer
      closeHref={closeHref}
      title={supersedes ? "Issue new version" : draft ? `Draft: ${DOC_TYPE_LABEL[draft.type]}` : "Issue document"}
      sub={supersedes ? `Replaces ${supersedes} when issued` : "Filled from the template and the student’s record"}
      footer={
        <>
          <ButtonLink variant="ghost" href={closeHref} scroll={false}>
            Cancel
          </ButtonLink>
          <span className="flex-1 max-md:hidden" />
          <Button type="submit" form={FORM_ID} name="intent" value="preview" variant="secondary">
            <Eye aria-hidden />
            Preview PDF
          </Button>
          <SubmitButton form={FORM_ID} pendingText="Issuing…">
            Issue
          </SubmitButton>
        </>
      }
    >
      {previewHref ? (
        <Notice tone={sp(params, "preview") === "1" ? "success" : "info"} icon={<Eye aria-hidden />}>
          {sp(params, "preview") === "1" ? "Draft saved. " : "This is a draft. "}
          <a href={previewHref} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink underline">
            Open the preview PDF
          </a>{" "}
          to check it before you issue.
        </Notice>
      ) : null}
      <IssueForm
        formId={FORM_ID}
        initial={initial}
        students={students}
        templates={templates}
        signatories={signatories}
        isOwner={profile.is_owner}
        myName={profile.full_name || profile.email}
        hasOwnSignature={!!mine}
        closeHref={closeHref}
      />
    </Drawer>
  );
}
