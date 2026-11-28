"use server";

/**
 * Projects (docs/19 §2.9, §6, §7 row "Projects"). The Projects screen is the only owner:
 * New / Edit / status / Archive (Undo) · members (NDA check for client projects in the database) · tasks.
 * Codes come from the database (guard_projects → next_code('project:<kind>')).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/server/guard";
import { done, fail, fromDb, fromZod, type ActionResult } from "@/server/result";
import { formToObject, optionalDate, optionalText, optionalUrl, requiredText, uuid } from "@/lib/validators";

const KINDS = ["client", "college", "internal"] as const;
const STATUSES = ["planned", "active", "on_hold", "completed", "cancelled"] as const;
const TASK_STATUSES = ["todo", "doing", "review", "done"] as const;
const REPORT = ["not_started", "draft", "reviewed", "submitted", "approved"] as const;

const PATH = "/admin/projects";
const openHref = (code: string) => `${PATH}?open=${encodeURIComponent(code)}`;

const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(uuid.nullable())
  .nullish();

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.enum(values).nullable())
    .nullish();

const optionalHours = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 5000) {
      ctx.addIssue({ code: "custom", message: "Enter whole hours from 0 to 5000" });
      return z.NEVER;
    }
    return n;
  })
  .nullish();

/** Turns the database's project errors into the field they belong to. */
function projectDbError(error: { message?: string; code?: string } | null): ActionResult {
  const msg = (error?.message ?? "").replace(/^ERROR:\s*/i, "");
  if (/NDA/i.test(msg)) {
    return fail("NDA missing: this student cannot join a client project yet.", {
      student_id: "No accepted NDA consent. Issue a Consent document in Documents, ask the student to accept it, then add them.",
    });
  }
  if (/archived/i.test(msg)) return fail("This project is archived. Restore it first.");
  if (/assignee must be a member/i.test(msg)) {
    return fail("The assignee must be a member of this project.", { assignee_student_id: "Pick a member of this project" });
  }
  if (/cannot go from/i.test(msg)) return fail("That status change is not allowed from the current status.");
  if (/No numbering scheme/i.test(msg)) return fail("Project numbers are not set up. Add them in Settings, Document numbers.");
  if (error?.code === "23514" && /github_visibility|projects_check1/i.test(msg)) {
    return fail("A client project repo cannot be public.", { github_visibility: "Use Private or Quellflow org" });
  }
  if (error?.code === "23514" && /projects_check/i.test(msg)) {
    return fail("A client project needs the client name.", { client_name: "Client name is required" });
  }
  return fromDb(error);
}

/** The list (and its open panel) plus the batch Projects tab that shows this project. */
function refresh(_code?: string | null, batchCode?: string | null) {
  revalidatePath(PATH);
  if (batchCode) revalidatePath(`/admin/batches/${encodeURIComponent(batchCode)}/projects`);
}

async function codesFor(supabase: Awaited<ReturnType<typeof assertAdmin>>["supabase"], projectId: string) {
  const { data } = await supabase.from("projects").select("code, batch:batches(code)").eq("id", projectId).maybeSingle();
  const r = data as unknown as { code: string; batch: { code: string } | null } | null;
  return { code: r?.code ?? null, batchCode: r?.batch?.code ?? null };
}

/* =====================================================================
 * New / Edit project
 * ===================================================================== */
const ProjectForm = z
  .object({
    id: optionalId,
    kind: z.enum(KINDS, "Pick the project kind"),
    name: requiredText(160, "Project name"),
    description: optionalText(2000),
    status: optionalEnum(["planned", "active"] as const),
    batch_id: optionalId,
    lead_admin_id: optionalId,
    start_date: optionalDate,
    due_date: optionalDate,
    github_url: optionalUrl,
    github_visibility: optionalEnum(["private", "org", "public"] as const),
    demo_url: optionalUrl,
    docs_url: optionalUrl,
    client_name: optionalText(160),
    client_contact: optionalText(200),
    college_name: optionalText(160),
    guide_name: optionalText(120),
    submission_due: optionalDate,
    report_status: optionalEnum(REPORT),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "client" && !v.client_name) {
      ctx.addIssue({ code: "custom", path: ["client_name"], message: "Client name is required" });
    }
    if (v.kind === "client" && v.github_visibility === "public") {
      ctx.addIssue({ code: "custom", path: ["github_visibility"], message: "A client repo must be private" });
    }
    if (v.start_date && v.due_date && v.due_date < v.start_date) {
      ctx.addIssue({ code: "custom", path: ["due_date"], message: "The due date is before the start date" });
    }
  });

type ProjectValues = z.infer<typeof ProjectForm>;

