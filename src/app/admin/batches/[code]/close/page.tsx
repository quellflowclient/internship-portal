import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Archive, Award, Clock, Download } from "lucide-react";
import { Button, Card, CardHeader, Notice, Pill } from "@/components/ui";
import { ActionButton } from "@/components/toast";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { sp, type SearchParams } from "@/lib/url";
import { formatDate, todayIST } from "@/lib/utils";
import type { EnrollmentStats, EnrollmentStatus, PlanKind, Tone } from "@/lib/types";
import { issueAllEligible } from "@/server/actions/documents";
import { batchPath, getBatch } from "@/server/queries/batch";
import { plural } from "../../_parts/shared";
import { MarkPanel } from "./_parts/mark-panel";
import { ResultsCard, type ResultRow } from "./_parts/results";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return { title: `Close ${decodeURIComponent(code)}` };
}

type Entry = { id: string; kind: PlanKind; attendance: { count: number }[] | null };
type EnrolRow = {
  id: string;
  status: EnrollmentStatus;
  result_note: string | null;
  student: { id: string; code: string; full_name: string } | null;
};

function Step({ n, title, sub, end }: { n: number; title: string; sub: ReactNode; end: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3.5 last:border-b-0">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-fg-2" aria-hidden>
        {n}
      </span>
      <span className="min-w-0 flex-1 basis-[200px]">
        <b className="block text-sm font-semibold">{title}</b>
        <small className="block text-xs break-words text-fg-3">{sub}</small>
      </span>
      <span className="ml-10 shrink-0 md:ml-0">{end}</span>
    </li>
  );
}

const state = (label: string, tone: Tone) => (
  <Pill tone={tone} dot>
    {label}
  </Pill>
);

