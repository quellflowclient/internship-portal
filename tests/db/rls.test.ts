/**
 * RLS + function tests for Phase 1 tables (docs/14_TESTING_QA.md – RLS matrix).
 * Runs migrations in PGlite with a Supabase-like auth stub (tests/db/harness.ts).
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createDb, createUser, setRole } from "./harness";

let db: PGlite;
const u: Record<string, string> = {};
const ids: Record<string, string> = {};

async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<T>(sql, params);
  return r.rows[0];
}
async function count(sql: string, params: unknown[] = []): Promise<number> {
  const r = await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) s`, params);
  return r.rows[0].n;
}

beforeAll(async () => {
  db = await createDb();

  // Invitation for the admin before their first login -> auto-activated with role admin.
  await db.query("insert into public.invitations (email, role) values ('admin@qf.test', 'admin')");

  u.superA = await createUser(db, "super@qf.test", "Super A");
  u.admin = await createUser(db, "admin@qf.test", "Admin A");
  u.mentorX = await createUser(db, "mx@qf.test", "Mentor X");
  u.mentorY = await createUser(db, "my@qf.test", "Mentor Y");
  u.studentA = await createUser(db, "sa@qf.test", "Student A");
  u.studentB = await createUser(db, "sb@qf.test", "Student B");
  u.studentC = await createUser(db, "sc@qf.test", "Student C");
  u.uninvited = await createUser(db, "nobody@qf.test", "Nobody");

  await db.query("select public.bootstrap_super_admin('super@qf.test')");
  await setRole(db, u.mentorX, "mentor");
  await setRole(db, u.mentorY, "mentor");
  for (const s of ["studentA", "studentB", "studentC"]) await setRole(db, u[s], "student");

  ids.prog = (await one<{ id: string }>(
    "insert into public.programs (name, track, role_code, duration) values ('AI Automation 45', 'merit', 'AA', 'd45') returning id",
  )).id;
  await db.query("insert into public.program_pricing (program_id, default_fee_inr) values ($1, 4999)", [ids.prog]);
  ids.batchX = (await one<{ id: string }>(
    "insert into public.batches (program_id, code, name, start_date, end_date) values ($1, 'AA-X', 'Batch X', '2026-12-01', '2027-01-15') returning id",
    [ids.prog],
  )).id;
  ids.batchY = (await one<{ id: string }>(
    "insert into public.batches (program_id, code, name, start_date, end_date) values ($1, 'AA-Y', 'Batch Y', '2026-12-01', '2027-01-15') returning id",
    [ids.prog],
  )).id;
  await db.query("insert into public.batch_mentors (batch_id, mentor_id) values ($1, $2), ($3, $4)", [
    ids.batchX, u.mentorX, ids.batchY, u.mentorY,
  ]);

  const enrol = async (student: string, batch: string) =>
    (await one<{ id: string }>(
      `insert into public.enrollments (profile_id, batch_id, program_id, mentor_id, status, start_date, end_date)
       values ($1, $2, $3, $4, 'active', '2026-12-01', '2027-01-15') returning id`,
      [u[student], ids[batch], ids.prog, batch === "batchX" ? u.mentorX : u.mentorY],
    )).id;
  ids.enA = await enrol("studentA", "batchX");
  ids.enB = await enrol("studentB", "batchX");
  ids.enC = await enrol("studentC", "batchY");
  await db.query(
    "insert into public.enrollment_terms (enrollment_id, engagement_type, stipend_amount_inr, stipend_frequency) values ($1, 'stipend', 5000, 'monthly')",
    [ids.enA],
  );
  await db.query("insert into public.enrollment_terms (enrollment_id, engagement_type, fee_amount_inr) values ($1, 'paid', 4999)", [ids.enB]);

  await db.query(
    "insert into public.applicants (candidate_code, email, full_name, role_label, role_code) values ('QF-2627-0001', 'app@x.test', 'Applicant One', 'AI Automation Developer', 'AA')",
  );
});

describe("auth hook & activation", () => {
  it("invited user gets the invited role and is active", async () => {
    const p = await one<{ role: string; is_active: boolean }>("select role, is_active from public.profiles where id = $1", [u.admin]);
    expect(p).toEqual({ role: "admin", is_active: true });
    const inv = await one<{ accepted_at: string | null }>("select accepted_at from public.invitations where lower(email) = 'admin@qf.test'");
    expect(inv.accepted_at).not.toBeNull();
  });

  it("uninvited user is an inactive student with no access", async () => {
    const p = await one<{ role: string; is_active: boolean }>("select role, is_active from public.profiles where id = $1", [u.uninvited]);
    expect(p).toEqual({ role: "student", is_active: false });
    await asUser(db, u.uninvited, async () => {
      expect(await count("select * from public.org_settings")).toBe(0);
      expect(await count("select * from public.applicants")).toBe(0);
      expect((await one<{ v: string | null }>("select public.my_role() as v")).v).toBeNull();
    });
  });

  it("bootstrap_super_admin refuses a second super_admin", async () => {
    await expect(db.query("select public.bootstrap_super_admin('admin@qf.test')")).rejects.toThrow(/already exists/);
  });
});

describe("profiles", () => {
  it("student cannot change own role (column privilege)", async () => {
    await asUser(db, u.studentA, async () => {
      await expect(
        db.query("update public.profiles set role = 'admin' where id = $1", [u.studentA]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("student can update own allowed fields only on own row", async () => {
    await asUser(db, u.studentA, async () => {
      await db.query("update public.profiles set college = 'LDRP' where id = $1", [u.studentA]);
      const r = await db.query("update public.profiles set college = 'hack' where id = $1 returning id", [u.studentB]);
      expect(r.rows.length).toBe(0);
    });
    expect((await one<{ college: string }>("select college from public.profiles where id = $1", [u.studentA])).college).toBe("LDRP");
  });

  it("mentor sees own interns only; student sees own mentor", async () => {
    await asUser(db, u.mentorX, async () => {
      const r = await db.query<{ email: string }>("select email from public.profiles order by email");
      const emails = r.rows.map((x) => x.email);
      expect(emails).toContain("sa@qf.test");
      expect(emails).toContain("sb@qf.test");
      expect(emails).not.toContain("sc@qf.test");
    });
    await asUser(db, u.studentA, async () => {
      const r = await db.query<{ email: string }>("select email from public.profiles order by email");
      expect(r.rows.map((x) => x.email).sort()).toEqual(["mx@qf.test", "sa@qf.test"]);
    });
  });

  it("anon has no table access", async () => {
    await asUser(db, null, async () => {
      await expect(db.query("select * from public.profiles")).rejects.toThrow(/permission denied/);
    });
  });
});

describe("admin_set_user_role", () => {
  it("admin cannot promote to super_admin", async () => {
    await asUser(db, u.admin, async () => {
      await expect(db.query("select public.admin_set_user_role($1, 'super_admin', true)", [u.mentorX])).rejects.toThrow(
        /only a super_admin/,
      );
    });
  });
  it("admin cannot deactivate self", async () => {
    await asUser(db, u.admin, async () => {
      await expect(db.query("select public.admin_set_user_role($1, 'admin', false)", [u.admin])).rejects.toThrow(/yourself/);
    });
  });
  it("student cannot call it", async () => {
    await asUser(db, u.studentA, async () => {
      await expect(db.query("select public.admin_set_user_role($1, 'admin', true)", [u.studentA])).rejects.toThrow(/not allowed/);
    });
  });
  it("admin can activate a mentor", async () => {
    await asUser(db, u.admin, async () => {
      await db.query("select public.admin_set_user_role($1, 'mentor', true)", [u.uninvited]);
    });
    expect((await one<{ role: string }>("select role from public.profiles where id = $1", [u.uninvited])).role).toBe("mentor");
    await setRole(db, u.uninvited, "student", false); // restore
  });
});

describe("applicants & settings", () => {
  it("only admins read applicants", async () => {
    await asUser(db, u.admin, async () => expect(await count("select * from public.applicants")).toBe(1));
    await asUser(db, u.mentorX, async () => expect(await count("select * from public.applicants")).toBe(0));
    await asUser(db, u.studentA, async () => expect(await count("select * from public.applicants")).toBe(0));
  });

  it("status change writes history", async () => {
    await asUser(db, u.admin, async () => {
      await db.query("update public.applicants set status = 'shortlisted' where candidate_code = 'QF-2627-0001'");
    });
    expect(await count("select * from public.applicant_status_history where to_status = 'shortlisted'")).toBe(1);
  });

  it("only super_admin edits org settings and numbering", async () => {
    await asUser(db, u.admin, async () => {
      const r = await db.query("update public.org_settings set brand_name = 'X' where id = 1 returning id");
      expect(r.rows.length).toBe(0);
    });
    await asUser(db, u.superA, async () => {
      const r = await db.query("update public.org_settings set sender_name = 'Quellflow Careers' where id = 1 returning id");
      expect(r.rows.length).toBe(1);
    });
  });
});

describe("money terms are admin + own candidate only (D-04)", () => {
  it("student A sees own terms, not B's", async () => {
    await asUser(db, u.studentA, async () => {
      const r = await db.query<{ engagement_type: string }>("select engagement_type from public.enrollment_terms");
      expect(r.rows).toEqual([{ engagement_type: "stipend" }]);
    });
  });
  it("mentor sees no terms and no pricing", async () => {
    await asUser(db, u.mentorX, async () => {
      expect(await count("select * from public.enrollment_terms")).toBe(0);
      expect(await count("select * from public.program_pricing")).toBe(0);
    });
  });
  it("student sees no pricing", async () => {
    await asUser(db, u.studentA, async () => expect(await count("select * from public.program_pricing")).toBe(0));
  });
  it("admin sees all terms", async () => {
    await asUser(db, u.admin, async () => expect(await count("select * from public.enrollment_terms")).toBe(2));
  });
});

describe("enrollments & batches", () => {
  it("mentor X sees batch X enrolments only", async () => {
    await asUser(db, u.mentorX, async () => {
      expect(await count("select * from public.enrollments")).toBe(2);
      expect(await count("select * from public.batches")).toBe(1);
    });
  });
  it("student sees only own enrolment and batch", async () => {
    await asUser(db, u.studentC, async () => {
      expect(await count("select * from public.enrollments")).toBe(1);
      expect(await count("select * from public.batches where code = 'AA-Y'")).toBe(1);
      expect(await count("select * from public.batches where code = 'AA-X'")).toBe(0);
    });
  });
  it("student cannot modify enrolments", async () => {
    await asUser(db, u.studentA, async () => {
      const r = await db.query("update public.enrollments set weekly_hours = 1 where id = $1 returning id", [ids.enA]);
      expect(r.rows.length).toBe(0);
    });
  });
  it("enrolment changes are audit-logged and audit log is not writable", async () => {
    expect(await count("select * from public.audit_log where entity = 'enrollments'")).toBeGreaterThanOrEqual(3);
    await asUser(db, u.admin, async () => {
      await expect(db.query("insert into public.audit_log (action, entity) values ('x', 'y')")).rejects.toThrow(/permission denied/);
    });
  });
});

describe("document numbering (D-05)", () => {
  it("allocates sequential numbers per type and per role", async () => {
    await asUser(db, u.admin, async () => {
      const a = await one<{ n: string }>("select public.next_document_number('offer_letter') as n");
      const b = await one<{ n: string }>("select public.next_document_number('offer_letter') as n");
      const c1 = await one<{ n: string }>("select public.next_document_number('certificate_completion', 'AA') as n");
      const c2 = await one<{ n: string }>("select public.next_document_number('certificate_completion', 'FS') as n");
      const c3 = await one<{ n: string }>("select public.next_document_number('certificate_completion', 'AA') as n");
      const ay = (await one<{ ay: string }>("select public.academic_year_label() as ay")).ay;
      expect(a.n).toBe(`QF/OFR/${ay}/0001`);
      expect(b.n).toBe(`QF/OFR/${ay}/0002`);
      expect(c1.n).toBe(`QF-C-${ay}-AA-0001`);
      expect(c2.n).toBe(`QF-C-${ay}-FS-0001`);
      expect(c3.n).toBe(`QF-C-${ay}-AA-0002`);
      const p = await one<{ n: string }>("select public.preview_document_number('offer_letter') as n");
      expect(p.n).toBe(`QF/OFR/${ay}/0003`);
    });
  });
  it("role-based pattern without role fails", async () => {
    await asUser(db, u.admin, async () => {
      await expect(db.query("select public.next_document_number('certificate_completion')")).rejects.toThrow(/needs a role/);
    });
  });
  it("students and mentors cannot allocate numbers", async () => {
    for (const who of ["studentA", "mentorX"]) {
      await asUser(db, u[who], async () => {
        await expect(db.query("select public.next_document_number('offer_letter')")).rejects.toThrow(/not allowed/);
      });
    }
  });
  it("academic year boundaries follow the start month (June)", async () => {
    const may = await one<{ v: string }>("select public.academic_year_label('2027-05-31 12:00+05:30') as v");
    const jun = await one<{ v: string }>("select public.academic_year_label('2027-06-01 00:30+05:30') as v");
    expect(may.v).toBe("2627");
    expect(jun.v).toBe("2728");
  });
  it("sequence wider than padding is not truncated", async () => {
    const r = await one<{ v: string }>("select public.format_document_number('QF/{AY}/{SEQ:2}', '2627', '2026', null, null, 12345) as v");
    expect(r.v).toBe("QF/2627/12345");
  });
});
