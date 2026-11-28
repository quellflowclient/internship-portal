"use server";

/**
 * Payments (docs/19 §7 rows Payments, Payment panel, Stipend run; P5 Money).
 * Every fee, refund, stipend and bonus is recorded, edited or voided only here.
 * Nothing is deleted: Void keeps the row (DB-7); Undo = restoreEntry (DB-8).
 * The database re-checks everything (money_entries checks + guard_money trigger).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/server/guard";
import {
  done,
  fail,
  fromDb,
  fromZod,
  type ActionResult,
} from "@/server/result";
import {
  formToObject,
  optionalText,
  requiredText,
  uuid,
} from "@/lib/validators";
import { todayIST } from "@/lib/utils";

const CATS = [
  "fee",
  "refund",
  "stipend",
  "bonus",
  "other_in",
  "other_out",
] as const;
const MODES = [
  "upi",
  "imps",
  "neft",
  "bank_transfer",
  "cash",
  "other",
] as const;
type Cat = (typeof CATS)[number];
const DIRECTION: Record<Cat, "in" | "out"> = {
  fee: "in",
  other_in: "in",
  refund: "out",
  stipend: "out",
  bonus: "out",
  other_out: "out",
};

function refresh() {
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  revalidatePath("/admin/students/[code]", "page");
}

/** Postgres check / unique errors on money_entries → plain words. Everything else goes through fromDb. */
function moneyError(
  error: { message?: string; code?: string } | null | undefined,
): ActionResult {
  const msg = error?.message ?? "";
  if (error?.code === "23505") {
    return fail(
      "A stipend for this enrolment and month is already recorded. Open it from the ledger instead.",
    );
  }
  if (error?.code === "23514") {
    const c = /constraint "([^"]+)"/.exec(msg)?.[1] ?? "";
    const known: Record<string, string> = {
      money_entries_check:
        "Money in must be a fee or other income; everything else is money out.",
      money_entries_check1:
        "A received or paid entry needs the date paid and the mode.",
      money_entries_check2: "Give a reason to void this entry.",
      money_entries_check3: "A refund must be linked to the fee it returns.",
      money_entries_check4: "A stipend needs the enrolment and the month.",
      money_entries_check5: "Only stipends can be waiting to be paid.",
      money_entries_amount_inr_check: "The amount must be more than 0.",
      money_entries_ref_last4_check: "UTR: use 1 to 6 letters or digits.",
      money_entries_period_month_check: "The stipend month is not valid.",
      stipend_agreements_monthly_inr_check:
        "The monthly amount must be more than 0.",
    };
    if (known[c]) return fail(known[c]);
  }
  return fromDb(error);
}

/* ---------- small schema helpers ---------- */
const pickId = (message: string) =>
  z.string().trim().min(1, message).pipe(z.uuid(message));

const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(uuid.nullable())
  .nullish();

/** "4,999" / "₹4999" → 4999. Whole rupees, more than 0. */
const wholeRupees = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = Number(v.replace(/[₹,\s]/g, ""));
      if (v === "" || !Number.isInteger(n) || n <= 0 || n > 10_000_000) {
        ctx.addIssue({
          code: "custom",
          message: `${label}: enter whole rupees, more than 0`,
        });
        return z.NEVER;
      }
      return n;
    });

const monthToDate = (message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, message)
    .transform((m) => `${m}-01`);

const optionalMonth = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(
    z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick the stipend month")
      .transform((m) => `${m}-01`)
      .nullable(),
  )
  .nullish();

const paidOn = z
  .string()
  .trim()
  .pipe(z.iso.date("Enter the date paid"))
  .refine((d) => d <= todayIST(), "The date paid cannot be in the future");

const refLast = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(
    z
      .string()
      .regex(/^[0-9A-Za-z]{1,6}$/, "UTR: use the last 1 to 6 letters or digits")
      .nullable(),
  )
  .nullish();

