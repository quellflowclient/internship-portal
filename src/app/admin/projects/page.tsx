import type { Metadata } from "next";
import Link from "next/link";
import { FolderGit2, FolderKanban, Plus } from "lucide-react";
import { ButtonLink, Card, Kpi, KpiGrid, PageHeader, Pill, Segmented, Toolbar } from "@/components/ui";
import { Chevron, End, List, ListRow, MainCell, Pager, Wide } from "@/components/list";
import { FilterSelect, SearchBox } from "@/components/filters";
import { createClient } from "@/lib/supabase/server";
import { safeSearch } from "@/lib/search";
import { paging, sp, type SearchParams } from "@/lib/url";
import { cn, formatDate, todayIST } from "@/lib/utils";
import { NewProjectPanel, ProjectPanel } from "./_parts/panels";
import {
  KIND,
  KINDS,
  PROJECTS_PATH,
  STATUS,
  STATUSES,
  projectFilterHref,
  projectHref,
  shortUrl,
  type ProjectKind,
  type ProjectStatus,
} from "./_parts/shared";

export const metadata: Metadata = { title: "Projects" };

type Row = {
  id: string;
  code: string;
  name: string;
  kind: ProjectKind;
  status: ProjectStatus;
  batch_code: string | null;
  github_url: string | null;
  due_on: string | null;
  members: number;
  tasks_total: number;
  tasks_done: number;
  archived_at: string | null;
};

