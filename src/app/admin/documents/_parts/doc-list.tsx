import { FileText } from "lucide-react";
import { Card, Pill, Toolbar } from "@/components/ui";
import { Chevron, End, List, ListRow, MainCell, Pager, Wide } from "@/components/list";
import { FilterSelect, SearchBox } from "@/components/filters";
import { createClient } from "@/lib/supabase/server";
import { DOC_DISPLAY, DOC_TYPE_LABEL } from "@/lib/labels";
import { safeSearch } from "@/lib/search";
import type { DocumentListRow } from "@/lib/types";
import { paging, sp, type SearchParams } from "@/lib/url";
import { formatDate } from "@/lib/utils";
import { DOC_GROUPS, type DocGroup } from "@/server/documents/rules";
import { docHref, DOCS_PATH, STATUS_FILTER } from "./shared";

const COLS = "minmax(0,2fr) minmax(0,1.3fr) 110px 70px 110px 20px";

/** Documents list: newest first (drafts on top), filtered by type group, status and search. */
export async function DocList({ params, group }: { params: SearchParams; group: DocGroup | null }) {
  const supabase = await createClient();
  const statusRaw = sp(params, "status");
  const status = STATUS_FILTER.some((o) => o.value && o.value === statusRaw) ? statusRaw : undefined;
  const q = safeSearch(sp(params, "q"));
  const open = sp(params, "open");
  const pg = paging(params);

  let query = supabase
    .from("v_document_list")
    .select("id, type, number, status, student_id, student_name, student_code, enrollment_id, issued_at, display_status, scans", {
      count: "exact",
    });
  if (group) query = query.in("type", DOC_GROUPS.find((g) => g.key === group)?.types ?? []);
  if (status) query = query.eq("display_status", status);
  if (q) query = query.or(`number.ilike."%${q}%",student_name.ilike."%${q}%",student_code.ilike."%${q}%"`);
  const res = await query
    .order("issued_at", { ascending: false, nullsFirst: true })
    .order("number", { ascending: false })
    .range(pg.from, pg.to);
  const rows = (res.data ?? []) as DocumentListRow[];
  const total = res.count ?? 0;

  return (
    <>
      <Toolbar>
        <FilterSelect param="status" label="Status" options={STATUS_FILTER} />
        <SearchBox placeholder="Search number or student" />
      </Toolbar>
      <Card>
        <List
          cols={COLS}
          head={[["Document"], ["Student", "wide"], ["Issued", "wide"], ["Scans", "wide"], ["Status", "wide-right"], ["", "wide"]]}
          empty={
            status || q || group
              ? "No documents match these filters."
              : (
                  <>
                    No documents yet. Use <b>Issue document</b> to make the first one.
                  </>
                )
          }
        >
          {rows.map((d, i) => {
            const st = DOC_DISPLAY[d.display_status] ?? DOC_DISPLAY.issued;
            return (
              <ListRow key={d.id} href={docHref(params, { open: d.id })} i={i} selected={open === d.id}>
                <MainCell
                  icon={
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-fg-2 [&_svg]:size-4">
                      <FileText aria-hidden />
                    </span>
                  }
                  title={DOC_TYPE_LABEL[d.type] ?? d.type}
                  sub={d.number ?? "Draft"}
                  narrow={d.student_name}
                />
                <Wide>
                  {d.student_name}
                  <span className="block truncate text-xs text-fg-3">{d.student_code}</span>
                </Wide>
                <Wide className="text-fg-2">{d.issued_at ? formatDate(d.issued_at) : "Not issued"}</Wide>
                <Wide className="text-fg-2 tabular-nums">{d.scans}</Wide>
                <End>
                  <Pill tone={st.tone} dot>
                    {st.label}
                  </Pill>
                </End>
                <Chevron />
              </ListRow>
            );
          })}
        </List>
        <Pager path={DOCS_PATH} params={params} total={total} page={pg.page} show={pg.show} />
      </Card>
    </>
  );
}
