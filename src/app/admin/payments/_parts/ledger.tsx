import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, TriangleAlert, X } from "lucide-react";
import { Card, ChipLink, Pill, Segmented, Toolbar } from "@/components/ui";
import {
  Chevron,
  End,
  GroupHeader,
  List,
  ListRow,
  MainCell,
  Pager,
  Wide,
} from "@/components/list";
import { SearchBox } from "@/components/filters";
import { createClient } from "@/lib/supabase/server";
import { MONEY_CATEGORY_LABEL } from "@/lib/labels";
import { cn, formatDay } from "@/lib/utils";
import { filterHref, hrefWith, paging, sp, type SearchParams } from "@/lib/url";
import { safeSearch } from "@/app/admin/students/_parts/shared";
import {
  CATEGORY_TONE,
  modeLabel,
  monthLabel,
  monthStart,
  PANEL_RESET,
  PAYMENTS_PATH,
  shiftMonth,
  signed,
  type EntryRow,
} from "./shared";

type Row = Pick<
  EntryRow,
  | "id"
  | "category"
  | "direction"
  | "amount_inr"
  | "status"
  | "paid_on"
  | "mode"
  | "ref_last4"
  | "note"
  | "proof_saved"
  | "created_at"
> & { student: { id: string; code: string; full_name: string } | null };

const COLS = "minmax(0,2fr) 110px 130px 110px 110px 20px";

export function DirIcon({ direction }: { direction: "in" | "out" }) {
  const inflow = direction === "in";
  const Icon = inflow ? ArrowDownLeft : ArrowUpRight;
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4",
        inflow ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad",
      )}
    >
      <Icon aria-label={inflow ? "Money in" : "Money out"} />
    </span>
  );
}

