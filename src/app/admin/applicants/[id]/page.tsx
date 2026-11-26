import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Flash } from "@/components/flash";
import { Button, Card, Field, Input, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { APPLICANT_STATUS_LABEL, ENGAGEMENT_LABEL, ENROLLMENT_STATUS_LABEL } from "@/lib/labels";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatDateTime } from "@/lib/utils";
import { convertApplicant, updateApplicant } from "@/server/actions/admin";
import type { Applicant, ApplicantStatus, EngagementType, EnrollmentStatus } from "@/lib/types";

export const metadata = { title: "Applicant" };

export default async function ApplicantDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const flash = await searchParams;
  const supabase = await createClient();

  const { data: a } = await supabase.from("applicants").select("*").eq("id", id).maybeSingle<Applicant>();
  if (!a) notFound();

  const [{ data: history }, { data: batches }, { data: mentors }, { data: enrolments }] = await Promise.all([
    supabase.from("applicant_status_history").select("from_status, to_status, changed_at").eq("applicant_id", id).order("changed_at"),
    supabase
      .from("batches")
      .select("id, code, name, start_date, status, programs:program_id (name)")
      .in("status", ["planned", "active"])
      .order("start_date"),
    supabase.from("profiles").select("id, full_name, email").eq("role", "mentor").eq("is_active", true).order("full_name"),
    supabase
      .from("enrollments")
      .select("id, status, created_at, batches:batch_id (code), enrollment_terms (engagement_type)")
      .eq("applicant_id", id),
  ]);

  const details: [string, React.ReactNode][] = [
    ["Email", a.email],
    ["Mobile", formatPhone(a.phone_e164)],
    ["City", a.city],
    ["College", a.college],
    ["Course & branch", a.degree],
    ["Year", a.year_of_study],
    ["Role applied", a.role_label],
    ["Skills & tools", a.skills],
    [
      "Portfolio",
      a.portfolio_url ? (
        <a href={a.portfolio_url} target="_blank" rel="noreferrer noopener" className="text-brand underline break-all">
          {a.portfolio_url}
        </a>
      ) : null,
    ],
    ["Previous internship", a.prev_internship],
    [
      "CV",
      a.cv_url?.startsWith("http") ? (
        <a href={a.cv_url} target="_blank" rel="noreferrer noopener" className="text-brand underline">
          Open CV (Drive)
        </a>
      ) : (
        "Not provided"
      ),
    ],
    ["Can start", a.can_start],
    ["Hours / week", a.hours_per_week],
    ["Work mode", a.work_mode],
    ["Anything else", a.extra],
    ["Applied", formatDateTime(a.submitted_at ?? a.created_at)],
  ];

  type Enr = { id: string; status: EnrollmentStatus; created_at: string; batches: { code: string } | null; enrollment_terms: { engagement_type: EngagementType } | null };
  type BatchRow = { id: string; code: string; name: string; start_date: string; programs: { name: string } | null };

  return (
    <>
      <Link href="/admin/applicants" className="mb-4 inline-flex items-center gap-1 text-sm text-ink hover:underline">
        <ArrowLeft className="h-4 w-4" /> Applicants
      </Link>
      <PageHeader
        title={a.full_name}
        description={`${a.candidate_code} · ${a.role_label ?? "Role not set"}`}
        actions={<StatusBadge status={a.status} label={APPLICANT_STATUS_LABEL[a.status]} />}
      />
      <Flash {...flash} />

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {details.map(([k, v]) => (
              <div key={k} className={k === "Skills & tools" || k === "Anything else" ? "sm:col-span-2" : ""}>
                <dt className="text-xs font-semibold text-slate uppercase">{k}</dt>
                <dd className="mt-0.5 text-sm whitespace-pre-wrap text-navy">{v || "—"}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 font-bold">Review</h2>
            <form action={updateApplicant} className="space-y-3">
              <input type="hidden" name="id" value={a.id} />
              <Field label="Status" htmlFor="status">
                <Select id="status" name="status" defaultValue={a.status}>
                  {(Object.keys(APPLICANT_STATUS_LABEL) as ApplicantStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {APPLICANT_STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Internal notes" htmlFor="notes" hint="Visible to admins only">
                <Textarea id="notes" name="notes" defaultValue={a.notes ?? ""} />
              </Field>
              <Button type="submit" className="w-full">
                Save
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-1 font-bold">Enrol in a batch</h2>
            <p className="mb-3 text-xs text-slate">
              Creates the enrolment and invites this email. Money terms are admin-only and appear only in this candidate&apos;s own
              documents.
            </p>
            {!batches?.length || !mentors?.length ? (
              <p className="text-sm text-slate">
                Create a batch and activate at least one mentor first (<Link href="/admin/programs" className="underline">Programs</Link>,{" "}
                <Link href="/admin/users" className="underline">Users</Link>).
              </p>
            ) : (
              <form action={convertApplicant} className="space-y-3">
                <input type="hidden" name="applicant_id" value={a.id} />
                <Field label="Batch" htmlFor="batch_id">
                  <Select id="batch_id" name="batch_id" required>
                    {(batches as unknown as BatchRow[]).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} – {b.programs?.name} ({formatDate(b.start_date)})
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Mentor" htmlFor="mentor_id">
                  <Select id="mentor_id" name="mentor_id" required>
                    {mentors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name ?? m.email}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Hours per week" htmlFor="weekly_hours">
                  <Input id="weekly_hours" name="weekly_hours" type="number" min={1} max={60} defaultValue={20} />
                </Field>
                <Field label="Engagement type" htmlFor="engagement_type" hint="Free / Paid (fee) / Stipend – decided per candidate">
                  <Select id="engagement_type" name="engagement_type" defaultValue="free">
                    {(Object.keys(ENGAGEMENT_LABEL) as EngagementType[]).map((e) => (
                      <option key={e} value={e}>
                        {ENGAGEMENT_LABEL[e]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Stipend ₹" htmlFor="stipend_amount_inr" hint="Stipend type only">
                    <Input id="stipend_amount_inr" name="stipend_amount_inr" type="number" min={0} step="1" />
                  </Field>
                  <Field label="Frequency" htmlFor="stipend_frequency">
                    <Select id="stipend_frequency" name="stipend_frequency" defaultValue="">
                      <option value="">—</option>
                      <option value="monthly">Monthly</option>
                      <option value="one_time">One time</option>
                    </Select>
                  </Field>
                </div>
                <Field label="Fee ₹" htmlFor="fee_amount_inr" hint="Required for Paid">
                  <Input id="fee_amount_inr" name="fee_amount_inr" type="number" min={0} step="1" />
                </Field>
                <Button type="submit" className="w-full">
                  Create enrolment &amp; invite
                </Button>
              </form>
            )}
          </Card>

          {enrolments?.length ? (
            <Card>
              <h2 className="mb-2 font-bold">Enrolments</h2>
              <ul className="space-y-2 text-sm">
                {(enrolments as unknown as Enr[]).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2">
                    <span>
                      {e.batches?.code} · {e.enrollment_terms ? ENGAGEMENT_LABEL[e.enrollment_terms.engagement_type] : "—"}
                    </span>
                    <StatusBadge status={e.status} label={ENROLLMENT_STATUS_LABEL[e.status]} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <h2 className="mb-2 font-bold">History</h2>
            <ol className="space-y-1 text-xs text-ink">
              {(history ?? []).map((h, i) => (
                <li key={i}>
                  {formatDateTime(h.changed_at)} — {h.from_status ? `${h.from_status} → ` : ""}
                  {h.to_status}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
