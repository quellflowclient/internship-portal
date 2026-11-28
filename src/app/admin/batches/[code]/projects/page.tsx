import { notFound } from "next/navigation";
import { FolderGit2, FolderKanban, Info, Plus } from "lucide-react";
import { ButtonLink, Card, Notice, Pill } from "@/components/ui";
import { End, List, ListRow, MainCell, Pager, Wide } from "@/components/list";
import { createClient } from "@/lib/supabase/server";
import { paging, type SearchParams } from "@/lib/url";
import { batchPath, getBatch } from "@/server/queries/batch";
import { KIND, STATUS, openProjectHref, shortUrl, type ProjectKind, type ProjectStatus } from "@/app/admin/projects/_parts/shared";

type Row = {
  id: string;
  code: string;
  name: string;
  kind: ProjectKind;
  status: ProjectStatus;
  github_url: string | null;
  members: number;
  member_names: string | null;
};

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return { title: `${decodeURIComponent(code)} projects` };
}

/** Read-only list of the batch's projects. Projects are created and edited only in Projects (single source of truth). */
export default async function BatchProjects({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<SearchParams> }) {
  const [{ code: raw }, query] = await Promise.all([params, searchParams]);
  const data = await getBatch(decodeURIComponent(raw));
  if (!data) notFound();
  const b = data.batch;
  const supabase = await createClient();
  const pg = paging(query);

  const res = await supabase
    .from("v_project_list")
    .select("id, code, name, kind, status, github_url, members, member_names", { count: "exact" })
    .eq("batch_id", b.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(pg.from, pg.to);
  const rows = (res.data ?? []) as Row[];
  const listHref = `/admin/projects?batch=${encodeURIComponent(b.code)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <Notice icon={<Info aria-hidden />}>Projects are created and edited in Projects. Open one to change members, tasks or status.</Notice>
        </div>
        <ButtonLink href={listHref} className="shrink-0">
          <FolderKanban aria-hidden />
          Open in Projects
        </ButtonLink>
        <ButtonLink href={`${listHref}&new=1`} className="shrink-0">
          <Plus aria-hidden />
          New project
        </ButtonLink>
      </div>

      <Card>
        <List
          cols="minmax(0,2fr) 90px minmax(0,1.3fr) 120px 130px"
          head={[["Project"], ["Kind", "wide"], ["GitHub", "wide"], ["Status", "wide"], ["", "wide-right"]]}
          empty="No projects in this batch."
        >
          {rows.map((p, i) => (
            <ListRow key={p.id} href={openProjectHref(p.code)} i={i}>
              <MainCell
                icon={
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-fg-2 [&_svg]:size-4">
                    <FolderKanban aria-hidden />
                  </span>
                }
                title={p.name}
                sub={[p.code, p.member_names || "No members yet"].join(", ")}
                narrow={`${KIND[p.kind].label}, ${STATUS[p.status].label}`}
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
              <Wide>
                <Pill tone={STATUS[p.status].tone} dot>
                  {STATUS[p.status].label}
                </Pill>
              </Wide>
              <End>
                <span className="text-xs font-semibold text-accent-ink">Open in Projects</span>
              </End>
            </ListRow>
          ))}
        </List>
        <Pager path={batchPath(b.code, "projects")} params={query} total={res.count ?? 0} page={pg.page} show={pg.show} />
      </Card>
    </div>
  );
}
