import Link from "next/link";
import { Clock, FileText, Footprints, Plus, RefreshCw, Shapes, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink, Card, ChipLink, EmptyState, IconLink, PageHeader, Pill, Segmented, Toolbar } from "@/components/ui";
import { Chevron, End, List, ListRow, MainCell, Pager, Wide } from "@/components/list";
import { FilterSelect, SearchBox } from "@/components/filters";
import { WhatsAppIcon } from "@/components/icons";
import { STAGE, STAGES, SOURCE_LABEL } from "@/lib/labels";
import { filterHref, hrefWith, paging, sp, type SearchParams } from "@/lib/url";
import { cn, formatDay, todayIST } from "@/lib/utils";
import { isDue, searchTerm } from "@/lib/leads/view";
import type { Lead, LeadSource, LeadStage } from "@/lib/types";
import { LeadPanel } from "./lead-panel";
import { NewLeadPanel } from "./new-lead-panel";

export const metadata = { title: "Leads" };

const PATH = "/admin/leads";
const BOARD_CARDS = 4;
const COLS = "minmax(0,2fr) 150px 110px 120px 120px 20px";
const ROW_FIELDS = "id, code, full_name, college, interested_track, source, stage, next_follow_up_on";

type Row = Pick<Lead, "id" | "code" | "full_name" | "college" | "interested_track" | "source" | "stage" | "next_follow_up_on">;

