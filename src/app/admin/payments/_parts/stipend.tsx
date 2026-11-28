import { CalendarPlus } from "lucide-react";
import { Card, CardHeader, Pill } from "@/components/ui";
import { Chevron, End, List, ListRow, MainCell, Wide } from "@/components/list";
import { ActionButton } from "@/components/toast";
import { createClient } from "@/lib/supabase/server";
import { formatDay, inr } from "@/lib/utils";
import { hrefWith, sp, type SearchParams } from "@/lib/url";
import type { EnrollmentStatus } from "@/lib/types";
import { createStipendRows } from "@/server/actions/payments";
import {
  currentMonth,
  dayMonthYear,
  monthLabel,
  monthStart,
  PANEL_RESET,
  payBy,
  PAYMENTS_PATH,
} from "./shared";

export interface AgreementRow {
  id: string;
  monthly_inr: number;
  from_month: string;
  to_month: string | null;
  agreed_note: string | null;
  created_at: string;
}
interface EnrolmentRow {
  id: string;
  status: EnrollmentStatus;
  student: { id: string; code: string; full_name: string } | null;
  batch: { code: string } | null;
  agreements: AgreementRow[];
}
interface MoneyRow {
  id: string;
  enrollment_id: string;
  student_id: string;
  amount_inr: number;
  status: "expected" | "done";
  paid_on: string | null;
  student: { code: string; full_name: string } | null;
  enrollment: { batch: { code: string } | null } | null;
}

/** The agreement that covers a month (first day, YYYY-MM-01), else null. */
export function agreementFor(
  list: AgreementRow[],
  monthDate: string,
): AgreementRow | null {
  return (
    [...list]
      .filter(
        (a) =>
          a.from_month <= monthDate && (!a.to_month || a.to_month >= monthDate),
      )
      .sort((a, b) => b.from_month.localeCompare(a.from_month))[0] ?? null
  );
}

const RUN_COLS = "minmax(0,2fr) 120px 140px 110px 20px";
const AGR_COLS = "minmax(0,2fr) 120px 130px 110px 20px";

