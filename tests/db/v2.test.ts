/**
 * Plan v2 database tests (docs/19_DB_FLOWS_PIPELINES.md §2–§5).
 * Migrations + seed run in PGlite with a Supabase-like auth stub (tests/db/harness.ts).
 * Every security rule has an allowed and a denied case.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asService, asUser, createDb, createUser } from "./harness";

let db: PGlite;
const u: Record<string, string> = {};
const id: Record<string, string> = {};
const HASH = "a".repeat(64);

type Row = Record<string, unknown>;
async function as<T = Row>(user: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  return asUser(db, user, async () => (await db.query<T>(sql, params)).rows);
}
async function one<T = Row>(user: string | null, sql: string, params: unknown[] = []): Promise<T> {
  return (await as<T>(user, sql, params))[0];
}
async function su<T = Row>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0];
}
async function fails(user: string | null, sql: string, params: unknown[], re: RegExp) {
  await expect(as(user, sql, params)).rejects.toThrow(re);
}
const val = async <T>(user: string | null, sql: string, params: unknown[] = []) =>
  Object.values((await one<Row>(user, sql, params)) ?? {})[0] as T;

beforeAll(async () => {
  db = await createDb();
  u.owner = await createUser(db, "owner@qf.test", "Owner");
  await db.query("select public.bootstrap_owner('owner@qf.test')");
  await db.query("insert into public.invitations (email, role) values ('admin2@qf.test', 'admin')");
  u.admin2 = await createUser(db, "admin2@qf.test", "Admin Two");
  u.stranger = await createUser(db, "nobody@qf.test", "Nobody");

  id.aa30 = (await su<{ id: string }>(
    "select p.id from public.course_plans p join public.courses c on c.id = p.course_id where c.code = 'AA' and p.duration_days = 30",
  )).id;
  id.futureBatch = await val<string>(u.owner, "select public.create_batch($1, '2026-12-01', 20, '6–7 pm')", [id.aa30]);
  id.pastBatch = await val<string>(u.owner, "select public.create_batch($1, public.today_ist() - 21, 20)", [id.aa30]);

  const mk = (name: string, email: string) =>
    val<string>(u.owner, "select public.create_student($1, $2, '+919876500000', 'LD College of Engineering')", [name, email]);
  id.sA = await mk("Riya Shah", "sa@qf.test");
  id.sB = await mk("Aman Patel", "sb@qf.test");
  id.sC = await mk("Isha Desai", "sc@qf.test");
  id.sX = await mk("Zara Khan", "sx@qf.test");
  u.sA = await createUser(db, "sa@qf.test", "Riya Shah");
  u.sB = await createUser(db, "sb@qf.test", "Aman Patel");
  u.sX = await createUser(db, "sx@qf.test", "Zara Khan");

  id.eA = await val<string>(u.owner, "select public.assign_student($1, $2, 'paid')", [id.sA, id.pastBatch]);
  id.eB = await val<string>(u.owner, "select public.assign_student($1, $2, 'free', null, 'Friend of the team')", [id.sB, id.pastBatch]);
  id.eC = await val<string>(u.owner, "select public.assign_student($1, $2, 'stipend', null, null, 5000, 'email 12 Nov')", [id.sC, id.pastBatch]);
  id.eX = await val<string>(u.owner, "select public.assign_student($1, $2, 'paid')", [id.sX, id.futureBatch]);
});

describe("codes and settings", () => {
  it("issues sequential lead codes for admins only", async () => {
    const a = await val<string>(u.owner, "select public.next_code('lead')");
    const b = await val<string>(u.owner, "select public.next_code('lead')");
    expect(a).toMatch(/^QF-\d{4}-\d{4}$/);
    expect(Number(b.slice(-4))).toBe(Number(a.slice(-4)) + 1);
    await fails(u.sA, "select public.next_code('lead')", [], /not allowed/);
    await fails(null, "select public.next_code('lead')", [], /permission denied/);
  });

  it("skips weekends and holidays when counting working days", async () => {
    expect(await val(u.owner, "select public.nth_working_day('2026-12-01', 19, '[1,2,3,4,5]')::text")).toBe("2026-12-28");
    expect(await val(u.owner, "select public.working_days_between('2026-12-04', '2026-12-07', '[1,2,3,4,5]')")).toBe(1);
  });
});

describe("accounts", () => {
  it("activates invited admins and students created by an admin; others stay inactive", async () => {
    const p = await su<{ role: string; is_active: boolean }>("select role, is_active from public.profiles where id = $1", [u.admin2]);
    expect(p).toEqual({ role: "admin", is_active: true });
    const s = await su<{ is_active: boolean }>("select is_active from public.profiles where id = $1", [u.stranger]);
    expect(s.is_active).toBe(false);
    const linked = await su<{ user_id: string }>("select user_id from public.students where id = $1", [id.sA]);
    expect(linked.user_id).toBe(u.sA);
  });

  it("blocks role and owner changes outside admin_set_user_role()", async () => {
    await fails(u.sA, "update public.profiles set role = 'admin' where id = $1", [u.sA], /admin_set_user_role/);
    await fails(u.admin2, "select public.admin_set_user_role($1, 'admin', true, true)", [u.admin2], /own role/);
    await fails(u.admin2, "select public.admin_set_user_role($1, 'student', true)", [u.owner], /owner/);
    await as(u.owner, "select public.admin_set_user_role($1, 'student', false)", [u.stranger]);
  });

  it("gives an inactive account no data", async () => {
    expect(await as(u.stranger, "select * from public.org_settings")).toHaveLength(0);
    expect(await as(u.stranger, "select * from public.students")).toHaveLength(0);
  });
});

describe("leads and conversion", () => {
  it("imports a form response once and returns the same code on re-submit", async () => {
    const call = () => asService(db, async () => (await db.query<{ c: string }>(
      "select public.upsert_form_lead('resp-1', 'Tanvi Bhatt', 'Tanvi@Example.com', '+919800000001', 'LJ University', 'B.Tech CE', '3', 'AI Automation', '{}', now()) as c",
    )).rows[0].c);
    const first = await call();
    expect(first).toMatch(/^QF-\d{4}-\d{4}$/);
    expect(await call()).toBe(first);
    expect((await su<{ email: string }>("select email from public.leads where form_response_id = 'resp-1'")).email).toBe("tanvi@example.com");
    await fails(null, "select public.upsert_form_lead('x', 'a', 'a@b.c', '1', 'c', 'd', '1', 't', '{}', now())", [], /permission denied/);
  });

  it("logs stage changes and needs a reason for lost", async () => {
    id.lead = await val<string>(u.owner, "select public.create_lead('Om Prajapati', '+919800000002', 'walk_in')");
    await as(u.owner, "update public.leads set stage = 'contacted' where id = $1", [id.lead]);
    expect(await val(u.owner, "select count(*)::int from public.activities where lead_id = $1", [id.lead])).toBe(1);
    await fails(u.owner, "update public.leads set stage = 'lost' where id = $1", [id.lead], /check constraint/);
  });

  it("converts a lead into a student with the same code, once", async () => {
    const code = await val<string>(u.owner, "select code from public.leads where id = $1", [id.lead]);
    const sid = await val<string>(u.owner, "select public.create_student('Om Prajapati', 'om@qf.test', '+919800000002', 'VGEC', null, null, 'paid', null, $1)", [id.lead]);
    expect(await val(u.owner, "select code from public.students where id = $1", [sid])).toBe(code);
    expect(await val(u.owner, "select stage::text from public.leads where id = $1", [id.lead])).toBe("converted");
    await fails(u.owner, "select public.create_student('Om', 'om2@qf.test', '1', 'x', null, null, null, null, $1)", [id.lead], /already a student/);
    expect(await val(u.owner, "select count(*)::int from public.invitations where student_id = $1", [sid])).toBe(1);
  });
});

describe("batches and plans", () => {
  it("creates a batch with its code, end date and plan copied on working days", async () => {
    const b = await one<{ code: string; end_date: string }>(u.owner, "select code, end_date::text from public.batches where id = $1", [id.futureBatch]);
    expect(b).toEqual({ code: "AA30-2612-1", end_date: "2026-12-30" });
    const items = await as<{ seq: number; d: string }>(u.owner,
      "select i.seq, i.planned_date::text as d from public.batch_plan_items i join public.batch_plans p on p.id = i.batch_plan_id where p.batch_id = $1 order by seq", [id.futureBatch]);
    expect(items).toHaveLength(21);
    expect(items[0].d).toBe("2026-12-01");
    expect(items[18].d).toBe("2026-12-28");
  });

  it("publishes a frozen version; content edits mark the draft, skipping does not", async () => {
    expect(await val(u.owner, "select public.publish_plan($1, 'First version')", [id.pastBatch])).toBe(1);
    const dirty = () => val<boolean>(u.owner, "select has_unpublished_changes from public.batch_plans where batch_id = $1", [id.pastBatch]);
    expect(await dirty()).toBe(false);
    const last = await val<string>(u.owner,
      "select i.id from public.batch_plan_items i join public.batch_plans p on p.id = i.batch_plan_id where p.batch_id = $1 order by seq desc limit 1", [id.pastBatch]);
    await as(u.owner, "update public.batch_plan_items set skipped_at = now(), skip_reason = 'Merged' where id = $1", [last]);
    expect(await dirty()).toBe(false);
    await as(u.owner, "update public.batch_plan_items set title = 'Results day' where id = $1", [last]);
    expect(await dirty()).toBe(true);
    await fails(u.owner, "update public.batch_plan_versions set change_note = 'x'", [], /permission denied/);
  });

  it("serves the shared plan to anyone with the token, and nothing otherwise", async () => {
    const token = await val<string>(u.owner, "select share_token from public.batch_plans where batch_id = $1", [id.pastBatch]);
    const plan = await val<{ version: number; items: unknown[] }>(null, "select public.get_shared_plan($1)", [token]);
    expect(plan.version).toBe(1);
    expect(plan.items).toHaveLength(21);
    expect(JSON.stringify(plan)).not.toContain("@");
    expect(await val(null, "select public.get_shared_plan('00000000000000000000000000000000')")).toBeNull();
    const futureToken = await val<string>(u.owner, "select share_token from public.batch_plans where batch_id = $1", [id.futureBatch]);
    expect(await val(null, "select public.get_shared_plan($1)", [futureToken])).toBeNull(); // never published
    await fails(null, "select * from public.batch_plan_versions", [], /permission denied/);
  });
});

describe("enrolments", () => {
  it("snapshots the plan fee and blocks duplicate open enrolments", async () => {
    expect(await val(u.owner, "select fee_inr from public.enrollments where id = $1", [id.eA])).toBe(4999);
    await fails(u.owner, "select public.assign_student($1, $2, 'paid')", [id.sA, id.pastBatch], /enrollments_open_uq|duplicate key/);
  });

  it("enforces capacity unless a reason is given, and never assigns archived students", async () => {
    const small = await val<string>(u.owner, "select public.create_batch($1, '2027-01-04', 1)", [id.aa30]);
    const s1 = await val<string>(u.owner, "select public.create_student('Neel Joshi', 'neel@qf.test', '1', 'CHARUSAT')");
    const s2 = await val<string>(u.owner, "select public.create_student('Kavya Iyer', 'kavya@qf.test', '1', 'PDEU')");
    await as(u.owner, "select public.assign_student($1, $2, 'paid')", [s1, small]);
    await fails(u.owner, "select public.assign_student($1, $2, 'paid')", [s2, small], /full/);
    await as(u.owner, "select public.assign_student($1, $2, 'paid', null, null, null, null, 'Owner approved one extra seat')", [s2, small]);
    await as(u.owner, "update public.students set state = 'archived', archived_reason = 'Left' where id = $1", [s1]);
    await fails(u.owner, "select public.assign_student($1, $2, 'paid')", [s1, id.futureBatch], /Archived/);
  });

  it("requires a free reason and a stipend agreement before a stipend goes active", async () => {
    await fails(u.owner, "select public.assign_student($1, $2, 'free')", [id.sX, id.pastBatch], /check constraint/);
    const s = await val<string>(u.owner, "select public.create_student('Dev Malhotra', 'dev@qf.test', '1', 'SVNIT')");
    const e = await val<string>(u.owner, "select public.assign_student($1, $2, 'stipend')", [s, id.pastBatch]);
    await fails(u.owner, "update public.enrollments set status = 'active' where id = $1", [e], /stipend agreement/);
    await as(u.owner, "update public.enrollments set status = 'active' where id = $1", [id.eC]);
  });

  it("needs a reason to change type or fee and logs it", async () => {
    await fails(u.owner, "update public.enrollments set type = 'paid', fee_inr = 4999 where id = $1", [id.eB], /reason is required/);
    await as(u.owner, "update public.enrollments set type = 'paid', fee_inr = 4999, change_reason = 'Chose the paid plan' where id = $1", [id.eB]);
    const changes = await as<{ change: string; reason: string }>(u.owner,
      "select change, reason from public.enrollment_changes where enrollment_id = $1 order by change", [id.eB]);
    expect(changes).toEqual([{ change: "fee", reason: "Chose the paid plan" }, { change: "type", reason: "Chose the paid plan" }]);
    expect(await val(u.owner, "select change_reason from public.enrollments where id = $1", [id.eB])).toBeNull();
  });
});

describe("money", () => {
  const insert = (extra: string, params: unknown[]) =>
    as(u.owner, `insert into public.money_entries (student_id, enrollment_id, category, direction, amount_inr, status, paid_on, mode${extra ? ", " + extra.split("=")[0] : ""})
                 values ($1, $2, $3, $4, $5, 'done', public.today_ist(), 'upi'${extra ? ", " + extra.split("=")[1] : ""}) returning id`, params);

  it("checks direction, required fields and refund links", async () => {
    await fails(u.owner, "insert into public.money_entries (student_id, enrollment_id, category, direction, amount_inr, status, paid_on, mode) values ($1, $2, 'fee', 'out', 100, 'done', current_date, 'upi')", [id.sA, id.eA], /check constraint/);
    await fails(u.owner, "insert into public.money_entries (student_id, enrollment_id, category, direction, amount_inr) values ($1, $2, 'fee', 'in', 100)", [id.sA, id.eA], /check constraint/);
    await fails(u.owner, "insert into public.money_entries (student_id, enrollment_id, category, direction, amount_inr, status, paid_on, mode) values ($1, $2, 'fee', 'in', 100, 'done', current_date, 'upi')", [id.sB, id.eA], /another student/);
  });

  it("works out the pending fee from part payments and refunds", async () => {
    const pending = () => val<number>(u.owner, "select pending from public.v_fee_balance where student_id = $1", [id.sA]);
    expect(await pending()).toBe(4999);
    const [fee] = await insert("", [id.sA, id.eA, "fee", "in", 2000]) as { id: string }[];
    id.fee = fee.id;
    expect(await pending()).toBe(2999);
    await insert("related_entry_id=$6", [id.sA, id.eA, "refund", "out", 2000, id.fee]);
    expect(await pending()).toBe(4999);
  });

  it("voids with a reason and restores cleanly", async () => {
    await as(u.owner, "update public.money_entries set status = 'void', void_reason = 'Entered twice' where id = $1", [id.fee]);
    expect(await val(u.owner, "select voided_at is not null from public.money_entries where id = $1", [id.fee])).toBe(true);
    await as(u.owner, "update public.money_entries set status = 'done' where id = $1", [id.fee]);
    expect(await one(u.owner, "select void_reason, voided_at from public.money_entries where id = $1", [id.fee])).toEqual({ void_reason: null, voided_at: null });
  });

  it("creates one stipend row per active stipend enrolment per month", async () => {
    expect(await val(u.owner, "select public.create_stipend_rows(public.today_ist())")).toBe(1);
    expect(await val(u.owner, "select public.create_stipend_rows(public.today_ist())")).toBe(0);
    const row = await one<{ amount_inr: number; status: string }>(u.owner, "select amount_inr, status::text from public.money_entries where enrollment_id = $1", [id.eC]);
    expect(row).toEqual({ amount_inr: 5000, status: "expected" });
  });

  it("never shows money to students", async () => {
    expect(await as(u.sA, "select * from public.money_entries")).toHaveLength(0);
    expect(await as(u.sA, "select * from public.v_fee_balance where pending is not null and paid > 0")).toHaveLength(0);
    await fails(u.sA, "insert into public.money_entries (student_id, category, direction, amount_inr, status, paid_on, mode) values ($1, 'fee', 'in', 1, 'done', current_date, 'upi')", [id.sA], /row-level security/);
  });
});

describe("live track", () => {
  it("marks plan items delivered or late and computes progress", async () => {
    const items = await as<{ id: string; planned_date: string }>(u.owner,
      "select id, planned_date::text from public.v_plan_item_status where batch_id = $1 order by seq limit 2", [id.pastBatch]);
    id.track1 = await val<string>(u.owner,
      "insert into public.track_entries (batch_id, plan_item_id, held_on, kind, title) values ($1, $2, $3::date + 1, 'session', 'Kick-off') returning id",
      [id.pastBatch, items[0].id, items[0].planned_date]);
    await as(u.owner, "insert into public.track_entries (batch_id, plan_item_id, held_on, kind, title) values ($1, $2, $3, 'session', 'Triggers')",
      [id.pastBatch, items[1].id, items[1].planned_date]);
    await as(u.owner, "insert into public.track_entries (batch_id, held_on, kind, title) values ($1, public.today_ist() - 1, 'session', 'Doubt clearing')", [id.pastBatch]);
    const st = await as<{ status: string }>(u.owner, "select status from public.v_plan_item_status where id = any($1) order by seq", [[items[0].id, items[1].id]]);
    expect(st.map((r) => r.status)).toEqual(["late", "delivered"]);
    const p = await one<{ done: number; unplanned: number; days_behind: number }>(u.owner,
      "select done, unplanned, days_behind from public.v_batch_progress where batch_id = $1", [id.pastBatch]);
    expect(p.done).toBe(2);
    expect(p.unplanned).toBe(1);
    expect(p.days_behind).toBeGreaterThan(0);
  });

  it("rejects future dates and students from another batch", async () => {
    await fails(u.owner, "insert into public.track_entries (batch_id, held_on, kind, title) values ($1, public.today_ist() + 1, 'session', 'x')", [id.pastBatch], /future/);
    await fails(u.owner, "insert into public.attendance (track_entry_id, enrollment_id, mark) values ($1, $2, 'present')", [id.track1, id.eX], /not in this batch/);
  });

  it("computes attendance per enrolment", async () => {
    await as(u.owner, "insert into public.attendance (track_entry_id, enrollment_id, mark) values ($1, $2, 'present'), ($1, $3, 'absent')", [id.track1, id.eA, id.eB]);
    const a = await as<{ attendance_pct: number }>(u.owner,
      "select attendance_pct from public.v_enrollment_stats where enrollment_id = any($1) order by enrollment_id = $2 desc", [[id.eA, id.eB], id.eA]);
    expect(a.map((r) => r.attendance_pct)).toEqual([100, 0]);
  });
});

describe("documents", () => {
  const draft = (type: string, student: string, enrollment: string, name: string) =>
    val<string>(u.owner,
      `insert into public.documents (type, template_id, student_id, enrollment_id, data)
       values ($1::public.doc_type, (select id from public.document_templates where type = $1::public.doc_type and active), $2, $3,
               jsonb_build_object('name', $4::text, 'programme', 'AI Automation, 30 days', 'email', 'hidden@qf.test'))
       returning id`, [type, student, enrollment, name]);

  it("starts as a draft, issues with a number and token, then freezes", async () => {
    await fails(u.owner, "insert into public.documents (type, template_id, student_id, status) values ('offer', (select id from public.document_templates where type = 'offer'), $1, 'issued')", [id.sA], /drafts/);
    id.offerA = await draft("offer", id.sA, id.eA, "Riya Shah");
    const r = await val<{ number: string; verify_token: string }>(u.owner, "select public.issue_document($1, $2)", [id.offerA, HASH]);
    expect(r.number).toMatch(/^QF-OFR-\d{4}-AA-0001$/);
    expect(r.verify_token).toMatch(/^[0-9a-f]{64}$/);
    id.tokenA = r.verify_token;
    await fails(u.owner, "update public.documents set data = '{}' where id = $1", [id.offerA], /frozen/);
    await as(u.owner, "update public.documents set pdf_saved = true where id = $1", [id.offerA]);
  });

  it("lets only the right student accept, with their exact name", async () => {
    const sign = (who: string, name: string) =>
      as(who, "select public.accept_document($1, $2, 'I have read and agree', '1.2.3.4', 'vitest')", [id.offerA, name]);
    await expect(sign(u.sB, "Aman Patel")).rejects.toThrow(/not allowed/);
    await expect(sign(u.sA, "Riya S")).rejects.toThrow(/exactly/);
    await sign(u.sA, "  riya   SHAH ");
    expect(await val(u.owner, "select status::text from public.documents where id = $1", [id.offerA])).toBe("accepted");
    await expect(sign(u.sA, "Riya Shah")).rejects.toThrow(/Only an issued document/);
  });

  it("verifies publicly with safe fields only and logs the scan", async () => {
    const v = await val<Row>(null, "select public.verify_document($1, 'iphash')", [id.tokenA]);
    expect(v.result).toBe("valid");
    expect(v.name).toBe("Riya Shah");
    expect(v.email).toBeUndefined();
    expect((await val<Row>(null, "select public.verify_document('nope', null)")).result).toBe("not_found");
    expect(await val(u.owner, "select count(*)::int from public.verification_scans where document_id = $1", [id.offerA])).toBe(1);
    const number = await val<string>(u.owner, "select number from public.documents where id = $1", [id.offerA]);
    expect((await val<Row>(null, "select public.verify_by_number($1, 'shah', null)", [number.toLowerCase()])).result).toBe("valid");
    expect((await val<Row>(null, "select public.verify_by_number($1, 'patel', null)", [number])).result).toBe("not_found");
  });

  it("lets only an owner revoke, and restore within two minutes", async () => {
    await fails(u.admin2, "update public.documents set status = 'revoked', revoked_reason = 'Wrong dates' where id = $1", [id.offerA], /owner/);
    await as(u.owner, "update public.documents set status = 'revoked', revoked_reason = 'Wrong dates' where id = $1", [id.offerA]);
    expect((await val<Row>(null, "select public.verify_document($1, null)", [id.tokenA])).result).toBe("revoked");
    await as(u.owner, "update public.documents set status = 'accepted' where id = $1", [id.offerA]);
    expect((await val<Row>(null, "select public.verify_document($1, null)", [id.tokenA])).result).toBe("valid");
  });

  it("issues a certificate only for a completed enrolment", async () => {
    const cert = await draft("certificate", id.sA, id.eA, "Riya Shah");
    await fails(u.admin2, "select public.issue_document($1, $2)", [cert, HASH], /completed enrolment/);
  });

  it("hides drafts from students", async () => {
    const d = await draft("tnc", id.sA, id.eA, "Riya Shah");
    expect(await as(u.sA, "select id from public.documents where id = $1", [d])).toHaveLength(0);
    expect(await as(u.sA, "select id from public.documents where id = $1", [id.offerA])).toHaveLength(1);
  });

  it("activates an enrolment in the daily job once offer, T&C and consent are accepted", async () => {
    for (const t of ["offer", "tnc", "consent"]) {
      const d = await draft(t, id.sB, id.eB, "Aman Patel");
      await as(u.owner, "select public.issue_document($1, $2)", [d, HASH]);
      await as(u.sB, "select public.accept_document($1, 'Aman Patel', 'I agree')", [d]);
    }
    const r = await val<Row>(u.owner, "select public.daily_job()");
    expect(r.enrolments_activated).toBe(1);
    expect(await val(u.owner, "select status::text from public.enrollments where id = $1", [id.eB])).toBe("active");
    expect(await val(u.owner, "select status::text from public.enrollments where id = $1", [id.eA])).toBe("assigned");
    await fails(u.admin2, "select public.daily_job()", [], /not allowed/);
  });
});

describe("student access", () => {
  it("sees only their own student row and can edit only contact fields", async () => {
    expect(await as(u.sA, "select id from public.students")).toEqual([{ id: id.sA }]);
    await as(u.sA, "update public.students set phone = '+919811111111' where id = $1", [id.sA]);
    await fails(u.sA, "update public.students set name_on_documents = 'Someone Else' where id = $1", [id.sA], /only your phone/);
  });

  it("sees only their own batch, plan versions and enrolment summary (no fee)", async () => {
    expect(await as(u.sA, "select id from public.batches")).toEqual([{ id: id.pastBatch }]);
    expect(await as(u.sA, "select version from public.batch_plan_versions")).toEqual([{ version: 1 }]);
    expect(await as(u.sX, "select version from public.batch_plan_versions")).toHaveLength(0);
    const mine = await as<Row>(u.sA, "select * from public.v_my_enrollments");
    expect(mine).toHaveLength(1);
    expect(mine[0]).not.toHaveProperty("fee_inr");
    expect(mine[0].attendance_pct).toBe(100);
    expect(await as(u.sA, "select enrollment_id from public.v_enrollment_stats")).toEqual([{ enrollment_id: id.eA }]);
    expect((await as(u.owner, "select enrollment_id from public.v_enrollment_stats")).length).toBeGreaterThan(4);
  });

  it("cannot read CRM data, and anon reads no tables", async () => {
    expect(await as(u.sA, "select * from public.leads")).toHaveLength(0);
    await fails(u.sA, "insert into public.leads (code, full_name) values ('X-1', 'x')", [], /row-level security/);
    await fails(null, "select * from public.students", [], /permission denied/);
    await fails(null, "select * from public.documents", [], /permission denied/);
  });
});

describe("projects, search and attention", () => {
  it("requires an accepted NDA consent for client project members", async () => {
    const p = await val<string>(u.owner,
      "insert into public.projects (code, name, kind, client_name) values (public.next_code('project:client'), 'Clinic AI', 'client', 'Acme Clinic') returning id");
    expect(await val(u.owner, "select code from public.projects where id = $1", [p])).toBe("PRJ-CL-0001");
    await fails(u.owner, "insert into public.project_members (project_id, student_id) values ($1, $2)", [p, id.sA], /NDA/);
    await as(u.owner, "insert into public.project_members (project_id, student_id) values ($1, $2)", [p, id.sB]);
  });

  it("searches for admins only", async () => {
    const r = await as<{ kind: string }>(u.owner, "select * from public.search_all('Riya')");
    expect(r.some((x) => x.kind === "student")).toBe(true);
    await fails(u.sA, "select * from public.search_all('Riya')", [], /not allowed/);
  });

  it("lists payments without a saved screenshot on the dashboard", async () => {
    const n = await val<number>(u.owner, "select n from public.v_attention where key = 'proof_missing'");
    expect(n).toBeGreaterThan(0);
  });
});
