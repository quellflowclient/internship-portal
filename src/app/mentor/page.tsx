import Link from "next/link";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ENROLLMENT_STATUS_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import type { EnrollmentStatus } from "@/lib/types";

export default async function MentorHome() {
  const supabase = await createClient();
  // RLS: mentors only see enrolments in their own batches.
  const { data: rows } = await supabase
    .from("enrollments")
    .select("id, status, start_date, end_date, profiles:profile_id (full_name, email), batches:batch_id (code, name)")
    .order("start_date", { ascending: true });

  type Row = {
    id: string;
    status: EnrollmentStatus;
    start_date: string | null;
    end_date: string | null;
    profiles: { full_name: string | null; email: string } | null;
    batches: { code: string; name: string } | null;
  };

  return (
    <>
      <PageHeader title="My interns" description="Daily updates, tasks and reviews arrive in Phase 2." />
      {!rows?.length ? (
        <EmptyState title="No interns assigned yet">An admin assigns you to a batch from Programs.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(rows as unknown as Row[]).map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.profiles?.full_name ?? r.profiles?.email ?? "Invite pending"}</p>
                  <p className="text-xs text-slate">{r.batches?.code} · {r.batches?.name}</p>
                </div>
                <StatusBadge status={r.status} label={ENROLLMENT_STATUS_LABEL[r.status]} />
              </div>
              <p className="mt-3 text-sm text-ink">
                {formatDate(r.start_date)} – {formatDate(r.end_date)}
              </p>
            </Card>
          ))}
        </div>
      )}
      <p className="mt-6 text-xs text-slate">
        Need help? Contact the programme admin. <Link href="/" className="underline">Home</Link>
      </p>
    </>
  );
}