/** Payments → Stipend run for one month (DB-6), plus the monthly amounts (stipend_agreements). */
export async function StipendTab({
  params,
  month,
  payDay,
}: {
  params: SearchParams;
  month: string;
  payDay: number;
}) {
  const supabase = await createClient();
  const m1 = monthStart(month);
  const [enrRes, moneyRes] = await Promise.all([
    supabase
      .from("enrollments")
      .select(
        "id, status, student:students(id, code, full_name), batch:batches(code), agreements:stipend_agreements(id, monthly_inr, from_month, to_month, agreed_note, created_at)",
      )
      .eq("type", "stipend")
      .in("status", ["assigned", "active"]),
    supabase
      .from("money_entries")
      .select(
        "id, enrollment_id, student_id, amount_inr, status, paid_on, student:students(code, full_name), enrollment:enrollments(batch:batches(code))",
      )
      .eq("category", "stipend")
      .eq("period_month", m1)
      .neq("status", "void"),
  ]);
  const enrolments = ((enrRes.data ?? []) as unknown as EnrolmentRow[]).sort(
    (a, b) =>
      (a.student?.full_name ?? "").localeCompare(b.student?.full_name ?? ""),
  );
  const money = (moneyRes.data ?? []) as unknown as MoneyRow[];
  const byEnrol = new Map(money.map((r) => [r.enrollment_id, r]));

  type Item = {
    key: string;
    studentId: string;
    name: string;
    code: string;
    batch: string;
    amount: number | null;
    row: MoneyRow | null;
  };
  const items: Item[] = enrolments.map((e) => {
    const row = byEnrol.get(e.id) ?? null;
    return {
      key: e.id,
      studentId: e.student?.id ?? "",
      name: e.student?.full_name ?? "—",
      code: e.student?.code ?? "",
      batch: e.batch?.code ?? "—",
      amount:
        row?.amount_inr ??
        agreementFor(e.agreements ?? [], m1)?.monthly_inr ??
        null,
      row,
    };
  });
  const known = new Set(enrolments.map((e) => e.id));
  for (const r of money) {
    if (known.has(r.enrollment_id)) continue;
    items.push({
      key: r.id,
      studentId: r.student_id,
      name: r.student?.full_name ?? "—",
      code: r.student?.code ?? "",
      batch: r.enrollment?.batch?.code ?? "—",
      amount: r.amount_inr,
      row: r,
    });
  }

  const total = items.reduce((t, x) => t + (x.amount ?? 0), 0);
  const unpaid = money.filter((r) => r.status === "expected").length;
  const status =
    money.length === 0 ? (
      <Pill>Not created</Pill>
    ) : unpaid > 0 ? (
      <Pill tone="warn" dot>
        {unpaid} unpaid
      </Pill>
    ) : (
      <Pill tone="ok" dot>
        All paid
      </Pill>
    );
  const selected = sp(params, "agreement");

  return (
    <>
      <Card>
        <CardHeader
          title={`${monthLabel(month, true)} run`}
          info="Rows are made on the 1st for every active stipend enrolment, using its monthly amount. Tap a student to record the transfer with the amount filled in."
          actions={status}
        />
        <div className="grid grid-cols-3">
          {[
            ["Students", String(items.length)],
            ["Total", inr(total)],
            ["Pay by", dayMonthYear(payBy(month, payDay))],
          ].map(([label, value], i) => (
            <div
              key={label}
              className={
                i
                  ? "flex min-w-0 flex-col gap-0.5 border-l border-line px-3 py-2.5 md:px-4 md:py-3.5"
                  : "flex min-w-0 flex-col gap-0.5 px-3 py-2.5 md:px-4 md:py-3.5"
              }
            >
              <span className="text-xs font-medium whitespace-nowrap text-fg-2">
                {label}
              </span>
              <span className="truncate text-md font-bold tabular-nums md:text-lg">
                {value}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          <small className="min-w-0 flex-1 text-xs text-fg-3">
            {money.length === 0 && month <= currentMonth()
              ? "Not created yet. The daily job makes them on the 1st, or create them now."
              : "Safe to press again: rows that exist are kept."}
          </small>
          <ActionButton
            action={createStipendRows.bind(null, month)}
            variant={money.length === 0 ? "primary" : "secondary"}
          >
            <CalendarPlus aria-hidden />
            Create this month’s rows
          </ActionButton>
        </div>
      </Card>

      <Card>
        <List
          cols={RUN_COLS}
          head={[
            ["Student"],
            ["Batch", "wide"],
            ["Status", "wide"],
            ["Amount", "wide-right"],
            ["", "wide"],
          ]}
          empty={
            <>
              No stipend students. A stipend enrolment is made with{" "}
              <b>Assign to batch</b> in Student 360.
            </>
          }
        >
          {items.map((x, i) => {
            const r = x.row;
            const href = r
              ? r.status === "done"
                ? hrefWith(PAYMENTS_PATH, params, {
                    ...PANEL_RESET,
                    open: r.id,
                  })
                : hrefWith(PAYMENTS_PATH, params, {
                    ...PANEL_RESET,
                    new: 1,
                    category: "stipend",
                    entry: r.id,
                    student: x.studentId,
                    amount: r.amount_inr,
                  })
              : hrefWith(PAYMENTS_PATH, params, {
                  ...PANEL_RESET,
                  new: 1,
                  category: "stipend",
                  student: x.studentId,
                  amount: x.amount ?? null,
                });
            const label = !r
              ? "Not created"
              : r.status === "done"
                ? `Paid on ${formatDay(r.paid_on)}`
                : "Unpaid";
            const tone = !r ? "mute" : r.status === "done" ? "ok" : "warn";
            return (
              <ListRow key={x.key} href={href} i={i}>
                <MainCell
                  avatar={x.name}
                  title={x.name}
                  sub={x.code}
                  narrow={`${x.batch}, ${label}`}
                />
                <Wide className="text-fg-2">{x.batch}</Wide>
                <Wide>
                  <Pill tone={tone} dot>
                    {label}
                  </Pill>
                </Wide>
                <End>
                  <span className="text-sm font-bold tabular-nums">
                    {x.amount ? `−${inr(x.amount)}` : "No amount"}
                  </span>
                </End>
                <Chevron />
              </ListRow>
            );
          })}
        </List>
      </Card>

      <Card>
        <CardHeader
          title="Agreements"
          info="The monthly amount for each stipend enrolment. A change applies from the month you pick; earlier months keep their amount."
        />
        <List
          cols={AGR_COLS}
          head={[
            ["Student"],
            ["Batch", "wide"],
            ["Since", "wide"],
            ["Monthly", "wide-right"],
            ["", "wide"],
          ]}
          empty="No stipend enrolments yet."
        >
          {enrolments.map((e, i) => {
            const now = agreementFor(
              e.agreements ?? [],
              monthStart(currentMonth()),
            );
            const latest =
              [...(e.agreements ?? [])].sort((a, b) =>
                b.from_month.localeCompare(a.from_month),
              )[0] ?? null;
            const a = now ?? latest;
            const name = e.student?.full_name ?? "—";
            return (
              <ListRow
                key={e.id}
                href={hrefWith(PAYMENTS_PATH, params, {
                  ...PANEL_RESET,
                  tab: "stipend",
                  agreement: e.id,
                })}
                i={i}
                selected={selected === e.id}
              >
                <MainCell
                  title={name}
                  sub={e.student?.code}
                  narrow={e.batch?.code}
                />
                <Wide className="text-fg-2">{e.batch?.code ?? "—"}</Wide>
                <Wide className="text-fg-2">
                  {a ? monthLabel(a.from_month.slice(0, 7)) : "—"}
                </Wide>
                <End>
                  {a ? (
                    <span className="text-sm font-semibold tabular-nums">
                      {inr(a.monthly_inr)}
                    </span>
                  ) : (
                    <Pill tone="warn">Not set</Pill>
                  )}
                </End>
                <Chevron />
              </ListRow>
            );
          })}
        </List>
      </Card>
    </>
  );
}
