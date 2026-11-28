import "server-only";
/** Server loaders for the Projects panels (rows from the untyped Supabase client). */
import { createClient } from "@/lib/supabase/server";
import type { Choice, ProjectInitial, ProjectKind, ProjectStatus, ReportStatus, TaskStatus } from "./shared";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface ProjectRow {
  id: string;
  code: string;
  name: string;
  kind: ProjectKind;
  status: ProjectStatus;
  description: string | null;
  batch_id: string | null;
  start_date: string | null;
  due_date: string | null;
  lead_admin_id: string | null;
  github_url: string | null;
  github_visibility: string | null;
  demo_url: string | null;
  docs_url: string | null;
  client_name: string | null;
  client_contact: string | null;
  college_name: string | null;
  guide_name: string | null;
  submission_due: string | null;
  report_status: ReportStatus | null;
  archived_at: string | null;
  created_at: string;
  batch: { code: string } | null;
  lead: { full_name: string | null; email: string } | null;
}

export interface MemberRow {
  student_id: string;
  role: string | null;
  hours: number | null;
  contribution_note: string | null;
  student: { id: string; code: string; full_name: string } | null;
}

export interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  assignee_student_id: string | null;
  due_on: string | null;
  link: string | null;
  created_at: string;
}

const PROJECT_SELECT =
  "id, code, name, kind, status, description, batch_id, start_date, due_date, lead_admin_id, github_url, github_visibility, demo_url, docs_url, client_name, client_contact, college_name, guide_name, submission_due, report_status, archived_at, created_at, batch:batches(code), lead:profiles(full_name, email)";

export async function getProject(supabase: Supabase, code: string) {
  const { data } = await supabase.from("projects").select(PROJECT_SELECT).eq("code", code).maybeSingle();
  const project = data as unknown as ProjectRow | null;
  if (!project) return null;
  const [membersRes, tasksRes] = await Promise.all([
    supabase.from("project_members").select("student_id, role, hours, contribution_note, student:students(id, code, full_name)").eq("project_id", project.id),
    supabase
      .from("project_tasks")
      .select("id, title, status, assignee_student_id, due_on, link, created_at")
      .eq("project_id", project.id)
      .order("created_at"),
  ]);
  const members = ((membersRes.data ?? []) as unknown as MemberRow[]).sort((a, b) =>
    (a.student?.full_name ?? "").localeCompare(b.student?.full_name ?? ""),
  );
  const tasks = (tasksRes.data ?? []) as TaskRow[];
  return { project, members, tasks };
}

export type ProjectData = NonNullable<Awaited<ReturnType<typeof getProject>>>;

/** Batches and admins for the New / Edit form. The project's current batch is always kept in the list. */
export async function formChoices(supabase: Supabase, currentBatchId?: string | null): Promise<{ batches: Choice[]; admins: Choice[] }> {
  const [batchRes, curRes, adminRes] = await Promise.all([
    supabase.from("batches").select("id, code").in("status", ["planned", "running"]).order("start_date", { ascending: false }),
    currentBatchId ? supabase.from("batches").select("id, code").eq("id", currentBatchId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("profiles").select("id, full_name, email").eq("role", "admin").eq("is_active", true).order("full_name"),
  ]);
  const rows = (batchRes.data ?? []) as { id: string; code: string }[];
  const cur = curRes.data as { id: string; code: string } | null;
  if (cur && !rows.some((r) => r.id === cur.id)) rows.unshift(cur);
  const admins = ((adminRes.data ?? []) as { id: string; full_name: string | null; email: string }[]).map((a) => ({
    value: a.id,
    label: a.full_name || a.email,
  }));
  return { batches: rows.map((b) => ({ value: b.id, label: b.code })), admins };
}

export function toInitial(p: ProjectRow | null, kind: ProjectKind = "college"): ProjectInitial {
  return {
    id: p?.id ?? "",
    code: p?.code ?? "",
    kind: p?.kind ?? kind,
    name: p?.name ?? "",
    description: p?.description ?? "",
    status: p?.status ?? "planned",
    batch_id: p?.batch_id ?? "",
    lead_admin_id: p?.lead_admin_id ?? "",
    start_date: p?.start_date ?? "",
    due_date: p?.due_date ?? "",
    github_url: p?.github_url ?? "",
    github_visibility: p?.github_visibility ?? "",
    demo_url: p?.demo_url ?? "",
    docs_url: p?.docs_url ?? "",
    client_name: p?.client_name ?? "",
    client_contact: p?.client_contact ?? "",
    college_name: p?.college_name ?? "",
    guide_name: p?.guide_name ?? "",
    submission_due: p?.submission_due ?? "",
    report_status: p?.report_status ?? "",
  };
}
