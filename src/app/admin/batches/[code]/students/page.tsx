import { notFound } from "next/navigation";
import { Info, TriangleAlert, Users } from "lucide-react";
import { ButtonLink, Card, Notice, Pill } from "@/components/ui";
import { Chevron, End, List, ListRow, MainCell, Pager, Wide } from "@/components/list";
import { createClient } from "@/lib/supabase/server";
import { ENROLLMENT_STATUS, TYPE } from "@/lib/labels";
import { paging, type SearchParams } from "@/lib/url";
import { cn } from "@/lib/utils";
import type { EnrollmentStats, EnrollmentStatus, StudentType, Tone } from "@/lib/types";
import { batchPath, getBatch } from "@/server/queries/batch";

const STATUSES: EnrollmentStatus[] = ["assigned", "active", "completed", "not_completed"];

type Row = {
  id: string;
  type: StudentType;
  status: EnrollmentStatus;
  student: { code: string; full_name: string } | null;
};

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return { title: `${decodeURIComponent(code)} students` };
}

function certificate(s: EnrollmentStats | undefined): { label: string; tone: Tone } {
  if (!s || (s.marked === 0 && s.given === 0)) return { label: "Not yet", tone: "mute" };
  return s.eligible ? { label: "On track", tone: "ok" } : { label: "At risk", tone: "warn" };
}

export default async function BatchStudents({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<SearchParams> }) {
  const [{ code: raw }, query] = await Promise.all([params, searchParams]);
  const data = await getBatch(decodeURIComponent(raw));
  if (!data) notFound();
  const b = data.batch;
  const supabase = await createClient();
  const pg = paging(query);

  const [listRes, settingsRes] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id, type, status, student:students(code, full_name)", { count: "exact" })
      .eq("batch_id", b.id)
      .in("status", STATUSES)
      .order("assigned_on")
      .order("id")
      .range(pg.from, pg.to),
    supabase.from("org_settings").select("min_attendance_pct").eq("id", 1).maybeSingle(),
  ]);
  const rows = (listRes.data ?? []) as unknown as Row[];
  const minAtt = (settingsRes.data as { min_attendance_pct: number } | null)?.min_attendance_pct ?? 75;

  const statsRes = rows.length
    ? await supabase.from("v_enrollment_stats").select("*").in("enrollment_id", rows.map((r) => r.id))
    : { data: [] };
  const stats = new Map(((statsRes.data ?? []) as EnrollmentStats[]).map((s) => [s.enrollment_id, s]));
  const canAssign = b.status === "planned" || b.status === "running";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <Notice icon={<Info aria-hidden />}>Students are assigned from their Student 360 page. Use the button to pick from students not in a batch.</Notice>
        </div>
        {canAssign ? (
          <ButtonLink href="/admin/students?batch=none" className="shrink-0">
            <Users aria-hidden />
            Pick students to assign
          </ButtonLink>
        ) : null}
      </div>

      <Card>
        <List
          cols="minmax(0,2fr) 90px 120px 96px 80px 110px 20px"
          head={[["Student"], ["Type", "wide"], ["Status", "wide"], ["Attendance", "wide-right"], ["Tasks", "wide-right"], ["Certificate"], ["", "wide"]]}
          empty="No students in this batch yet."
        >
          {rows.map((r, i) => {
            const s = stats.get(r.id);
            const cert = certificate(s);
            const st = ENROLLMENT_STATUS[r.status];
            const low = s?.attendance_pct != null && s.attendance_pct < minAtt;
            const name = r.student?.full_name ?? "Student";
            return (
              <ListRow key={r.id} href={r.student ? `/admin/students/${encodeURIComponent(r.student.code)}` : batchPath(b.code, "students")} i={i}>
                <MainCell avatar={name} title={name} sub={r.student?.code} narrow={TYPE[r.type].label} />
                <Wide>
                  <Pill tone={TYPE[r.type].tone}>{TYPE[r.type].label}</Pill>
                </Wide>
                <Wide>
                  <Pill tone={st.tone}>{st.label}</Pill>
                </Wide>
                <Wide right className={cn("font-semibold", low && "text-bad")}>
                  {low ? <TriangleAlert role="img" aria-label={`Below ${minAtt}%`} className="mr-1 inline size-3.5 align-[-2px]" /> : null}
                  {s?.attendance_pct != null ? `${s.attendance_pct}%` : "—"}
                </Wide>
                <Wide right className="font-semibold">
                  {s?.tasks_pct != null ? `${s.tasks_pct}%` : "—"}
                </Wide>
                <End>
                  <Pill tone={cert.tone} dot>
                    {cert.label}
                  </Pill>
                </End>
                <Chevron />
              </ListRow>
            );
          })}
        </List>
        <Pager path={batchPath(b.code, "students")} params={query} total={listRes.count ?? 0} page={pg.page} show={pg.show} />
      </Card>
    </div>
  );
}
