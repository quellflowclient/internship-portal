import Link from "next/link";
import { Info } from "lucide-react";
import { Avatar, Card, IconAnchor, Notice } from "@/components/ui";
import { List, Pager, Wide } from "@/components/list";
import { WhatsAppIcon, waLink } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { cn, inr } from "@/lib/utils";
import { hrefWith, PANEL_PARAMS, paging, type SearchParams } from "@/lib/url";
import type { EnrollmentStatus } from "@/lib/types";
import { PAYMENTS_PATH } from "./shared";

interface Balance {
  student_id: string;
  agreed: number;
  paid: number;
  refunded: number;
  pending: number;
}
interface StudentRow {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
  enrollments: {
    type: string;
    status: EnrollmentStatus;
    start_date: string;
    batch: { code: string } | null;
  }[];
}

const OPEN: EnrollmentStatus[] = ["assigned", "active"];
const COLS = "minmax(0,2fr) 110px 100px 100px minmax(120px,auto)";

/** Payments → Pending fees: v_fee_balance where pending > 0. Tap = Record with student + amount filled. */
export async function PendingTab({ params }: { params: SearchParams }) {
  const supabase = await createClient();
  const pg = paging(params);
  const { data: bal } = await supabase
    .from("v_fee_balance")
    .select("student_id, agreed, paid, refunded, pending")
    .gt("pending", 0)
    .order("pending", { ascending: false });
  const balances = (bal ?? []) as Balance[];
  const ids = balances.map((b) => b.student_id);
  const { data: studs } = ids.length
    ? await supabase
        .from("students")
        .select(
          "id, code, full_name, phone, enrollments(type, status, start_date, batch:batches(code))",
        )
        .in("id", ids)
    : { data: [] };
  const byId = new Map(
    ((studs ?? []) as unknown as StudentRow[]).map((s) => [s.id, s]),
  );
  const rows = balances.filter((b) => byId.has(b.student_id));
  const page = rows.slice(pg.from, pg.to + 1);

  return (
    <>
      <Notice icon={<Info aria-hidden />}>
        Tap a student to record the payment with the amount filled in. Use the
        WhatsApp icon to send a reminder.
      </Notice>
      <Card>
        <List
          cols={COLS}
          head={[
            ["Student"],
            ["Batch", "wide"],
            ["Agreed", "wide-right"],
            ["Paid", "wide-right"],
            ["Due", "wide-right"],
          ]}
          empty="No fees pending. Every paid student is up to date."
        >
          {page.map((b, i) => {
            const s = byId.get(b.student_id)!;
            const paidEnrolments = (s.enrollments ?? [])
              .filter((e) => e.type === "paid")
              .sort((x, y) => y.start_date.localeCompare(x.start_date));
            const enrol =
              paidEnrolments.find((e) => OPEN.includes(e.status)) ??
              paidEnrolments[0];
            const batch = enrol?.batch?.code ?? "—";
            const first = s.full_name.trim().split(/\s+/)[0] ?? s.full_name;
            const wa = waLink(
              s.phone,
              `Hi ${first}, a reminder that ${inr(b.pending)} of your Quellflow course fee is pending. – Quellflow`,
            );
            const href = hrefWith(PAYMENTS_PATH, params, {
              ...PANEL_PARAMS,
              tab: "pending",
              new: 1,
              category: "fee",
              student: s.id,
              amount: b.pending,
            });
            return (
              <div
                key={b.student_id}
                style={{ ["--i" as string]: Math.min(i, 10) }}
                className="qf-list-row qf-row relative min-h-[52px] border-b border-line py-2 transition-colors last:border-b-0 hover:bg-hover"
              >
                <Link
                  href={href}
                  scroll={false}
                  className="flex min-w-0 items-center gap-2.5 text-fg no-underline after:absolute after:inset-0 focus-visible:outline-offset-[-2px]"
                  aria-label={`Record ${s.full_name}’s fee payment`}
                >
                  <Avatar name={s.full_name} />
                  <span className="min-w-0">
                    <b className="line-clamp-2 font-semibold break-words md:line-clamp-1">
                      {s.full_name}
                    </b>
                    <small className="block truncate text-xs text-fg-3">
                      {s.code}
                      <span className="qf-narrow-only">, {batch}</span>
                    </small>
                  </span>
                </Link>
                <Wide className="text-fg-2">{batch}</Wide>
                <Wide right className="tabular-nums">
                  {inr(b.agreed)}
                </Wide>
                <Wide right className="tabular-nums text-fg-2">
                  {inr(b.paid - b.refunded)}
                </Wide>
                <span className="flex items-center gap-1 justify-self-end whitespace-nowrap">
                  <span className="text-sm font-bold text-warn tabular-nums">
                    <span className="sr-only">Due </span>
                    {inr(b.pending)}
                  </span>
                  {wa ? (
                    <IconAnchor
                      href={wa}
                      label={`Send ${first} a reminder on WhatsApp`}
                      className={cn("relative z-10 text-wa")}
                    >
                      <WhatsAppIcon className="size-[18px]" />
                    </IconAnchor>
                  ) : null}
                </span>
              </div>
            );
          })}
        </List>
        <Pager
          path={PAYMENTS_PATH}
          params={params}
          total={rows.length}
          page={pg.page}
          show={pg.show}
        />
      </Card>
    </>
  );
}