const EntryFields = z.object({
  category: z.enum(CATS, { error: "Pick what this entry is" }),
  student_id: pickId("Pick a student"),
  enrollment_id: optionalId,
  amount_inr: wholeRupees("Amount"),
  paid_on: paidOn,
  mode: z.enum(MODES, { error: "Pick how it was paid" }),
  ref_last4: refLast,
  note: optionalText(300),
  related_entry_id: optionalId,
  period_month: optionalMonth,
  proof_saved: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

type EntryInput = z.infer<typeof EntryFields>;

function entryRules(v: EntryInput, ctx: z.RefinementCtx) {
  if ((v.category === "fee" || v.category === "stipend") && !v.enrollment_id) {
    ctx.addIssue({
      code: "custom",
      path: ["enrollment_id"],
      message: "Pick the enrolment",
    });
  }
  if (v.category === "refund" && !v.related_entry_id) {
    ctx.addIssue({
      code: "custom",
      path: ["related_entry_id"],
      message: "Pick the fee this refund returns",
    });
  }
  if (v.category === "stipend" && !v.period_month) {
    ctx.addIssue({
      code: "custom",
      path: ["period_month"],
      message: "Pick the stipend month",
    });
  }
}

const RecordForm = EntryFields.superRefine(entryRules);
const EditForm = EntryFields.extend({ id: uuid }).superRefine(entryRules);

/** The columns written for a received/paid entry; fields that don't apply to the category are cleared. */
function entryRow(v: EntryInput) {
  const linked =
    v.category === "fee" || v.category === "stipend" || v.category === "bonus";
  return {
    student_id: v.student_id,
    enrollment_id: linked ? (v.enrollment_id ?? null) : null,
    category: v.category,
    direction: DIRECTION[v.category],
    amount_inr: v.amount_inr,
    status: "done" as const,
    paid_on: v.paid_on,
    mode: v.mode,
    ref_last4: v.ref_last4 ?? null,
    note: v.note ?? null,
    related_entry_id:
      v.category === "refund" ? (v.related_entry_id ?? null) : null,
    period_month: v.category === "stipend" ? (v.period_month ?? null) : null,
    proof_saved: v.proof_saved,
  };
}

type Supa = Awaited<ReturnType<typeof assertAdmin>>["supabase"];

/** A refund takes the enrolment of the fee it returns; the fee must be a received fee of the same student. */
async function linkRefund(
  supabase: Supa,
  row: ReturnType<typeof entryRow>,
): Promise<ActionResult | null> {
  if (row.category !== "refund") return null;
  const { data } = await supabase
    .from("money_entries")
    .select("student_id, enrollment_id, category, status")
    .eq("id", row.related_entry_id as string)
    .maybeSingle();
  const fee = data as {
    student_id: string;
    enrollment_id: string | null;
    category: string;
    status: string;
  } | null;
  if (
    !fee ||
    fee.student_id !== row.student_id ||
    fee.category !== "fee" ||
    fee.status !== "done"
  ) {
    const m = "Pick a received fee of this student.";
    return fail(m, { related_entry_id: m });
  }
  row.enrollment_id = fee.enrollment_id;
  return null;
}

/* =====================================================================
 * Payments → Record (also Pending fees tap and Stipend run tap)
 * ===================================================================== */
export async function recordEntry(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = RecordForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const row = entryRow(parsed.data);

  const refundProblem = await linkRefund(supabase, row);
  if (refundProblem) return refundProblem;

  let due_on: string | null = null;
  if (row.category === "stipend") {
    // DB-6: paying a stipend = recording the transfer on that month's expected row.
    const { data: existing } = await supabase
      .from("money_entries")
      .select("id, status")
      .eq("category", "stipend")
      .eq("enrollment_id", row.enrollment_id as string)
      .eq("period_month", row.period_month as string)
      .neq("status", "void")
      .maybeSingle();
    const ex = existing as { id: string; status: string } | null;
    if (ex?.status === "done") {
      return fail(
        "This month’s stipend is already recorded for this enrolment. Open it from the ledger to edit it.",
      );
    }
    if (ex) {
      const { data: upd, error } = await supabase
        .from("money_entries")
        .update(row)
        .eq("id", ex.id)
        .eq("status", "expected")
        .select("id");
      if (error) return moneyError(error);
      if (!upd?.length)
        return fail(
          "This stipend row just changed. Close the panel and try again.",
        );
      refresh();
      return done("Entry saved");
    }
    const { data: s } = await supabase
      .from("org_settings")
      .select("stipend_pay_by_day")
      .eq("id", 1)
      .maybeSingle();
    const day =
      (s as { stipend_pay_by_day: number | null } | null)?.stipend_pay_by_day ??
      5;
    const [y, m] = (row.period_month as string).split("-").map(Number);
    const next = new Date(Date.UTC(y, m, day));
    due_on = next.toISOString().slice(0, 10);
  }

  const { data, error } = await supabase
    .from("money_entries")
    .insert({ ...row, due_on })
    .select("id")
    .single();
  if (error || !data) return moneyError(error);
  refresh();
  return done("Entry saved", { undoId: (data as { id: string }).id });
}

/** Undo right after Record: the new entry is voided (it stays in the audit log). */
export async function undoRecord(id: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!uuid.safeParse(id).success) return fail("This entry no longer exists.");
  const { error } = await supabase
    .from("money_entries")
    .update({ status: "void", void_reason: "Undone right after recording" })
    .eq("id", id)
    .neq("status", "void");
  if (error) return moneyError(error);
  refresh();
  return done("Entry voided. It stays in the audit log.");
}

/* =====================================================================
 * Payment panel → Edit
 * ===================================================================== */
export async function updateEntry(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = EditForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const { id, ...v } = parsed.data;

  const { data: before } = await supabase
    .from("money_entries")
    .select("status, category")
    .eq("id", id)
    .maybeSingle();
  const old = before as { status: string; category: Cat } | null;
  if (!old) return fail("This entry no longer exists.");
  if (old.status !== "done")
    return fail(
      "Only received or paid entries can be edited. Restore a voided entry first.",
    );
  if (old.category !== v.category)
    return fail(
      "The kind of entry cannot change. Void it and record a new one.",
    );

  const row = entryRow(v);
  const refundProblem = await linkRefund(supabase, row);
  if (refundProblem) return refundProblem;

  const { error } = await supabase
    .from("money_entries")
    .update(row)
    .eq("id", id)
    .eq("status", "done");
  if (error) return moneyError(error);
  refresh();
  return done("Entry saved");
}

/* =====================================================================
 * Payment panel → "I saved the screenshot" (toggle)
 * ===================================================================== */
const ProofForm = z.object({ id: uuid, saved: z.enum(["0", "1"]) });

export async function markProofSaved(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = ProofForm.safeParse(formToObject(fd));
  if (!parsed.success)
    return fail("Something went wrong. Reload and try again.");
  const saved = parsed.data.saved === "1";
  const { data, error } = await supabase
    .from("money_entries")
    .update({ proof_saved: saved })
    .eq("id", parsed.data.id)
    .eq("status", "done")
    .select("id");
  if (error) return moneyError(error);
  if (!data?.length)
    return fail("Only received or paid entries have a screenshot.");
  refresh();
  return done(
    saved ? "Screenshot marked as saved" : "Screenshot marked as not saved",
  );
}

/* =====================================================================
 * Payment panel → Void (+ Undo / Restore)
 * ===================================================================== */
const VoidForm = z.object({
  id: uuid,
  void_reason: requiredText(300, "Reason"),
});

export async function voidEntry(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = VoidForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const { id, void_reason } = parsed.data;
  const { data, error } = await supabase
    .from("money_entries")
    .update({ status: "void", void_reason })
    .eq("id", id)
    .neq("status", "void")
    .select("id");
  if (error) return moneyError(error);
  if (!data?.length) return fail("This entry is already voided.");
  refresh();
  return done("Entry voided. It stays in the audit log.", { undoId: id });
}

/** Un-void: back to done when it was paid, else back to expected (a stipend not paid yet). */
export async function restoreEntry(id: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!uuid.safeParse(id).success) return fail("This entry no longer exists.");
  const { data } = await supabase
    .from("money_entries")
    .select("status, paid_on, mode")
    .eq("id", id)
    .maybeSingle();
  const row = data as {
    status: string;
    paid_on: string | null;
    mode: string | null;
  } | null;
  if (!row) return fail("This entry no longer exists.");
  if (row.status !== "void") return done("Entry is already active");
  const status = row.paid_on && row.mode ? "done" : "expected";
  const { error } = await supabase
    .from("money_entries")
    .update({ status })
    .eq("id", id)
    .eq("status", "void");
  if (error?.code === "23505")
    return fail(
      "Another row for this stipend month exists, so this one cannot be restored.",
    );
  if (error) return moneyError(error);
  refresh();
  return done("Entry restored");
}

