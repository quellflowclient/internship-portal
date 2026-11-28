import { Plus, TriangleAlert } from "lucide-react";
import { ButtonLink, Card, PageHeader, Pill, Segmented, Toolbar } from "@/components/ui";
import { Chevron, End, List, ListRow, MainCell, Pager, Wide } from "@/components/list";
import { FilterSelect, SearchBox } from "@/components/filters";
import { createClient } from "@/lib/supabase/server";
import { DISPLAY_STATUS, TYPE } from "@/lib/labels";
import { filterHref, hrefWith, paging, sp, type SearchParams } from "@/lib/url";
import { cn } from "@/lib/utils";
import type { StudentListRow, StudentType } from "@/lib/types";
import { safeSearch } from "@/lib/search";
import { STUDENTS_PATH } from "./_parts/shared";
import { QuickView } from "./_parts/quick-view";
import { NewStudentPanel } from "./_parts/new-student";

const TYPES: StudentType[] = ["paid", "free", "stipend"];

export const metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const type = sp(params, "type") as StudentType | undefined;
  const batch = sp(params, "batch");
  const q = safeSearch(sp(params, "q"));
  const open = sp(params, "open");
  const isNew = sp(params, "new") === "1";
  const pg = paging(params);

  let query = supabase.from("v_student_list").select("*", { count: "exact" });
  if (type && TYPES.includes(type)) query = query.eq("type", type);
  if (batch === "none") query = query.eq("display_status", "not_assigned");
  else if (batch) query = query.eq("batch_code", batch);
  if (q) query = query.or(["full_name", "code", "college", "email"].map((c) => `${c}.ilike."%${q}%"`).join(","));

  const countOf = (t?: StudentType) => {
    const c = supabase.from("v_student_list").select("id", { count: "exact", head: true });
    return t ? c.eq("type", t) : c;
  };

  const [list, all, paid, free, stipend, batches, settings] = await Promise.all([
    query.order("code", { ascending: false }).range(pg.from, pg.to),
    countOf(),
    countOf("paid"),
    countOf("free"),
    countOf("stipend"),
    supabase.from("batches").select("code").in("status", ["planned", "running"]).order("start_date"),
    supabase.from("org_settings").select("min_attendance_pct").eq("id", 1).maybeSingle(),
  ]);
  const minAtt = (settings.data as { min_attendance_pct: number } | null)?.min_attendance_pct ?? 75;
  const rows = (list.data ?? []) as StudentListRow[];
  const total = list.count ?? 0;
  const counts = { all: all.count ?? 0, paid: paid.count ?? 0, free: free.count ?? 0, stipend: stipend.count ?? 0 };
  const batchCodes = ((batches.data ?? []) as { code: string }[]).map((b) => b.code);

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title="Students"
        info="New students are created only here. Profile edits and batch assignment happen in each student’s Student 360 page."
        description={`${counts.all} ${counts.all === 1 ? "student" : "students"}`}
        actions={
          <ButtonLink variant="primary" href={hrefWith(STUDENTS_PATH, params, { new: 1, open: null, lead: null })} scroll={false}>
            <Plus aria-hidden />
            New student
          </ButtonLink>
        }
      />

      <Toolbar>
        <Segmented
          label="Student type"
          items={[
            { href: filterHref(STUDENTS_PATH, params, { type: null }), label: `All ${counts.all}`, active: !type },
            ...TYPES.map((t) => ({
              href: filterHref(STUDENTS_PATH, params, { type: t }),
              label: `${TYPE[t].label} ${counts[t]}`,
              active: type === t,
            })),
          ]}
        />
        <FilterSelect
          param="batch"
          label="Batch"
          options={[
            { value: "", label: "All batches" },
            ...batchCodes.map((c) => ({ value: c, label: c })),
            { value: "none", label: "Not assigned" },
          ]}
        />
        <SearchBox placeholder="Search name, code, college or email" />
      </Toolbar>

      <Card>
        <List
          cols="minmax(0,2.2fr) 90px 120px 96px 130px 20px"
          head={[["Student"], ["Type", "wide"], ["Batch", "wide"], ["Attendance", "wide-right"], ["Status"], ["", "wide"]]}
          empty={
            counts.all === 0 ? (
              <>
                No students yet. Use <b>New student</b>, or convert a lead from Leads.
              </>
            ) : (
              "No students match these filters."
            )
          }
        >
          {rows.map((s, i) => {
            const st = DISPLAY_STATUS[s.display_status];
            const low = s.attendance_pct !== null && s.attendance_pct < minAtt;
            return (
              <ListRow key={s.id} href={hrefWith(STUDENTS_PATH, params, { open: s.code, new: null, lead: null })} i={i} selected={open === s.code}>
                <MainCell
                  avatar={s.full_name}
                  title={s.full_name}
                  sub={s.code}
                  narrow={[s.type ? TYPE[s.type].label : null, s.batch_code].filter(Boolean).join(", ") || undefined}
                />
                <Wide>{s.type ? <Pill tone={TYPE[s.type].tone}>{TYPE[s.type].label}</Pill> : <span className="text-fg-3">—</span>}</Wide>
                <Wide className="text-fg-2">{s.batch_code ?? "—"}</Wide>
                <Wide right className={cn("font-semibold", low && "text-bad")}>
                  {low ? <TriangleAlert role="img" aria-label={`Below ${minAtt}%`} className="mr-1 inline size-3.5 align-[-2px]" /> : null}
                  {s.attendance_pct !== null ? `${s.attendance_pct}%` : "—"}
                </Wide>
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
        <Pager path={STUDENTS_PATH} params={params} total={total} page={pg.page} show={pg.show} />
      </Card>

      {open && !isNew ? <QuickView code={open} closeHref={hrefWith(STUDENTS_PATH, params, { open: null })} /> : null}
      {isNew ? (
        <NewStudentPanel leadId={sp(params, "lead")} closeHref={hrefWith(STUDENTS_PATH, params, { new: null, lead: null })} />
      ) : null}
    </div>
  );
}
