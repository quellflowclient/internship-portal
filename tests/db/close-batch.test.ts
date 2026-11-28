/**
 * Step F – Batch → Close → Archive batch (docs/19 §6, P7 step 4).
 * close_batch() / reopen_batch() in supabase/migrations/20261128000009_close_batch.sql.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createDb, createUser } from "./harness";

let db: PGlite;
const u: Record<string, string> = {};
const id: Record<string, string> = {};

type Row = Record<string, unknown>;
async function as<T = Row>(user: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  return asUser(db, user, async () => (await db.query<T>(sql, params)).rows);
}
async function su<T = Row>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0];
}
async function fails(user: string | null, sql: string, params: unknown[], re: RegExp) {
  await expect(as(user, sql, params)).rejects.toThrow(re);
}
const val = async <T>(user: string | null, sql: string, params: unknown[] = []) =>
  Object.values((await as<Row>(user, sql, params))[0] ?? {})[0] as T;
const state = (student: string) => val<string>(u.owner, "select state::text from public.students where id = $1", [student]);
const batchStatus = () => val<string>(u.owner, "select status::text from public.batches where id = $1", [id.batch]);

beforeAll(async () => {
  db = await createDb();
  u.owner = await createUser(db, "owner@qf.test", "Owner");
  await db.query("select public.bootstrap_owner('owner@qf.test')");
  await db.query("insert into public.invitations (email, role) values ('admin2@qf.test', 'admin')");
  u.admin2 = await createUser(db, "admin2@qf.test", "Admin Two");

  const plan = (await su<{ id: string }>(
    "select p.id from public.course_plans p join public.courses c on c.id = p.course_id where c.code = 'AA' and p.duration_days = 30",
  )).id;
  id.batch = await val<string>(u.owner, "select public.create_batch($1, public.today_ist() - 29, 20)", [plan]);
  id.next = await val<string>(u.owner, "select public.create_batch($1, public.today_ist() + 10, 20)", [plan]);
  await as(u.owner, "select public.daily_job()"); // planned → running for the started batch

  const mk = (name: string, email: string) =>
    val<string>(u.owner, "select public.create_student($1, $2, '+919876500000', 'LD College of Engineering')", [name, email]);
  id.sA = await mk("Riya Shah", "sa@qf.test");
  id.sB = await mk("Aman Patel", "sb@qf.test");
  id.sC = await mk("Isha Desai", "sc@qf.test");
  u.sA = await createUser(db, "sa@qf.test", "Riya Shah");

  id.eA = await val<string>(u.owner, "select public.assign_student($1, $2, 'paid')", [id.sA, id.batch]);
  id.eB = await val<string>(u.owner, "select public.assign_student($1, $2, 'free', null, 'Friend of the team')", [id.sB, id.batch]);
  id.eC = await val<string>(u.owner, "select public.assign_student($1, $2, 'paid')", [id.sC, id.batch]);
  await as(u.owner, "update public.enrollments set status = 'active' where id = any($1)", [[id.eA, id.eB]]);
  // Aman is also in the next batch, so he stays an active student after this one closes.
  await as(u.owner, "select public.assign_student($1, $2, 'paid')", [id.sB, id.next]);
});

describe("close_batch", () => {
  it("is for admins only", async () => {
    await fails(u.sA, "select public.close_batch($1)", [id.batch], /not allowed/);
    await fails(null, "select public.close_batch($1)", [id.batch], /permission denied/);
    expect(await batchStatus()).toBe("running");
  });

  it("refuses while enrolments are still assigned or active, and says how many", async () => {
    await fails(u.admin2, "select public.close_batch($1)", [id.batch], /3 enrolments are still open \(1 assigned, 2 active\)/);
    await as(u.owner, "update public.enrollments set status = 'completed', result_note = 'Completed' where id = $1", [id.eA]);
    await as(u.owner,
      "update public.enrollments set status = 'not_completed', result_note = 'Missed the final test', change_reason = 'Missed the final test' where id = $1",
      [id.eB]);
    await fails(u.owner, "select public.close_batch($1)", [id.batch], /1 enrolment is still open \(1 assigned, 0 active\)/);
    expect(await batchStatus()).toBe("running");
  });

  it("logs a not-completed result with its note", async () => {
    const rows = await as<{ to_value: string; reason: string }>(u.owner,
      "select to_value, reason from public.enrollment_changes where enrollment_id = $1 and change = 'status' order by changed_at desc, id desc limit 1",
      [id.eB]);
    expect(rows).toEqual([{ to_value: "not_completed", reason: "Missed the final test" }]);
  });

  it("cannot be bypassed with a direct update", async () => {
    await fails(u.owner, "update public.batches set status = 'completed' where id = $1", [id.batch], /Archive batch/);
  });

  it("closes the batch, moves students with no other open enrolment to alumni and logs it", async () => {
    await as(u.owner, "update public.enrollments set status = 'withdrawn', exit_reason = 'Changed college plans' where id = $1", [id.eC]);
    const r = await val<{ code: string; alumni: number }>(u.admin2, "select public.close_batch($1)", [id.batch]);
    expect(r.alumni).toBe(1);
    expect(await batchStatus()).toBe("completed");
    expect(await state(id.sA)).toBe("alumni");
    expect(await state(id.sB)).toBe("active"); // still enrolled in the next batch
    expect(await state(id.sC)).toBe("active"); // withdrew, never finished
    expect(await val(u.owner, "select count(*)::int from public.activities where student_id = $1 and outcome = 'alumni'", [id.sA])).toBe(1);
    expect(await val(u.owner,
      "select count(*)::int from public.audit_log where entity = 'batches' and entity_id = $1 and after ->> 'status' = 'completed'",
      [id.batch])).toBe(1);
    await fails(u.owner, "select public.close_batch($1)", [id.batch], /already closed/);
  });

  it("blocks new enrolments in a closed batch", async () => {
    const s = await val<string>(u.owner, "select public.create_student('Dev Malhotra', 'dev@qf.test', '1', 'SVNIT')");
    await fails(u.owner, "select public.assign_student($1, $2, 'paid')", [s, id.batch], /This batch is completed/);
  });
});

describe("reopen_batch (Undo)", () => {
  it("reopens within 2 minutes and makes the alumni active again", async () => {
    await fails(u.sA, "select public.reopen_batch($1)", [id.batch], /not allowed/);
    const r = await val<{ reactivated: number }>(u.owner, "select public.reopen_batch($1)", [id.batch]);
    expect(r.reactivated).toBe(1);
    expect(await batchStatus()).toBe("running");
    expect(await state(id.sA)).toBe("active");
    expect(await val(u.owner, "select closed_at from public.batches where id = $1", [id.batch])).toBeNull();
    await fails(u.owner, "select public.reopen_batch($1)", [id.batch], /not closed/);
  });

  it("refuses after 2 minutes", async () => {
    await as(u.owner, "select public.close_batch($1)", [id.batch]);
    expect(await state(id.sA)).toBe("alumni");
    await db.query("update public.batches set closed_at = now() - interval '3 minutes' where id = $1", [id.batch]);
    await fails(u.owner, "select public.reopen_batch($1)", [id.batch], /within 2 minutes/);
    expect(await batchStatus()).toBe("completed");
    expect(await state(id.sA)).toBe("alumni");
  });
});