/** Checklist, results and certificates. The batch ZIP and archiving arrive in Step F. */
export default async function BatchClose({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { code: raw } = await params;
  const query = await searchParams;
  const data = await getBatch(decodeURIComponent(raw));
  if (!data) notFound();
  const { batch: b, progress } = data;
  const { profile } = await requireRole(["admin"]);
  const supabase = await createClient();

  const [entriesRes, enrolRes, settingsRes] = await Promise.all([
    supabase.from("track_entries").select("id, kind, attendance(count)").eq("batch_id", b.id).is("deleted_at", null),
    supabase
      .from("enrollments")
      .select("id, status, result_note, student:students(id, code, full_name)")
      .eq("batch_id", b.id)
      .in("status", ["assigned", "active", "completed", "not_completed"]),
    supabase.from("org_settings").select("min_attendance_pct, local_files_root").eq("id", 1).maybeSingle(),
  ]);
  const entries = (entriesRes.data ?? []) as unknown as Entry[];
  const enrols = (enrolRes.data ?? []) as unknown as EnrolRow[];
  const enrolIds = enrols.map((e) => e.id);
  const settings = settingsRes.data as { min_attendance_pct: number; local_files_root: string } | null;
  const minAtt = settings?.min_attendance_pct ?? 75;

  const [statsRes, certRes] = enrolIds.length
    ? await Promise.all([
        supabase.from("v_enrollment_stats").select("enrollment_id, attendance_pct, tasks_pct, eligible").in("enrollment_id", enrolIds),
        supabase
          .from("documents")
          .select("id, enrollment_id, number, status")
          .eq("type", "certificate")
          .in("enrollment_id", enrolIds)
          .in("status", ["draft", "issued", "accepted"])
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];
  const stats = (statsRes.data ?? []) as Pick<EnrollmentStats, "enrollment_id" | "attendance_pct" | "tasks_pct" | "eligible">[];
  const certs = (certRes.data ?? []) as { id: string; enrollment_id: string; number: string | null; status: string }[];
  const eligible = stats.filter((s) => s.eligible).length;
  const belowMin = stats.filter((s) => s.attendance_pct !== null && s.attendance_pct < minAtt).length;

  const statOf = new Map(stats.map((s) => [s.enrollment_id, s]));
  const certOf = (id: string) =>
    certs.find((c) => c.enrollment_id === id && c.status !== "draft") ?? certs.find((c) => c.enrollment_id === id) ?? null;
  const results: ResultRow[] = enrols
    .filter((e) => e.status === "active" || e.status === "completed")
    .sort((x, y) => (x.student?.full_name ?? "").localeCompare(y.student?.full_name ?? ""))
    .map((e) => {
      const st = statOf.get(e.id);
      const c = certOf(e.id);
      return {
        id: e.id,
        status: e.status,
        result_note: e.result_note,
        student: e.student,
        attendance: st?.attendance_pct ?? null,
        tasks: st?.tasks_pct ?? null,
        eligible: !!st?.eligible,
        certificate: c ? { id: c.id, number: c.number, status: c.status } : null,
      };
    });
  const readyToIssue = results.filter((r) => r.status === "completed" && r.eligible && !(r.certificate && r.certificate.status !== "draft")).length;
  const issuedCount = results.filter((r) => r.certificate && r.certificate.status !== "draft").length;

  const planned = progress?.planned ?? 0;
  const closedItems = (progress?.done ?? 0) + (progress?.skipped ?? 0);
  const needAttendance = entries.filter((e) => e.kind === "session" || e.kind === "test");
  const marked = needAttendance.filter((e) => (e.attendance?.[0]?.count ?? 0) > 0).length;
  const today = todayIST();
  const ended = b.end_date <= today;
  const root = settings?.local_files_root?.replace(/[\\/]+$/, "");
  const zipPath = `${root ? `${root}\\` : ""}batches\\${b.code}\\close\\`;
  const closePath = batchPath(b.code, "close");
  const markId = sp(query, "mark");
  const markRow = markId ? results.find((r) => r.id === markId) : undefined;

  const notice =
    b.status === "completed" ? (
      <>This batch is closed. Its documents stay verifiable.</>
    ) : b.status === "cancelled" ? (
      <>This batch was cancelled. There is nothing to close.</>
    ) : (
      <>
        The batch ends on {formatDate(b.end_date)}. Certificates can be issued any time a student is completed; the batch ZIP and archiving arrive in Step F.
      </>
    );

  return (
    <div className="flex flex-col gap-4">
      <Notice icon={<Clock aria-hidden />}>{notice}</Notice>
      <Card>
        <CardHeader title="Checklist" info="Worked out from the plan, the Live track and attendance. You can check what is ready at any time." />
        <ol>
          <Step
            n={1}
            title="Every plan item done or skipped with a reason"
            sub={planned ? `${closedItems} of ${planned} done or skipped` : "The plan has no items"}
            end={planned && closedItems >= planned ? state("Ready", "ok") : state("Waiting", "mute")}
          />
          <Step
            n={2}
            title="Sessions logged"
            sub={`${plural(entries.length, "entry", "entries")} in the Live track so far`}
            end={ended && entries.length ? state("Ready", "ok") : state("Waiting", "mute")}
          />
          <Step
            n={3}
            title="Attendance marked"
            sub={needAttendance.length ? `${marked} of ${plural(needAttendance.length, "session and test", "sessions and tests")} have attendance` : "No sessions or tests logged yet"}
            end={
              !needAttendance.length ? state("Waiting", "mute") : marked === needAttendance.length ? state("Up to date", "ok") : state(`${needAttendance.length - marked} missing`, "warn")
            }
          />
          <Step
            n={4}
            title="Issue certificates"
            sub={`${eligible} eligible now, ${belowMin} below ${minAtt}% attendance, ${plural(issuedCount, "certificate")} issued`}
            end={
              profile.is_owner && readyToIssue ? (
                <ActionButton action={issueAllEligible.bind(null, b.id)} variant="secondary" className="h-11 px-3 text-xs md:h-8">
                  <Award aria-hidden />
                  Issue all eligible
                </ActionButton>
              ) : readyToIssue ? (
                state("Owner issues", "mute")
              ) : issuedCount ? (
                state("Up to date", "ok")
              ) : (
                state("Waiting", "mute")
              )
            }
          />
          <Step
            n={5}
            title="Export the batch ZIP to the office PC"
            sub={zipPath}
            end={
              <Button variant="secondary" size="sm" disabled>
                <Download aria-hidden />
                Export ZIP
              </Button>
            }
          />
          <Step
            n={6}
            title="Archive the batch"
            sub="Students move to alumni. Documents stay verifiable."
            end={
              <Button variant="secondary" size="sm" disabled>
                <Archive aria-hidden />
                Archive batch
              </Button>
            }
          />
        </ol>
      </Card>

      <ResultsCard rows={results} markHref={(id) => `${closePath}?mark=${id}`} />

      {markRow ? <MarkPanel row={markRow} endDate={b.end_date} today={today} closeHref={closePath} /> : null}
    </div>
  );
}