/** Only the fields of the project's kind are kept; the others are cleared. */
function columns(v: ProjectValues) {
  return {
    name: v.name,
    description: v.description ?? null,
    batch_id: v.batch_id ?? null,
    lead_admin_id: v.lead_admin_id ?? null,
    start_date: v.start_date ?? null,
    due_date: v.due_date ?? null,
    github_url: v.github_url ?? null,
    github_visibility: v.github_visibility ?? (v.kind === "college" ? null : v.github_url ? "private" : null),
    demo_url: v.demo_url ?? null,
    docs_url: v.docs_url ?? null,
    client_name: v.kind === "client" ? (v.client_name ?? null) : null,
    client_contact: v.kind === "client" ? (v.client_contact ?? null) : null,
    college_name: v.kind === "college" ? (v.college_name ?? null) : null,
    guide_name: v.kind === "college" ? (v.guide_name ?? null) : null,
    submission_due: v.kind === "college" ? (v.submission_due ?? null) : null,
    report_status: v.kind === "college" ? (v.report_status ?? "not_started") : null,
  };
}

export async function createProject(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = ProjectForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const { data, error } = await supabase
    .from("projects")
    .insert({ kind: v.kind, status: v.status ?? "planned", ...columns(v) })
    .select("code, batch:batches(code)")
    .single();
  if (error || !data) return projectDbError(error);
  const row = data as unknown as { code: string; batch: { code: string } | null };
  refresh(row.code, row.batch?.code);
  return done(`Project ${row.code} created`, { redirectTo: openHref(row.code) });
}

export async function updateProject(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = ProjectForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  if (!v.id) return fail("Unknown project.");

  const before = await codesFor(supabase, v.id);
  const { data, error } = await supabase
    .from("projects")
    .update(columns(v))
    .eq("id", v.id)
    .eq("kind", v.kind)
    .select("code, batch:batches(code)")
    .maybeSingle();
  if (error) return projectDbError(error);
  const row = data as unknown as { code: string; batch: { code: string } | null } | null;
  if (!row) return fail("This project no longer exists.");
  refresh(row.code, row.batch?.code);
  if (before.batchCode && before.batchCode !== row.batch?.code) refresh(null, before.batchCode);
  return done("Project saved");
}

/* =====================================================================
 * Status (docs/19 §6) and Archive (+ Undo)
 * ===================================================================== */
export async function setProjectStatus(id: string, status: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const s = z.enum(STATUSES).safeParse(status);
  if (!uuid.safeParse(id).success || !s.success) return fail("Unknown project or status.");
  const { data, error } = await supabase.from("projects").update({ status: s.data }).eq("id", id).select("code").maybeSingle();
  if (error) return projectDbError(error);
  if (!data) return fail("This project no longer exists.");
  const c = await codesFor(supabase, id);
  refresh(c.code, c.batchCode);
  const words: Record<string, string> = {
    planned: "Project reopened as planned",
    active: "Project is active",
    on_hold: "Project put on hold",
    completed: "Project marked completed",
    cancelled: "Project cancelled",
  };
  return done(words[s.data] ?? "Status changed");
}

export async function archiveProject(id: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!uuid.safeParse(id).success) return fail("Unknown project.");
  const { data, error } = await supabase
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .is("archived_at", null)
    .select("code")
    .maybeSingle();
  if (error) return projectDbError(error);
  if (!data) return fail("This project is already archived.");
  const c = await codesFor(supabase, id);
  refresh(c.code, c.batchCode);
  return done("Project archived", { undoId: id });
}

export async function restoreProject(id: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!uuid.safeParse(id).success) return fail("Unknown project.");
  const { data, error } = await supabase
    .from("projects")
    .update({ archived_at: null })
    .eq("id", id)
    .not("archived_at", "is", null)
    .select("code")
    .maybeSingle();
  if (error) return projectDbError(error);
  if (!data) return fail("This project is not archived.");
  const c = await codesFor(supabase, id);
  refresh(c.code, c.batchCode);
  return done("Project restored");
}

/* =====================================================================
 * Members (NDA rule for client projects is enforced by guard_project_members)
 * ===================================================================== */
const MemberForm = z.object({
  project_id: uuid,
  student_id: z.string().trim().min(1, "Pick a student").pipe(uuid),
  editing: z.string().optional(),
  role: optionalText(60),
  hours: optionalHours,
  contribution_note: optionalText(1000),
});

export async function saveMember(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = MemberForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  const values = { role: v.role ?? null, hours: v.hours ?? null, contribution_note: v.contribution_note ?? null };

  const { error } = v.editing
    ? await supabase.from("project_members").update(values).eq("project_id", v.project_id).eq("student_id", v.student_id)
    : await supabase.from("project_members").insert({ project_id: v.project_id, student_id: v.student_id, ...values });
  if (error?.code === "23505") {
    return fail("This student is already a member.", { student_id: "Already a member of this project" });
  }
  if (error) return projectDbError(error);
  const c = await codesFor(supabase, v.project_id);
  refresh(c.code, c.batchCode);
  return done(v.editing ? "Member saved" : "Member added");
}

