import { ButtonLink, Card, CardHeader, DL, EmptyState, PageHeader, Pill } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { ACCEPT_DOC_TYPES, ENROLLMENT_STATUS, TYPE } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import type { EnrollmentStatus, StudentType } from "@/lib/types";

type MyEnrollment = {
  enrollment_id: string;
  type: StudentType;
  status: EnrollmentStatus;
  start_date: string;
  end_date: string;
  batch_code: string;
  course_name: string;
  duration_days: number;
  session_time: string | null;
  attendance_pct: number | null;
};

export default async function StudentHome() {
  const { profile } = await requireRole(["student"]);
  const supabase = await createClient();
  // v_my_enrollments shows only the signed-in student's enrolments, without fees.
  const [{ data }, { count: toSign }] = await Promise.all([
    supabase.from("v_my_enrollments").select("*").order("start_date", { ascending: false }),
    // RLS: only the student's own non-draft documents.
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "issued").in("type", ACCEPT_DOC_TYPES),
  ]);
  const rows = (data ?? []) as MyEnrollment[];
  const awaiting = toSign ?? 0;

  return (
    <>
      <PageHeader title={`Hi ${profile.full_name?.split(" ")[0] ?? "there"}`} description="Your batch, plan and documents appear here." />
      <Card>
        <CardHeader
          title="Documents"
          actions={awaiting ? <Pill tone="warn" dot>{awaiting === 1 ? "1 to sign" : `${awaiting} to sign`}</Pill> : null}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-fg-2">
            {awaiting ? `${awaiting === 1 ? "1 document waits" : `${awaiting} documents wait`} for your signature.` : "Your offer letter, terms and certificates."}
          </p>
          <ButtonLink href="/student/documents" variant={awaiting ? "primary" : "secondary"}>
            {awaiting ? "Review and sign" : "Open documents"}
          </ButtonLink>
        </div>
      </Card>
      {rows.length === 0 ? (
        <Card>
          <EmptyState title="You are not in a batch yet">The Quellflow team will add you to a batch. You will see its plan and links here.</EmptyState>
        </Card>
      ) : (
        rows.map((r) => (
          <Card key={r.enrollment_id}>
            <CardHeader title={`${r.course_name}, ${r.duration_days} days`} actions={<Pill tone={ENROLLMENT_STATUS[r.status].tone} dot>{ENROLLMENT_STATUS[r.status].label}</Pill>} />
            <div className="p-4">
              <DL
                items={[
                  ["Batch", r.batch_code],
                  ["Dates", `${formatDate(r.start_date)} to ${formatDate(r.end_date)}`],
                  ["Timing", r.session_time ?? "—"],
                  ["Type", TYPE[r.type].label],
                  ["Attendance", r.attendance_pct != null ? `${r.attendance_pct}%` : "Not marked yet"],
                ]}
              />
            </div>
          </Card>
        ))
      )}
    </>
  );
}