const OPEN: ProjectStatus[] = ["planned", "active", "on_hold"];
const COLS = "minmax(0,2fr) 90px minmax(0,1.3fr) 110px 120px 20px";

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const kindRaw = sp(params, "kind");
  const kind = KINDS.includes(kindRaw as ProjectKind) ? (kindRaw as ProjectKind) : undefined;
  const statusRaw = sp(params, "status");
  const status = statusRaw === "archived" || statusRaw === "due" || STATUSES.includes(statusRaw as ProjectStatus) ? statusRaw : undefined;
  const report = sp(params, "report") === "pending";
  const batch = sp(params, "batch");
  const q = safeSearch(sp(params, "q"));
  const open = sp(params, "open");
  const isNew = sp(params, "new") === "1";
  const pg = paging(params);
  const today = todayIST();
  const in7 = addDays(today, 7);

  let query = supabase
    .from("v_project_list")
    .select("id, code, name, kind, status, batch_code, github_url, due_on, members, tasks_total, tasks_done, archived_at", { count: "exact" });
  if (kind) query = query.eq("kind", kind);
  if (status === "archived") query = query.not("archived_at", "is", null);
  else {
    query = query.is("archived_at", null);
    if (status === "due") query = query.in("status", OPEN).gte("due_on", today).lte("due_on", in7);
    else if (status) query = query.eq("status", status);
  }
  if (report) query = query.eq("report_pending", true);
  if (batch === "none") query = query.is("batch_id", null);
  else if (batch) query = query.eq("batch_code", batch);
  if (q) query = query.or(["name", "code", "college_name", "member_names"].map((c) => `${c}.ilike."%${q}%"`).join(","));

  const head = { count: "exact" as const, head: true };
  const live = () => supabase.from("v_project_list").select("id", head).is("archived_at", null);
  const [list, activeRes, dueRes, reportRes, archivedRes, allRes, clientRes, collegeRes, internalRes, batchesRes] = await Promise.all([
    query.order("created_at", { ascending: false }).order("code", { ascending: false }).range(pg.from, pg.to),
    live().eq("status", "active"),
    live().in("status", OPEN).gte("due_on", today).lte("due_on", in7),
    live().eq("report_pending", true),
    supabase.from("projects").select("id", head).not("archived_at", "is", null),
    live(),
    live().eq("kind", "client"),
    live().eq("kind", "college"),
    live().eq("kind", "internal"),
    supabase.from("batches").select("code").in("status", ["planned", "running", "completed"]).order("start_date", { ascending: false }).limit(50),
  ]);
  const rows = (list.data ?? []) as Row[];
  const total = list.count ?? 0;
  const counts: Record<"all" | ProjectKind, number> = {
    all: allRes.count ?? 0,
    client: clientRes.count ?? 0,
    college: collegeRes.count ?? 0,
    internal: internalRes.count ?? 0,
  };
  const batchCodes = ((batchesRes.data ?? []) as { code: string }[]).map((b) => b.code);
  const filtered = !!(kind || status || report || batch || q);
  const due = dueRes.count ?? 0;
  const reports = reportRes.count ?? 0;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title="Projects"
        info="Client projects need an NDA and a private repo. College projects are for the student’s own college submission and get a project certificate. Projects are created and edited only here."
        description="Client, college and internal projects in one list"
        actions={
          <ButtonLink variant="primary" href={projectHref(params, { new: 1 })} scroll={false}>
            <Plus aria-hidden />
            New project
          </ButtonLink>
        }
      />

      <KpiGrid>
        <Kpi label="Active" value={activeRes.count ?? 0} sub="projects in progress" href={projectFilterHref(params, { status: "active", report: null })} />
        <Kpi
          label="Due in 7 days"
          value={due}
          sub={due ? "due date or college submission" : "nothing due this week"}
          tone={due ? "warn" : undefined}
          href={projectFilterHref(params, { status: "due", report: null })}
        />
        <Kpi
          label="College reports pending"
          value={reports}
          sub="not submitted yet"
          tone={reports ? "warn" : undefined}
          href={projectFilterHref(params, { report: "pending", kind: null, status: null })}
        />
        <Kpi label="Archived" value={archivedRes.count ?? 0} sub="can be restored" href={projectFilterHref(params, { status: "archived", report: null })} />
      </KpiGrid>

      <Toolbar>
        <Segmented
          label="Project kind"
          items={[
            { href: projectFilterHref(params, { kind: null }), label: `All ${counts.all}`, active: !kind },
            ...KINDS.map((k) => ({ href: projectFilterHref(params, { kind: k }), label: `${KIND[k].label} ${counts[k]}`, active: kind === k })),
          ]}
        />
        <FilterSelect
          param="status"
          label="Status"
          options={[
            { value: "", label: "Any status" },
            ...STATUSES.map((s) => ({ value: s, label: STATUS[s].label })),
            { value: "due", label: "Due in 7 days" },
            { value: "archived", label: "Archived" },
          ]}
        />
        <FilterSelect
          param="batch"
          label="Batch"
          options={[{ value: "", label: "All batches" }, ...batchCodes.map((c) => ({ value: c, label: c })), { value: "none", label: "No batch" }]}
        />
        <SearchBox placeholder="Search project, code, student or college" />
      </Toolbar>
      {report ? (
        <p className="-mt-1 text-sm text-fg-2">
          College projects whose report is not submitted yet.{" "}
          <Link href={projectFilterHref(params, { report: null })} scroll={false} className="font-semibold text-accent-ink">
            Show all
          </Link>
        </p>
      ) : null}

      <Card>
        <List
          cols={COLS}
          head={[["Project"], ["Kind", "wide"], ["GitHub", "wide"], ["Due", "wide"], ["Status"], ["", "wide"]]}
          empty={
            filtered ? (
              "No projects match these filters."
            ) : (
              <>
                No projects yet. Use <b>New project</b> to add the first one.
              </>
            )
          }
        >
          {rows.map((p, i) => {
            const st = STATUS[p.status];
            const overdue = !!p.due_on && p.due_on < today && OPEN.includes(p.status) && !p.archived_at;
            return (
              <ListRow key={p.id} href={projectHref(params, { open: p.code })} i={i} selected={open === p.code}>
                <MainCell
                  icon={
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-fg-2 [&_svg]:size-4">
                      <FolderKanban aria-hidden />
                    </span>
                  }
                  title={p.name}
                  sub={[p.code, p.batch_code, `${p.members} ${p.members === 1 ? "member" : "members"}`].filter(Boolean).join(", ")}
                  narrow={KIND[p.kind].label}
                />
                <Wide>
                  <Pill tone={KIND[p.kind].tone}>{KIND[p.kind].label}</Pill>
                </Wide>
                <Wide className="text-fg-3">
                  {p.github_url ? (
                    <span className="flex min-w-0 items-center gap-1.5">
                      <FolderGit2 className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{shortUrl(p.github_url)}</span>
                    </span>
                  ) : (
                    "—"
                  )}
                </Wide>
                <Wide className={cn("text-fg-2", overdue && "font-semibold text-bad")}>
                  {p.due_on ? formatDate(p.due_on) : "—"}
                  {p.tasks_total ? <span className="block text-xs font-normal text-fg-3">{`${p.tasks_done} of ${p.tasks_total} tasks`}</span> : null}
                </Wide>
                <End>
                  {p.archived_at ? (
                    <Pill tone="mute">Archived</Pill>
                  ) : (
                    <Pill tone={st.tone} dot>
                      {st.label}
                    </Pill>
                  )}
                </End>
                <Chevron />
              </ListRow>
            );
          })}
        </List>
        <Pager path={PROJECTS_PATH} params={params} total={total} page={pg.page} show={pg.show} />
      </Card>

      {isNew ? <NewProjectPanel params={params} closeHref={projectHref(params)} /> : open ? <ProjectPanel code={open} params={params} /> : null}
    </div>
  );
}
