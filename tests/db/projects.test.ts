/**
 * Step F · Projects (docs/19 §2.9, §6, §7; migration 20261128000008_projects.sql).
 * Every rule has an allowed and a denied case.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createDb, createUser } from "./harness";

let db: PGlite;
const u: Record<string, string> = {};
const id: Record<string, string> = {};
const HASH = "b".repeat(64);

type Row = Record<string, unknown>;
async function as<T = Row>(user: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  return asUser(db, user, async () => (await db.query<T>(sql, params)).rows);
}
async function fails(user: string | null, sql: string, params: unknown[], re: RegExp) {
  await expect(as(user, sql, params)).rejects.toThrow(re);
}
const val = async <T>(user: string | null, sql: string, params: unknown[] = []) =>
  Object.values((await as<Row>(user, sql, params))[0] ?? {})[0] as T;

const setStatus = (who: string, project: string, status: string) =>
  as(who, "update public.projects set status = $2::public.project_status where id = $1", [project, status]);

beforeAll(async () => {
  db = await createDb();
  u.owner = await createUser(db, "owner@qf.test", "Owner");
  await db.query("select public.bootstrap_owner('owner@qf.test')");
  await db.query("insert into public.invitations (email, role) values ('admin2@qf.test', 'admin')");
  u.admin2 = await createUser(db, "admin2@qf.test", "Admin Two");
  await db.query("insert into public.signatories (name, title, profile_id) values ('Owner One', 'Partner', $1)", [u.owner]);

  const plan = (
    await db.query<{ id: string }>(
      "select p.id from public.course_plans p join public.courses c on c.id = p.course_id where c.code = 'AA' and p.duration_days = 30",
    )
  ).rows[0].id;
  id.batch = await val<string>(u.owner, "select public.create_batch($1, '2026-12-01', 20)", [plan]);
  const mk = (name: string, email: string) =>
    val<string>(u.owner, "select public.create_student($1, $2, '+919876500000', 'LD College of Engineering')", [name, email]);
  id.sA = await mk("Riya Shah", "pa@qf.test");
  id.sB = await mk("Aman Patel", "pb@qf.test");
  u.sA = await createUser(db, "pa@qf.test", "Riya Shah");
  u.sB = await createUser(db, "pb@qf.test", "Aman Patel");
  id.eB = await val<string>(u.owner, "select public.assign_student($1, $2, 'stipend', null, null, 5000)", [id.sB, id.batch]);

  // Aman accepts the NDA consent; Riya does not.
  const consent = await val<string>(
    u.owner,
    `insert into public.documents (type, template_id, student_id, enrollment_id, data)
     values ('consent', (select id from public.document_templates where type = 'consent' and active), $1, $2,
             jsonb_build_object('name', 'Aman Patel')) returning id`,
    [id.sB, id.eB],
  );
  await as(u.owner, "select public.issue_document($1, $2)", [consent, HASH]);
  await as(u.sB, "select public.accept_document($1, 'Aman Patel', 'I agree')", [consent]);
});

describe("project codes and access", () => {
  it("issues the code from the numbering scheme of the kind", async () => {
    id.college = await val<string>(
      u.admin2,
      "insert into public.projects (name, kind, batch_id, college_name, submission_due) values ('Smart attendance', 'college', $1, 'LD College', current_date + 3) returning id",
      [id.batch],
    );
    id.internal = await val<string>(u.admin2, "insert into public.projects (name, kind, code) values ('Portal', 'internal', '') returning id");
    expect(await val(u.owner, "select code from public.projects where id = $1", [id.college])).toBe("PRJ-CO-0001");
    expect(await val(u.owner, "select code from public.projects where id = $1", [id.internal])).toBe("PRJ-IN-0001");
  });

  it("keeps the code and the kind fixed", async () => {
    await fails(u.owner, "update public.projects set code = 'PRJ-CO-9999' where id = $1", [id.college], /code cannot change/);
    await fails(u.owner, "update public.projects set kind = 'client', client_name = 'Acme' where id = $1", [id.college], /kind cannot change/);
    await as(u.owner, "update public.projects set name = 'Smart attendance app' where id = $1", [id.college]);
  });

  it("needs a client name for client projects and never a public repo", async () => {
    await fails(u.owner, "insert into public.projects (name, kind) values ('No client', 'client')", [], /check constraint/);
    await fails(u.owner, "insert into public.projects (name, kind, client_name, github_visibility) values ('Open', 'client', 'Acme', 'public')", [], /check constraint/);
    id.client = await val<string>(u.owner, "insert into public.projects (name, kind, client_name, batch_id) values ('Clinic AI', 'client', 'Acme Clinic', $1) returning id", [id.batch]);
    expect(await val(u.owner, "select code from public.projects where id = $1", [id.client])).toBe("PRJ-CL-0001");
  });

  it("starts a project only as planned or active", async () => {
    await fails(u.owner, "insert into public.projects (name, kind, status) values ('Done already', 'internal', 'completed')", [], /starts as planned or active/);
  });

  it("hides projects, members and tasks from students and anon", async () => {
    await fails(u.sA, "insert into public.projects (name, kind) values ('Mine', 'internal')", [], /row-level security|not allowed/);
    expect(await as(u.sA, "select id from public.projects")).toHaveLength(0);
    expect(await as(u.sA, "select id from public.v_project_list")).toHaveLength(0);
    await fails(null, "select id from public.projects", [], /permission denied/);
    await fails(null, "select id from public.v_project_list", [], /permission denied/);
  });
});

describe("project status", () => {
  it("follows the state machine", async () => {
    await fails(u.owner, "update public.projects set status = 'completed' where id = $1", [id.college], /cannot go from planned to completed/);
    await setStatus(u.owner, id.college, "active");
    await setStatus(u.owner, id.college, "on_hold");
    await fails(u.owner, "update public.projects set status = 'completed' where id = $1", [id.college], /on_hold to completed/);
    await setStatus(u.owner, id.college, "active");
    await setStatus(u.owner, id.college, "completed");
    await setStatus(u.owner, id.college, "active"); // reopen
    await setStatus(u.owner, id.internal, "cancelled");
    await fails(u.owner, "update public.projects set status = 'active' where id = $1", [id.internal], /cancelled to active/);
    await setStatus(u.owner, id.internal, "planned"); // reopen
  });

  it("archives with undo and blocks edits while archived", async () => {
    await as(u.admin2, "update public.projects set archived_at = now() where id = $1", [id.internal]);
    await fails(u.admin2, "update public.projects set name = 'Changed' where id = $1", [id.internal], /archived/);
    await fails(u.admin2, "insert into public.project_tasks (project_id, title) values ($1, 'Late task')", [id.internal], /archived/);
    await as(u.admin2, "update public.projects set archived_at = null where id = $1", [id.internal]);
    await as(u.admin2, "update public.projects set name = 'Portal v2' where id = $1", [id.internal]);
  });
});

describe("members and tasks", () => {
  it("requires an accepted NDA consent for client project members", async () => {
    await fails(u.admin2, "insert into public.project_members (project_id, student_id) values ($1, $2)", [id.client, id.sA], /NDA/);
    await as(u.admin2, "insert into public.project_members (project_id, student_id, role, hours) values ($1, $2, 'Developer', 40)", [id.client, id.sB]);
  });

  it("lets any student join a college project, once", async () => {
    await as(u.admin2, "insert into public.project_members (project_id, student_id, role) values ($1, $2, 'Lead developer')", [id.college, id.sA]);
    await fails(u.admin2, "insert into public.project_members (project_id, student_id) values ($1, $2)", [id.college, id.sA], /duplicate key/);
    await fails(u.admin2, "insert into public.project_members (project_id, student_id, hours) values ($1, $2, -1)", [id.college, id.sB], /check constraint/);
  });

  it("assigns tasks only to members and checks the status", async () => {
    await fails(u.admin2, "insert into public.project_tasks (project_id, title, assignee_student_id) values ($1, 'Login page', $2)", [id.college, id.sB], /member/);
    await fails(u.admin2, "insert into public.project_tasks (project_id, title, status) values ($1, 'Login page', 'blocked')", [id.college], /check constraint/);
    id.task = await val<string>(u.admin2, "insert into public.project_tasks (project_id, title, assignee_student_id) values ($1, 'Login page', $2) returning id", [id.college, id.sA]);
    await as(u.admin2, "insert into public.project_tasks (project_id, title, status) values ($1, 'Report draft', 'done')", [id.college]);
    await as(u.admin2, "update public.project_tasks set status = 'review' where id = $1", [id.task]);
  });

  it("counts members and tasks in the list view", async () => {
    const r = (await as<Row>(u.owner, "select * from public.v_project_list where id = $1", [id.college]))[0];
    expect(r.members).toBe(1);
    expect(r.member_names).toBe("Riya Shah");
    expect(r.tasks_total).toBe(2);
    expect(r.tasks_done).toBe(1);
    expect(r.batch_code).toMatch(/^AA30-/);
    expect(r.due_on).not.toBeNull();
    expect(r.report_pending).toBe(true);
    await as(u.owner, "update public.projects set report_status = 'submitted' where id = $1", [id.college]);
    expect(await val(u.owner, "select report_pending from public.v_project_list where id = $1", [id.college])).toBe(false);
  });

  it("lets admins remove a member (their tasks become unassigned) and delete a task", async () => {
    await as(u.admin2, "delete from public.project_members where project_id = $1 and student_id = $2", [id.college, id.sA]);
    expect(await val(u.owner, "select assignee_student_id from public.project_tasks where id = $1", [id.task])).toBeNull();
    await as(u.admin2, "delete from public.project_tasks where id = $1", [id.task]);
    expect(await as(u.owner, "select id from public.project_tasks where id = $1", [id.task])).toHaveLength(0);
  });

  it("lets only admins change members and tasks", async () => {
    await as(u.sB, "delete from public.project_members where project_id = $1", [id.client]);
    expect(await val(u.owner, "select count(*)::int from public.project_members where project_id = $1", [id.client])).toBe(1);
    await fails(u.sB, "insert into public.project_tasks (project_id, title) values ($1, 'Mine')", [id.client], /row-level security/);
  });

  it("lets admins archive but not hard-delete a project", async () => {
    await as(u.admin2, "delete from public.projects where id = $1", [id.client]);
    expect(await as(u.owner, "select id from public.projects where id = $1", [id.client])).toHaveLength(1);
  });
});
