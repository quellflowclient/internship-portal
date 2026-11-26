import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { DURATION_LABEL, ENROLLMENT_STATUS_LABEL, TRACK_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import type { DurationPlan, EnrollmentStatus, ProgramTrack } from "@/lib/types";

export default async function StudentHome() {
  const { profile } = await requireRole(["student"]);
  const supabase = await createClient();
  // RLS: students only see their own enrolment(s).
  const { data } = await supabase
    .from("enrollments")
    .select("id, status, start_date, end_date, programs:program_id (name, track, duration), batches:batch_id (code, name, live_slot)")
    .order("created_at", { ascending: false });

  type Row = {
    id: string;
    status: EnrollmentStatus;
    start_date: string | null;
    end_date: string | null;
    programs: { name: string; track: ProgramTrack; duration: DurationPlan } | null;
    batches: { code: string; name: string; live_slot: string | null } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader
        title={`Hi ${profile.full_name?.split(" ")[0] ?? "there"} 👋`}
        description="Your programme. Tasks, daily updates and documents arrive in the next release."
      />
      {!rows.length ? (
        <EmptyState title="No programme yet">Your enrolment will appear here once the team confirms it.</EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">{r.programs?.name}</h2>
                  <p className="text-xs text-slate">
                    {r.programs ? `${TRACK_LABEL[r.programs.track]} · ${DURATION_LABEL[r.programs.duration]}` : null}
                  </p>
                </div>
                <StatusBadge status={r.status} label={ENROLLMENT_STATUS_LABEL[r.status]} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-slate">Batch</dt>
                  <dd>{r.batches?.code ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate">Live slot</dt>
                  <dd>{r.batches?.live_slot ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate">Starts</dt>
                  <dd>{formatDate(r.start_date)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate">Ends</dt>
                  <dd>{formatDate(r.end_date)}</dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
