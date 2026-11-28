import type { Metadata } from "next";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  TriangleAlert,
} from "lucide-react";
import {
  ButtonLink,
  Card,
  ChipLink,
  IconLink,
  PageHeader,
  Tabs,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { cn, inr } from "@/lib/utils";
import { filterHref, hrefWith, PANEL_PARAMS, sp, type SearchParams } from "@/lib/url";
import { LedgerTab } from "./_parts/ledger";
import { PendingTab } from "./_parts/pending";
import { StipendTab } from "./_parts/stipend";
import { EntryPanel } from "./_parts/entry-panel";
import { RecordPanel } from "./_parts/record-panel";
import { AgreementPanel } from "./_parts/agreement-panel";
import {
  currentMonth,
  isMonth,
  isUuid,
  monthLabel,
  monthStart,
  PAYMENTS_PATH,
  shiftMonth,
  type PayTab,
} from "./_parts/shared";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const t = sp(params, "tab");
  const tab: PayTab = t === "pending" || t === "stipend" ? t : "ledger";
  const thisMonth = currentMonth();
  const m = sp(params, "month");
  const month = isMonth(m) && m <= thisMonth ? m : thisMonth;
  const open = sp(params, "open");
  const isNew = sp(params, "new") === "1";
  const agreement = sp(params, "agreement");
  const proofMissing = sp(params, "proof") === "missing";

  const [mmRes, pendRes, noProofRes, ledgerRes, stipendRes, settingsRes] =
    await Promise.all([
      supabase
        .from("v_money_month")
        .select("money_in, money_out, net")
        .eq("month", monthStart(month))
        .maybeSingle(),
      supabase
        .from("v_fee_balance")
        .select("student_id, pending")
        .gt("pending", 0),
      supabase
        .from("money_entries")
        .select("id", { count: "exact", head: true })
        .eq("status", "done")
        .eq("proof_saved", false),
      supabase
        .from("money_entries")
        .select("id", { count: "exact", head: true })
        .eq("status", "done")
        .gte("paid_on", monthStart(month))
        .lt("paid_on", monthStart(shiftMonth(month, 1))),
      supabase
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("type", "stipend")
        .in("status", ["assigned", "active"]),
      supabase
        .from("org_settings")
        .select("stipend_pay_by_day")
        .eq("id", 1)
        .maybeSingle(),
    ]);
  const mm = (mmRes.data as {
    money_in: number;
    money_out: number;
    net: number;
  } | null) ?? { money_in: 0, money_out: 0, net: 0 };
  const pend = (pendRes.data ?? []) as {
    student_id: string;
    pending: number;
  }[];
  const pendTotal = pend.reduce((s, p) => s + p.pending, 0);
  const noProof = noProofRes.count ?? 0;
  const payDay =
    (settingsRes.data as { stipend_pay_by_day: number | null } | null)
      ?.stipend_pay_by_day ?? 5;

  const monthHref = (to: string) =>
    hrefWith(PAYMENTS_PATH, params, {
      ...PANEL_PARAMS,
      month: to === thisMonth ? null : to,
      page: null,
      show: null,
    });
  const closeHref = hrefWith(PAYMENTS_PATH, params, PANEL_PARAMS);
  const tabHref = (to: PayTab) =>
    filterHref(PAYMENTS_PATH, params, {
      ...PANEL_PARAMS,
      tab: to === "ledger" ? null : to,
      proof: to === "ledger" && proofMissing ? "missing" : null,
    });

  const figures: {
    label: string;
    icon?: React.ReactNode;
    value: string;
    sub: string;
    className?: string;
  }[] = [
    {
      label: "Money in",
      icon: <ArrowDownLeft aria-hidden />,
      value: `+${inr(mm.money_in)}`,
      sub: monthLabel(month, true),
      className: "text-ok",
    },
    {
      label: "Money out",
      icon: <ArrowUpRight aria-hidden />,
      value: `−${inr(mm.money_out)}`,
      sub: "Stipend, refunds, bonus",
    },
    {
      label: "Net",
      value: `${mm.net < 0 ? "−" : ""}${inr(Math.abs(mm.net))}`,
      sub: "In minus out",
    },
  ];

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title="Payments"
        info="Every fee, refund, stipend and bonus is recorded, edited or voided only here. Screenshots stay on the office PC."
        description="Money in and out, for tracking only"
        actions={
          <>
            <div
              role="group"
              aria-label="Month"
              className="inline-flex items-center gap-0.5 rounded-lg border border-line-strong bg-surface p-0.5"
            >
              <IconLink
                href={monthHref(shiftMonth(month, -1))}
                label="Previous month"
                scroll={false}
                className="size-10 md:size-8"
              >
                <ChevronLeft aria-hidden />
              </IconLink>
              <b
                className="min-w-[76px] text-center text-sm tabular-nums"
                aria-live="polite"
              >
                {monthLabel(month)}
              </b>
              {month < thisMonth ? (
                <IconLink
                  href={monthHref(shiftMonth(month, 1))}
                  label="Next month"
                  scroll={false}
                  className="size-10 md:size-8"
                >
                  <ChevronRight aria-hidden />
                </IconLink>
              ) : (
                <span
                  className="grid size-10 place-items-center text-fg-3 opacity-40 md:size-8"
                  aria-hidden
                >
                  <ChevronRight className="size-[18px]" />
                </span>
              )}
            </div>
            <ButtonLink
              variant="primary"
              href={hrefWith(PAYMENTS_PATH, params, { ...PANEL_PARAMS, new: 1 })}
              scroll={false}
            >
              <Plus aria-hidden />
              Record
            </ButtonLink>
          </>
        }
      />

      <Card>
        <div className="grid grid-cols-3">
          {figures.map((f, i) => (
            <div
              key={f.label}
              className={cn(
                "flex min-w-0 flex-col gap-0.5 px-3 py-2.5 md:px-4 md:py-3.5",
                i > 0 && "border-l border-line",
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-fg-2 [&_svg]:size-3.5 max-md:[&_svg]:hidden">
                {f.icon}
                {f.label}
              </span>
              <span
                className={cn(
                  "text-md leading-tight font-bold tabular-nums [overflow-wrap:anywhere] md:text-lg",
                  f.className,
                )}
              >
                {f.value}
              </span>
              <span className="truncate text-xs text-fg-3 max-md:hidden">
                {f.sub}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {pend.length || noProof ? (
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {pend.length ? (
            <ChipLink href={tabHref("pending")} tone="warn">
              <Clock aria-hidden />
              {pend.length} {pend.length === 1 ? "fee" : "fees"} pending,{" "}
              {inr(pendTotal)}
            </ChipLink>
          ) : null}
          {noProof ? (
            <ChipLink
              href={filterHref(PAYMENTS_PATH, params, {
                ...PANEL_PARAMS,
                tab: null,
                proof: proofMissing && tab === "ledger" ? null : "missing",
              })}
              tone="bad"
            >
              <TriangleAlert aria-hidden />
              {noProof} {noProof === 1 ? "screenshot" : "screenshots"} not saved
            </ChipLink>
          ) : null}
        </div>
      ) : null}

      <Tabs
        label="Payment views"
        items={[
          {
            href: tabHref("ledger"),
            label: "Ledger",
            count: ledgerRes.count ?? 0,
            active: tab === "ledger",
          },
          {
            href: tabHref("pending"),
            label: "Pending fees",
            count: pend.length,
            active: tab === "pending",
          },
          {
            href: tabHref("stipend"),
            label: "Stipend run",
            count: stipendRes.count ?? 0,
            active: tab === "stipend",
          },
        ]}
      />

      {tab === "ledger" ? <LedgerTab params={params} month={month} /> : null}
      {tab === "pending" ? <PendingTab params={params} /> : null}
      {tab === "stipend" ? (
        <StipendTab params={params} month={month} payDay={payDay} />
      ) : null}

      {isNew ? (
        <RecordPanel
          entryId={sp(params, "entry")}
          prefill={{
            student: sp(params, "student"),
            category: sp(params, "category"),
            amount: sp(params, "amount"),
            note: sp(params, "note"),
          }}
          month={month}
          closeHref={closeHref}
        />
      ) : isUuid(open) ? (
        <EntryPanel
          id={open}
          voidMode={sp(params, "void") === "1"}
          params={params}
        />
      ) : tab === "stipend" && agreement ? (
        <AgreementPanel enrollmentId={agreement} closeHref={closeHref} />
      ) : null}
    </div>
  );
}