/** Payments → Ledger: done entries by day (newest first), month or "screenshot not saved". */
export async function LedgerTab({
  params,
  month,
}: {
  params: SearchParams;
  month: string;
}) {
  const supabase = await createClient();
  const dirParam = sp(params, "dir");
  const dir = dirParam === "in" || dirParam === "out" ? dirParam : undefined;
  const proofMissing = sp(params, "proof") === "missing";
  const showVoided = sp(params, "voided") === "1";
  const q = safeSearch(sp(params, "q"));
  const open = sp(params, "open");
  const pg = paging(params);

  let query = supabase
    .from("money_entries")
    .select(
      "id, category, direction, amount_inr, status, paid_on, mode, ref_last4, note, proof_saved, created_at, student:students!inner(id, code, full_name)",
      { count: "exact" },
    );
  if (proofMissing) query = query.eq("status", "done").eq("proof_saved", false);
  else {
    query = query.in("status", showVoided ? ["done", "void"] : ["done"]);
    query = query
      .gte("paid_on", monthStart(month))
      .lt("paid_on", monthStart(shiftMonth(month, 1)));
  }
  if (dir) query = query.eq("direction", dir);
  if (q)
    query = query.or(`full_name.ilike."%${q}%",code.ilike."%${q}%"`, {
      referencedTable: "students",
    });

  const res = await query
    .order("paid_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(pg.from, pg.to);
  const rows = (res.data ?? []) as unknown as Row[];
  const total = res.count ?? 0;

  const nodes: React.ReactNode[] = [];
  let lastDay = "";
  rows.forEach((e, i) => {
    const d = e.paid_on ?? "";
    if (d !== lastDay) {
      nodes.push(
        <GroupHeader key={`d-${d}-${i}`}>
          {d ? formatDay(d) : "No date"}
        </GroupHeader>,
      );
      lastDay = d;
    }
    const voided = e.status === "void";
    const cat = MONEY_CATEGORY_LABEL[e.category];
    nodes.push(
      <ListRow
        key={e.id}
        href={hrefWith(PAYMENTS_PATH, params, { ...PANEL_RESET, open: e.id })}
        i={i}
        selected={open === e.id}
      >
        <MainCell
          icon={<DirIcon direction={e.direction} />}
          title={
            <span className={cn(voided && "text-fg-3 line-through")}>
              {e.student?.full_name ?? "—"}
            </span>
          }
          sub={
            <>
              <span className="qf-narrow-only">
                {voided ? "Voided, " : ""}
                {cat}
                {", "}
              </span>
              {e.note || e.student?.code}
            </>
          }
        />
        <Wide>
          <Pill tone={CATEGORY_TONE[e.category]}>{cat}</Pill>
        </Wide>
        <Wide className="text-fg-2">
          {modeLabel(e.mode)}
          {e.ref_last4 ? ` …${e.ref_last4}` : ""}
        </Wide>
        <Wide>
          {voided ? (
            <Pill>Voided</Pill>
          ) : e.proof_saved ? (
            <Pill tone="ok" dot>
              Saved
            </Pill>
          ) : (
            <Pill tone="bad" dot>
              Not saved
            </Pill>
          )}
        </Wide>
        <End>
          {!e.proof_saved && !voided ? (
            <span
              className="qf-narrow-only text-bad"
              role="img"
              aria-label="Screenshot not saved"
            >
              <TriangleAlert className="size-4" aria-hidden />
            </span>
          ) : null}
          <span
            className={cn(
              "text-sm font-bold tabular-nums",
              voided
                ? "text-fg-3 line-through"
                : e.direction === "in" && "text-ok",
            )}
          >
            {signed(e.direction, e.amount_inr)}
          </span>
        </End>
        <Chevron />
      </ListRow>,
    );
  });

  const base = { tab: "ledger" };
  const filtered = !!(dir || q);
  return (
    <>
      <Toolbar>
        <Segmented
          label="Direction"
          items={[
            {
              href: filterHref(PAYMENTS_PATH, params, {
                ...PANEL_RESET,
                ...base,
                dir: null,
              }),
              label: "All",
              active: !dir,
            },
            {
              href: filterHref(PAYMENTS_PATH, params, {
                ...PANEL_RESET,
                ...base,
                dir: "in",
              }),
              label: "Money in",
              active: dir === "in",
            },
            {
              href: filterHref(PAYMENTS_PATH, params, {
                ...PANEL_RESET,
                ...base,
                dir: "out",
              }),
              label: "Money out",
              active: dir === "out",
            },
          ]}
        />
        <SearchBox placeholder="Search student name or code" />
        {proofMissing ? (
          <ChipLink
            href={filterHref(PAYMENTS_PATH, params, {
              ...PANEL_RESET,
              proof: null,
            })}
            active
          >
            Screenshot not saved
            <X aria-label="Remove filter" />
          </ChipLink>
        ) : (
          <ChipLink
            href={filterHref(PAYMENTS_PATH, params, {
              ...PANEL_RESET,
              voided: showVoided ? null : 1,
            })}
            active={showVoided}
          >
            {showVoided ? "Showing voided" : "Show voided"}
            {showVoided ? <X aria-label="Hide voided" /> : null}
          </ChipLink>
        )}
      </Toolbar>

      <Card>
        <List
          cols={COLS}
          head={[
            ["Student"],
            ["Entry", "wide"],
            ["Mode", "wide"],
            ["Screenshot", "wide"],
            ["Amount", "wide-right"],
            ["", "wide"],
          ]}
          empty={
            proofMissing ? (
              "Every screenshot is saved. Nothing to do here."
            ) : filtered ? (
              "No entries match these filters."
            ) : (
              <>
                Nothing recorded in {monthLabel(month, true)}. Use <b>Record</b>{" "}
                to add a fee, refund, stipend or bonus.
              </>
            )
          }
        >
          {nodes}
        </List>
        <Pager
          path={PAYMENTS_PATH}
          params={params}
          total={total}
          page={pg.page}
          show={pg.show}
        />
      </Card>
    </>
  );
}
