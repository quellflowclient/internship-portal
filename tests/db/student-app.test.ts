/**
 * Step F – student app database tests (migration 20261128000007_student_app.sql).
 * get_my_plan(enrollment) and the student's own profile edits. Each rule has an allowed and a denied case.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createDb, createUser } from "./harness";

let db: PGlite;
const u: Record<string, string> = {};
const id: Record<string, string> = {};

type Row = Record<string, unknown>;
type MyPlan = {
  batch: string;
  version: number | null;
  change_note: string | null;
  items: { seq: number; date: string; title: string; done: boolean; skipped: boolean; attendance: string | null; id?: string }[];
};

async function as<T = Row>(user: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  return asUser(db, user, async () => (await db.query<T>(sql, params)).rows);
}
async function su<T = Row>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0];
}
const val = async <T>(user: string | null, sql: string, params: unknown[] = []) =>
  Object.values((await as<Row>(user, sql, params))[0] ?? {})[0] as T;
const myPlan = (user: string | null, enrollment: string) => val<MyPlan | null>(user, "select public.get_my_plan($1)", [enrollment]);

beforeAll(async () => {
  db = await createDb();
  u.owner = await createUser(db, "owner@qf.test", "Owner");
  await db.query("select public.bootstrap_owner('owner@qf.test')");

  id.aa30 = (await su<{ id: string }>(
    "select p.id from public.course_plans p join public.courses c on c.id = p.course_id where c.code = 'AA' and p.duration_days = 30",
  )).id;
  id.running = await val<string>(u.owner, "select public.create_batch($1, public.today_ist() - 21, 20, '6–7 pm')", [id.aa30]);
  id.future = await val<string>(u.owner, "select public.create_batch($1, public.today_ist() + 30, 20)", [id.aa30]);

  const mk = (name: string, email: string) =>
    val<string>(u.owner, "select public.create_student($1, $2, '+919876500000', 'LD College of Engineering')", [name, email]);
  id.sA = await mk("Riya Shah", "sa@qf.test");
  id.sB = await mk("Aman Patel", "sb@qf.test");
  u.sA = await createUser(db, "sa@qf.test", "Riya Shah");
  u.sB = await createUser(db, "sb@qf.test", "Aman Patel");

  id.eA = await val<string>(u.owner, "select public.assign_student($1, $2, 'paid')", [id.sA, id.running]);
  id.eB = await val<string>(u.owner, "select public.assign_student($1, $2, 'free', null, 'Friend of the team')", [id.sB, id.running]);
  id.eAfuture = await val<string>(u.owner, "select public.assign_student($1, $2, 'paid')", [id.sA, id.future]);

  // Publish, then mark item 1 delivered (A present, B absent), skip item 2.
  const items = await as<{ id: string; planned_date: string }>(u.owner,
    "select i.id, i.planned_date::text from public.batch_plan_items i join public.batch_plans p on p.id = i.batch_plan_id where p.batch_id = $1 order by seq limit 2",
    [id.running]);
  expect(await val(u.owner, "select public.publish_plan($1, 'First version')", [id.running])).toBe(1);
  id.track1 = await val<string>(u.owner,
    "insert into public.track_entries (batch_id, plan_item_id, held_on, kind, title) values ($1, $2, $3, 'session', 'Kick-off') returning id",
    [id.running, items[0].id, items[0].planned_date]);
  await as(u.owner, "insert into public.attendance (track_entry_id, enrollment_id, mark) values ($1, $2, 'present'), ($1, $3, 'absent')",
    [id.track1, id.eA, id.eB]);
  await as(u.owner, "update public.batch_plan_items set skipped_at = now(), skip_reason = 'Merged' where id = $1", [items[1].id]);
});

describe("get_my_plan", () => {
  it("returns the published plan of the student's own batch with done, skipped and their own attendance", async () => {
    const plan = await myPlan(u.sA, id.eA);
    expect(plan?.version).toBe(1);
    expect(plan?.change_note).toBe("First version");
    expect(plan?.items.length).toBeGreaterThan(2);
    const [first, second, third] = plan!.items;
    expect(first).toMatchObject({ done: true, skipped: false, attendance: "present" });
    expect(second).toMatchObject({ done: false, skipped: true, attendance: null });
    expect(third).toMatchObject({ done: false, skipped: false, attendance: null });
    expect(first).not.toHaveProperty("id");

    const b = await myPlan(u.sB, id.eB);
    expect(b?.items[0].attendance).toBe("absent");
  });

  it("works when the public share link is off, and hides done marks when the admin turned them off", async () => {
    await as(u.owner, "update public.batch_plans set share_enabled = false, show_done_marks = false where batch_id = $1", [id.running]);
    const plan = await myPlan(u.sA, id.eA);
    expect(plan?.version).toBe(1);
    expect(plan?.items[0]).toMatchObject({ done: false, attendance: "present" });
    await as(u.owner, "update public.batch_plans set share_enabled = true, show_done_marks = true where batch_id = $1", [id.running]);
  });

  it("returns only the published version, not draft edits", async () => {
    await as(u.owner,
      "update public.batch_plan_items set title = 'Draft title' where id = (select i.id from public.batch_plan_items i join public.batch_plans p on p.id = i.batch_plan_id where p.batch_id = $1 order by seq desc limit 1)",
      [id.running]);
    const plan = await myPlan(u.sA, id.eA);
    expect(plan?.items.map((i) => i.title)).not.toContain("Draft title");
  });

  it("returns no items when nothing is published yet", async () => {
    const plan = await myPlan(u.sA, id.eAfuture);
    expect(plan).toMatchObject({ version: null, items: [] });
  });

  it("returns null for another student's enrolment, an unknown id or a withdrawn enrolment", async () => {
    expect(await myPlan(u.sB, id.eA)).toBeNull();
    expect(await myPlan(u.owner, id.eA)).toBeNull();
    expect(await myPlan(u.sA, "00000000-0000-0000-0000-000000000000")).toBeNull();
    await as(u.owner, "update public.enrollments set status = 'withdrawn', exit_reason = 'Changed plans' where id = $1", [id.eAfuture]);
    expect(await myPlan(u.sA, id.eAfuture)).toBeNull();
  });

  it("is not callable by anon", async () => {
    await expect(as(null, "select public.get_my_plan($1)", [id.eA])).rejects.toThrow(/permission denied/);
  });
});

describe("student profile edits", () => {
  it("lets a student change phone, city, GitHub and LinkedIn on their own row", async () => {
    await as(u.sA,
      "update public.students set phone = '+919811111111', city = 'Rajkot', github_url = 'https://github.com/riya', linkedin_url = 'https://linkedin.com/in/riya' where id = $1",
      [id.sA]);
    const s = await su<Row>("select phone, city, github_url, linkedin_url from public.students where id = $1", [id.sA]);
    expect(s).toEqual({ phone: "+919811111111", city: "Rajkot", github_url: "https://github.com/riya", linkedin_url: "https://linkedin.com/in/riya" });
  });

  it("blocks identity fields and other students' rows", async () => {
    for (const col of ["full_name", "email", "code", "college", "name_on_documents"]) {
      await expect(as(u.sA, `update public.students set ${col} = 'x@qf.test' where id = $1`, [id.sA])).rejects.toThrow(/only your phone/);
    }
    await as(u.sA, "update public.students set city = 'Hacked' where id = $1", [id.sB]);
    expect(await su("select city from public.students where id = $1", [id.sB])).toEqual({ city: null });
  });
});
