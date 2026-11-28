import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Archive, Award, Clock, Download, Undo2 } from "lucide-react";
import { ButtonLink, Card, CardHeader, Notice, Pill, buttonClass } from "@/components/ui";
import { ActionButton } from "@/components/toast";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { sp, type SearchParams } from "@/lib/url";
import { formatDate, todayIST } from "@/lib/utils";
import type { EnrollmentStats, EnrollmentStatus, PlanKind, Tone } from "@/lib/types";
import { issueAllEligible } from "@/server/actions/documents";
import { reopenBatch } from "@/server/actions/batch-close";
import { batchPath, getBatch } from "@/server/queries/batch";
import { plural } from "../../_parts/shared";
import { ArchivePanel } from "./_parts/archive-panel";
import { MarkPanel, type Outcome } from "./_parts/mark-panel";
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

/** close_batch() can be undone for 2 minutes (reopen_batch); same window as restoring a revoked document. */
const UNDO_MS = 2 * 60 * 1000;
const canUndoClose = (closedAt: string | null | undefined) => !!closedAt && Date.parse(closedAt) > Date.now() - UNDO_MS;

const state = (label: string, tone: Tone) => (
  <Pill tone={tone} dot>
    {label}
  </Pill>
);

/** Checklist, results (completed / not completed), certificates, the batch ZIP and Archive batch (docs/19 P7). */
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
      .order("created_at"),
    supabase.from("org_settings").select("min_attendance_pct, local_files_root").eq("id", 1).maybeSingle(),
  ]);
  const entries = (entriesRes.data ?? []) as unknown as Entry[];
  const allEnrols = (enrolRes.data ?? []) as unknown as EnrolRow[];
  const enrols = allEnrols.filter((e) => ["assigned", "active", "completed", "not_completed"].includes(e.status));
  const enrolIds = enrols.map((e) => e.id);
  const openCount = enrols.filter((e) => e.status === "assigned" || e.status === "active").length;
  const finishedCount = enrols.filter((e) => e.status === "completed" || e.status === "not_completed").length;
  const settings = settingsRes.data as { min_attendance_pct: number; local_files_root: string } | null;
  const minAtt = settings?.min_attendance_pct ?? 75;

  const allIds = allEnrols.map((e) => e.id);
  const { count: docCount } = allIds.length
    ? await supabase.from("documents").select("id", { count: "exact", head: true }).in("enrollment_id", allIds).in("status", ["issued", "accepted"])
    : { count: 0 };
  const issuedDocs = docCount ?? 0;

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
    .filter((e) => e.status === "active" || e.status === "completed" || e.status === "not_completed")
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
  const closed = b.status === "completed";
  const closedAt = (b as typeof b & { closed_at?: string | null }).closed_at;
  const undoable = closed && canUndoClose(closedAt);
  const canArchive = b.status === "running" && openCount === 0;
  const markId = closed ? undefined : sp(query, "mark");
  const markRow = markId ? results.find((r) => r.id === markId) : undefined;
  const outcome: Outcome = sp(query, "result") === "not" ? "not_completed" : markRow?.status === "not_completed" && !sp(query, "result") ? "not_completed" : "completed";
  const markHref = (id: string, o?: Outcome) => `${closePath}?mark=${id}${o === "not_completed" ? "&result=not" : o === "completed" ? "&result=done" : ""}`;
  const showArchive = canArchive && sp(query, "archive") === "1";
  const zipHref = `/api/batches/${encodeURIComponent(b.code)}/zip`;

  const notice =
    b.status === "completed" ? (
      <>This batch is archived. Results are final and its documents stay verifiable.</>
    ) : b.status === "cancelled" ? (
      <>This batch was cancelled. There is nothing to close.</>
    ) : (
      <>
        The batch ends on {formatDate(b.end_date)}. Set each student&apos;s result, issue certificates, export the ZIP, then archive the batch.
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
            sub={
              <>
                {issuedDocs ? `${plural(issuedDocs, "issued document")} as PDFs. Save to ` : "Issued documents as PDFs. Save to "}
                {zipPath}
              </>
            }
            end={
              issuedDocs ? (
                <a href={zipHref} download className={buttonClass("secondary", "sm", "h-11 no-underline md:h-8")}>
                  <Download aria-hidden />
                  Export ZIP
                </a>
              ) : (
                state("No documents yet", "mute")
              )
            }
          />
          <Step
            n={6}
            title="Archive the batch"
            sub={
              closed
                ? undoable
                  ? "Archived just now. Undo is possible for 2 minutes."
                  : "Archived. Students moved to alumni. Documents stay verifiable."
                : b.status === "cancelled"
                  ? "A cancelled batch is not archived."
                  : openCount
                    ? `${plural(openCount, "student")} still without a result. Mark each one completed or not completed first.`
                    : "Students with no other open enrolment move to alumni. Documents stay verifiable."
            }
            end={
              closed ? (
                undoable ? (
                  <ActionButton action={reopenBatch.bind(null, b.id)} variant="secondary" className="h-11 px-3 text-xs md:h-8">
                    <Undo2 aria-hidden />
                    Undo archive
                  </ActionButton>
                ) : (
                  state("Archived", "ok")
                )
              ) : canArchive ? (
                <ButtonLink href={`${closePath}?archive=1`} scroll={false} size="sm" variant="secondary">
                  <Archive aria-hidden />
                  Archive batch
                </ButtonLink>
              ) : b.status === "cancelled" ? (
                state("Cancelled", "mute")
              ) : (
                state("Waiting", "mute")
              )
            }
          />
        </ol>
      </Card>

      <ResultsCard rows={results} markHref={markHref} locked={closed} />

      {markRow ? (
        <MarkPanel row={markRow} outcome={outcome} endDate={b.end_date} today={today} closeHref={closePath} markHref={markHref} />
      ) : null}
      {showArchive ? <ArchivePanel batchId={b.id} code={b.code} finished={finishedCount} issued={issuedDocs} closeHref={closePath} /> : null}
    </div>
  );
}
