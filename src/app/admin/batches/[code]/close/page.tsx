import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Archive, Award, Clock, Download } from "lucide-react";
import { Button, Card, CardHeader, Notice, Pill } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { formatDate, todayIST } from "@/lib/utils";
import type { EnrollmentStats, PlanKind, Tone } from "@/lib/types";
import { getBatch } from "@/server/queries/batch";
import { plural } from "../../_parts/shared";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return { title: `Close ${decodeURIComponent(code)}` };
}

type Entry = { id: string; kind: PlanKind; attendance: { count: number }[] | null };

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

/** Read-only checklist until Steps E and F make closing work. */
export default async function BatchClose({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const data = await getBatch(decodeURIComponent(raw));
  if (!data) notFound();
  const { batch: b, progress } = data;
  const supabase = await createClient();

  const [entriesRes, enrolRes, settingsRes] = await Promise.all([
    supabase.from("track_entries").select("id, kind, attendance(count)").eq("batch_id", b.id).is("deleted_at", null),
    supabase.from("enrollments").select("id").eq("batch_id", b.id).in("status", ["assigned", "active", "completed", "not_completed"]),
    supabase.from("org_settings").select("min_attendance_pct, local_files_root").eq("id", 1).maybeSingle(),
  ]);
  const entries = (entriesRes.data ?? []) as unknown as Entry[];
  const enrolIds = ((enrolRes.data ?? []) as { id: string }[]).map((e) => e.id);
  const settings = settingsRes.data as { min_attendance_pct: number; local_files_root: string } | null;
  const minAtt = settings?.min_attendance_pct ?? 75;

  const statsRes = enrolIds.length
    ? await supabase.from("v_enrollment_stats").select("enrollment_id, attendance_pct, eligible").in("enrollment_id", enrolIds)
    : { data: [] };
  const stats = (statsRes.data ?? []) as Pick<EnrollmentStats, "enrollment_id" | "attendance_pct" | "eligible">[];
  const eligible = stats.filter((s) => s.eligible).length;
  const belowMin = stats.filter((s) => s.attendance_pct !== null && s.attendance_pct < minAtt).length;

  const planned = progress?.planned ?? 0;
  const closedItems = (progress?.done ?? 0) + (progress?.skipped ?? 0);
  const needAttendance = entries.filter((e) => e.kind === "session" || e.kind === "test");
  const marked = needAttendance.filter((e) => (e.attendance?.[0]?.count ?? 0) > 0).length;
  const ended = b.end_date <= todayIST();
  const root = settings?.local_files_root?.replace(/[\\/]+$/, "");
  const zipPath = `${root ? `${root}\\` : ""}batches\\${b.code}\\close\\`;

  const notice =
    b.status === "completed" ? (
      <>This batch is closed. Its documents stay verifiable.</>
    ) : b.status === "cancelled" ? (
      <>This batch was cancelled. There is nothing to close.</>
    ) : (
      <>
        Closing opens on {formatDate(b.end_date)}. Certificates and the batch ZIP arrive in Steps E and F.
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
            title="Generate certificates"
            sub={`${eligible} eligible now, ${belowMin} below ${minAtt}% attendance`}
            end={
              <Button variant="secondary" size="sm" disabled>
                <Award aria-hidden />
                Generate certificates
              </Button>
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
    </div>
  );
}