/* =====================================================================
 * Stipend run → Create this month's rows (idempotent)
 * ===================================================================== */
export async function createStipendRows(month: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    return fail("Pick a month first.");
  const { data, error } = await supabase.rpc("create_stipend_rows", {
    p_month: `${month}-01`,
  });
  if (error) return fromDb(error);
  const n = Number(data) || 0;
  refresh();
  if (n === 0)
    return done(
      "No new rows. Every active stipend enrolment with an amount already has one.",
    );
  return done(`${n} ${n === 1 ? "row" : "rows"} created`);
}

/* =====================================================================
 * Stipend run → Agreements: monthly amount from a month on
 * ===================================================================== */
const AgreementForm = z.object({
  enrollment_id: uuid,
  monthly_inr: wholeRupees("Monthly amount"),
  from_month: monthToDate("Pick the month this amount starts"),
  agreed_note: optionalText(200),
});

const prevMonth = (d: string) => {
  const [y, m] = d.split("-").map(Number);
  const t = y * 12 + (m - 1) - 1;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
};

export async function saveAgreement(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = AgreementForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const { data: enr } = await supabase
    .from("enrollments")
    .select("type")
    .eq("id", v.enrollment_id)
    .maybeSingle();
  if ((enr as { type: string } | null)?.type !== "stipend")
    return fail("This enrolment is not a stipend enrolment.");

  const { data: list, error: listErr } = await supabase
    .from("stipend_agreements")
    .select("id, from_month, to_month")
    .eq("enrollment_id", v.enrollment_id)
    .order("from_month");
  if (listErr) return fromDb(listErr);
  const rows = (list ?? []) as {
    id: string;
    from_month: string;
    to_month: string | null;
  }[];

  const later = rows.find((a) => a.from_month > v.from_month);
  if (later) {
    const m = `A later amount already starts in ${later.from_month.slice(0, 7)}. Pick that month or later.`;
    return fail(m, { from_month: m });
  }

  const same = rows.find((a) => a.from_month === v.from_month);
  if (same) {
    const { error } = await supabase
      .from("stipend_agreements")
      .update({
        monthly_inr: v.monthly_inr,
        agreed_note: v.agreed_note ?? null,
      })
      .eq("id", same.id);
    if (error) return moneyError(error);
  } else {
    const open = rows.filter(
      (a) =>
        a.from_month < v.from_month &&
        (!a.to_month || a.to_month >= v.from_month),
    );
    for (const a of open) {
      const { error } = await supabase
        .from("stipend_agreements")
        .update({ to_month: prevMonth(v.from_month) })
        .eq("id", a.id);
      if (error) return fromDb(error);
    }
    const { error } = await supabase.from("stipend_agreements").insert({
      enrollment_id: v.enrollment_id,
      monthly_inr: v.monthly_inr,
      from_month: v.from_month,
      agreed_note: v.agreed_note ?? null,
    });
    if (error) return moneyError(error);
  }

  // Unpaid rows from that month on follow the new amount.
  const { data: changed } = await supabase
    .from("money_entries")
    .update({ amount_inr: v.monthly_inr })
    .eq("category", "stipend")
    .eq("status", "expected")
    .eq("enrollment_id", v.enrollment_id)
    .gte("period_month", v.from_month)
    .select("id");
  refresh();
  const n = changed?.length ?? 0;
  return done(
    n
      ? `Stipend amount saved. ${n} unpaid ${n === 1 ? "row" : "rows"} updated.`
      : "Stipend amount saved",
  );
}