const MemberSnapshot = z.object({
  project_id: uuid,
  student_id: uuid,
  role: z.string().max(60).nullable(),
  hours: z.number().int().min(0).max(5000).nullable(),
  contribution_note: z.string().max(1000).nullable(),
});

/** Remove is a real delete (allowed by policy). Undo puts the same row back. */
export async function removeMember(projectId: string, studentId: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!uuid.safeParse(projectId).success || !uuid.safeParse(studentId).success) return fail("Unknown member.");
  const { data, error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("student_id", studentId)
    .select("project_id, student_id, role, hours, contribution_note")
    .maybeSingle();
  if (error) return projectDbError(error);
  if (!data) return fail("This student is not a member any more.");
  const c = await codesFor(supabase, projectId);
  refresh(c.code, c.batchCode);
  return done("Member removed", { undoId: JSON.stringify(data) });
}

export async function restoreMember(snapshot: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  let raw: unknown;
  try {
    raw = JSON.parse(snapshot);
  } catch {
    return fail("Nothing to restore.");
  }
  const parsed = MemberSnapshot.safeParse(raw);
  if (!parsed.success) return fail("Nothing to restore.");
  const { error } = await supabase.from("project_members").insert(parsed.data);
  if (error && error.code !== "23505") return projectDbError(error);
  const c = await codesFor(supabase, parsed.data.project_id);
  refresh(c.code, c.batchCode);
  return done("Member restored");
}

/* =====================================================================
 * Tasks (tracking only)
 * ===================================================================== */
const TaskForm = z.object({
  project_id: uuid,
  id: optionalId,
  title: requiredText(200, "Task title"),
  status: z.enum(TASK_STATUSES, "Pick a status"),
  assignee_student_id: optionalId,
  due_on: optionalDate,
  link: optionalUrl,
});

export async function saveTask(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = TaskForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  const values = {
    title: v.title,
    status: v.status,
    assignee_student_id: v.assignee_student_id ?? null,
    due_on: v.due_on ?? null,
    link: v.link ?? null,
  };
  const { error } = v.id
    ? await supabase.from("project_tasks").update(values).eq("id", v.id).eq("project_id", v.project_id)
    : await supabase.from("project_tasks").insert({ project_id: v.project_id, ...values });
  if (error) return projectDbError(error);
  const c = await codesFor(supabase, v.project_id);
  refresh(c.code, c.batchCode);
  return done(v.id ? "Task saved" : "Task added");
}

/** Quick status change from the task row (a select that saves on change). */
export async function setTaskStatus(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = z.object({ id: uuid, status: z.enum(TASK_STATUSES) }).safeParse(formToObject(fd));
  if (!parsed.success) return fail("Pick a status.");
  const { data, error } = await supabase
    .from("project_tasks")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .select("project_id")
    .maybeSingle();
  if (error) return projectDbError(error);
  if (!data) return fail("This task no longer exists.");
  const c = await codesFor(supabase, (data as { project_id: string }).project_id);
  refresh(c.code, c.batchCode);
  return done("Task status changed");
}

const TaskSnapshot = z.object({
  id: uuid,
  project_id: uuid,
  title: z.string().min(1).max(200),
  status: z.enum(TASK_STATUSES),
  assignee_student_id: uuid.nullable(),
  due_on: z.string().nullable(),
  link: z.string().max(2000).nullable(),
});

export async function deleteTask(id: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!uuid.safeParse(id).success) return fail("Unknown task.");
  const { data, error } = await supabase
    .from("project_tasks")
    .delete()
    .eq("id", id)
    .select("id, project_id, title, status, assignee_student_id, due_on, link")
    .maybeSingle();
  if (error) return projectDbError(error);
  if (!data) return fail("This task no longer exists.");
  const c = await codesFor(supabase, (data as { project_id: string }).project_id);
  refresh(c.code, c.batchCode);
  return done("Task deleted", { undoId: JSON.stringify(data) });
}

export async function restoreTask(snapshot: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  let raw: unknown;
  try {
    raw = JSON.parse(snapshot);
  } catch {
    return fail("Nothing to restore.");
  }
  const parsed = TaskSnapshot.safeParse(raw);
  if (!parsed.success) return fail("Nothing to restore.");
  const { error } = await supabase.from("project_tasks").insert(parsed.data);
  if (error && error.code !== "23505") return projectDbError(error);
  const c = await codesFor(supabase, parsed.data.project_id);
  refresh(c.code, c.batchCode);
  return done("Task restored");
}
