import { Card, CardHeader, DL, EmptyState, PageHeader, Pill } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { ENROLLMENT_STATUS, TYPE } from "@/lib/labels";
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
  const { data } = await supabase.from("v_my_enrollments").select("*").order("start_date", { ascending: false });
  const rows = (data ?? []) as MyEnrollment[];

  return (
    <>
      <PageHeader title={`Hi ${profile.full_name?.split(" ")[0] ?? "there"}`} description="Your batch, plan and documents appear here." />
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
                  ["Plan", TYPE[r.type].label],
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