const SOURCE_ICON: Record<LeadSource, React.ReactNode> = {
  form: <FileText className="size-3.5 shrink-0" aria-hidden />,
  whatsapp: <WhatsAppIcon className="size-3.5 shrink-0" />,
  referral: <Users className="size-3.5 shrink-0" aria-hidden />,
  walk_in: <Footprints className="size-3.5 shrink-0" aria-hidden />,
  other: <Shapes className="size-3.5 shrink-0" aria-hidden />,
};

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const today = todayIST();

  const view = sp(params, "view") === "list" ? "list" : "board";
  const stageParam = sp(params, "stage");
  const stage = stageParam && (STAGES as string[]).includes(stageParam) ? (stageParam as LeadStage) : null;
  const sourceParam = sp(params, "source");
  const source = sourceParam && sourceParam in SOURCE_LABEL ? (sourceParam as LeadSource) : null;
  const due = sp(params, "due") === "1";
  const term = searchTerm(sp(params, "q"));
  const pg = paging(params);

  /** A fresh query with the toolbar filters applied (stage is applied by the caller). */
  const leads = (opts?: { head?: boolean }) => {
    let q = supabase.from("leads").select(ROW_FIELDS, { count: "exact", head: opts?.head });
    if (source) q = q.eq("source", source);
    if (due) q = q.lte("next_follow_up_on", today).not("stage", "in", "(converted,lost)");
    if (term) {
      const ors = [`full_name.ilike."%${term.text}%"`, `college.ilike."%${term.text}%"`, `code.ilike."%${term.text}%"`];
      if (term.digits) ors.push(`phone.ilike."%${term.digits}%"`);
      q = q.or(ors.join(","));
    }
    return q;
  };
  const ordered = <T extends ReturnType<typeof leads>>(q: T) =>
    q.order("next_follow_up_on", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });

  const [allRes, listRes, ...stageRes] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }),
    ordered(stage ? leads().eq("stage", stage) : leads()).range(pg.from, pg.to),
    ...STAGES.map((st) => ordered(leads().eq("stage", st)).limit(BOARD_CARDS)),
  ]);

  const allTotal = allRes.count ?? 0;
  const byStage = Object.fromEntries(
    STAGES.map((st, i) => [st, { rows: (stageRes[i].data ?? []) as Row[], count: stageRes[i].count ?? 0 }]),
  ) as Record<LeadStage, { rows: Row[]; count: number }>;
  const filteredTotal = STAGES.reduce((n, st) => n + byStage[st].count, 0);
  const rows = (listRes.data ?? []) as Row[];
  const listTotal = listRes.count ?? 0;
  const loadError = allRes.error ?? listRes.error ?? stageRes.find((r) => r.error)?.error;

  const open = sp(params, "open");
  const closeHref = hrefWith(PATH, params, { open: null, lost: null, new: null });

  const header = (
    <PageHeader
      title="Leads"
      info="Leads are added and updated only here. Form responses arrive by themselves. Convert to student opens New student in Students with the lead details filled in."
      description={`${allTotal} ${allTotal === 1 ? "lead" : "leads"} from the form, WhatsApp, referrals and walk-ins`}
      actions={
        <>
          <IconLink
            href={hrefWith(PATH, params)}
            scroll={false}
            outline
            label="Sync new form responses. New answers arrive by themselves within a minute; this reloads the list."
          >
            <RefreshCw aria-hidden />
          </IconLink>
          <ButtonLink href={hrefWith(PATH, params, { new: 1, open: null, lost: null })} scroll={false} variant="primary">
            <Plus aria-hidden />
            Add lead
          </ButtonLink>
        </>
      }
    />
  );

  const panels = (
    <>
      {open ? <LeadPanel id={open} lost={sp(params, "lost") === "1"} params={params} closeHref={closeHref} today={today} /> : null}
      {!open && sp(params, "new") === "1" ? <NewLeadPanel closeHref={closeHref} /> : null}
    </>
  );

  if (loadError) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <Card>
          <EmptyState title="Leads could not be loaded">Check the connection and reload the page. {loadError.message}</EmptyState>
        </Card>
        {panels}
      </div>
    );
  }

  if (allTotal === 0) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <Card>
          <EmptyState
            title="No leads yet"
            action={
              <ButtonLink href={hrefWith(PATH, params, { new: 1 })} scroll={false} variant="primary">
                <Plus aria-hidden />
                Add lead
              </ButtonLink>
            }
          >
            Google Form responses appear here by themselves. Add walk-ins, calls and referrals with Add lead.
          </EmptyState>
        </Card>
        {panels}
      </div>
    );
  }

  const toolbar = (
    <Toolbar>
      <SearchBox placeholder="Search name, college, phone or code" />
      <FilterSelect
        param="source"
        label="Source"
        options={[{ value: "", label: "All sources" }, ...Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))]}
      />
      <ChipLink href={filterHref(PATH, params, { due: due ? null : 1 })} active={due}>
        <Clock aria-hidden />
        Follow-up today
      </ChipLink>
      <span className="hidden md:ml-auto md:block">
        <Segmented
          label="View"
          items={[
            { href: filterHref(PATH, params, { view: null }), label: "Board", active: view === "board" },
            { href: filterHref(PATH, params, { view: "list" }), label: "List", active: view === "list" },
          ]}
        />
      </span>
    </Toolbar>
  );

  if (filteredTotal === 0) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        {toolbar}
        <Card>
          <EmptyState
            title="No leads match"
            action={
              <ButtonLink href={filterHref(PATH, params, { q: null, source: null, due: null, stage: null })} scroll={false}>
                Clear filters
              </ButtonLink>
            }
          >
            {due ? "No follow-ups are due today for these filters." : "Try another name, phone number or source."}
          </EmptyState>
        </Card>
        {panels}
      </div>
    );
  }

  const listBlock = (
    <div className="flex flex-col gap-3">
      <nav aria-label="Stage" className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] md:flex-wrap">
        <ChipLink href={filterHref(PATH, params, { stage: null })} active={!stage}>
          All {filteredTotal}
        </ChipLink>
        {STAGES.map((st) => (
          <ChipLink key={st} href={filterHref(PATH, params, { stage: st })} active={stage === st}>
            {STAGE[st].label} {byStage[st].count}
          </ChipLink>
        ))}
      </nav>
      <Card>
        <List
          cols={COLS}
          head={[["Lead"], ["Track", "wide"], ["Source", "wide"], ["Next follow-up", "wide"], ["Stage"], ["", "wide"]]}
          empty={
            <>
              No leads in this stage.{" "}
              <Link href={filterHref(PATH, params, { stage: null })} scroll={false} className="font-semibold text-accent-ink">
                Show all stages
              </Link>
            </>
          }
        >
          {rows.map((l, i) => {
            const isDueNow = isDue(l.next_follow_up_on, l.stage, today);
            return (
              <ListRow key={l.id} i={i} href={hrefWith(PATH, params, { open: l.id, lost: null, new: null })} selected={open === l.id}>
                <MainCell avatar={l.full_name} title={l.full_name} sub={l.college ?? l.code} narrow={l.interested_track ?? undefined} />
                <Wide>{l.interested_track ?? "—"}</Wide>
                <Wide className="flex items-center gap-1.5 text-fg-3">
                  {SOURCE_ICON[l.source]}
                  {SOURCE_LABEL[l.source]}
                </Wide>
                <Wide className={isDueNow ? "font-semibold text-warn" : "text-fg-3"}>
                  {l.next_follow_up_on ? (isDueNow && l.next_follow_up_on === today ? "Today" : formatDay(l.next_follow_up_on)) : "—"}
                </Wide>
                <End>
                  <Pill tone={STAGE[l.stage].tone} dot>
                    {STAGE[l.stage].label}
                  </Pill>
                </End>
                <Chevron />
              </ListRow>
            );
          })}
        </List>
        <Pager path={PATH} params={params} total={listTotal} page={pg.page} show={pg.show} />
      </Card>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {header}
      {toolbar}
      {view === "board" ? (
        <>
          <div className="hidden grid-cols-[repeat(6,minmax(200px,1fr))] gap-3 overflow-x-auto pb-1.5 md:grid">
            {STAGES.map((st) => {
              const col = byStage[st];
              return (
                <section key={st} aria-label={STAGE[st].label} className="flex min-w-0 flex-col gap-2 rounded-xl border border-line bg-surface-2 p-2">
                  <div className="flex items-center justify-between px-1.5 py-1 text-sm font-semibold">
                    <span>{STAGE[st].label}</span>
                    <Pill tone={STAGE[st].tone}>{col.count}</Pill>
                  </div>
                  {col.rows.map((l) => (
                    <Link
                      key={l.id}
                      href={hrefWith(PATH, params, { open: l.id, lost: null, new: null })}
                      scroll={false}
                      className={cn(
                        "flex flex-col gap-1 rounded-[10px] border bg-surface px-3 py-2.5 text-fg no-underline transition-colors hover:border-accent",
                        open === l.id ? "border-accent" : "border-line",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <b className="truncate text-sm font-semibold">{l.full_name}</b>
                        {isDue(l.next_follow_up_on, l.stage, today) ? <Pill tone="warn">Today</Pill> : null}
                      </span>
                      {l.college ? <small className="truncate text-xs text-fg-3">{l.college}</small> : null}
                      {l.interested_track ? <small className="truncate text-xs text-fg-3">{l.interested_track}</small> : null}
                    </Link>
                  ))}
                  {col.count === 0 ? <p className="px-1.5 py-2 text-xs text-fg-3">No leads</p> : null}
                  {col.count > BOARD_CARDS ? (
                    <Link
                      href={filterHref(PATH, params, { view: "list", stage: st })}
                      scroll={false}
                      className="rounded-md p-1.5 text-center text-xs font-semibold text-accent-ink no-underline hover:bg-surface"
                    >
                      View all {col.count}
                    </Link>
                  ) : null}
                </section>
              );
            })}
          </div>
          <div className="md:hidden">{listBlock}</div>
        </>
      ) : (
        listBlock
      )}
      {panels}
    </div>
  );
}
