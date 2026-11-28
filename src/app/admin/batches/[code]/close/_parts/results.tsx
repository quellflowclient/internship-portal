import Link from "next/link";
import { Award, CheckCheck, CircleSlash } from "lucide-react";
import { ButtonLink, Card, CardHeader, Pill } from "@/components/ui";
import { ENROLLMENT_STATUS } from "@/lib/labels";
import type { EnrollmentStatus } from "@/lib/types";

export interface ResultRow {
  id: string;
  status: EnrollmentStatus;
  result_note: string | null;
  student: { id: string; code: string; full_name: string } | null;
  attendance: number | null;
  tasks: number | null;
  eligible: boolean;
  certificate: { id: string; number: string | null; status: string } | null;
}

/**
 * Batch → Close: one row per active, completed or not completed enrolment, with its result and certificate.
 * `locked` (archived batch): results can no longer change.
 */
export function ResultsCard({
  rows,
  markHref,
  locked = false,
}: {
  rows: ResultRow[];
  markHref: (enrollmentId: string, outcome?: "completed" | "not_completed") => string;
  locked?: boolean;
}) {
  return (
    <Card>
      <CardHeader
        title="Results and certificates"
        info="Mark each student completed with a result, or not completed with a note. A certificate needs a completed enrolment over the attendance and task minimums; an owner can issue early or override with a reason from Documents."
      />
      {rows.length ? (
        <ul>
          {rows.map((r) => {
            const st = ENROLLMENT_STATUS[r.status];
            const s = r.student;
            const notDone = r.status === "not_completed";
            const issueHref = s
              ? `/admin/documents?new=1&type=certificate&student=${s.id}&enrollment=${r.id}`
              : "/admin/documents?new=1&type=certificate";
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-4 py-3 first:border-t-0">
                <div className="min-w-0 flex-[1_1_220px]">
                  <b className="block text-sm font-semibold break-words">
                    {s ? (
                      <Link href={`/admin/students/${encodeURIComponent(s.code)}`} className="text-fg no-underline hover:text-accent-ink">
                        {s.full_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </b>
                  <small className="block text-xs break-words text-fg-3">
                    {s?.code}
                    {`, attendance ${r.attendance === null ? "not marked" : `${r.attendance}%`}`}
                    {`, tasks ${r.tasks === null ? "none" : `${r.tasks}%`}`}
                    {r.result_note ? (notDone ? `, note: ${r.result_note}` : `, result: ${r.result_note}`) : ""}
                  </small>
                </div>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Pill tone={st.tone} dot>
                    {st.label}
                  </Pill>
                  {notDone ? null : r.eligible ? <Pill tone="ok">Eligible</Pill> : <Pill tone="warn">Below minimums</Pill>}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {locked ? null : r.status === "active" ? (
                    <>
                      <ButtonLink href={markHref(r.id)} scroll={false} size="sm" variant="secondary">
                        <CheckCheck aria-hidden />
                        Mark completed
                      </ButtonLink>
                      <ButtonLink href={markHref(r.id, "not_completed")} scroll={false} size="sm" variant="ghost">
                        <CircleSlash aria-hidden />
                        Not completed
                      </ButtonLink>
                    </>
                  ) : (
                    <ButtonLink href={markHref(r.id, notDone ? "not_completed" : "completed")} scroll={false} size="sm" variant="ghost">
                      <CheckCheck aria-hidden />
                      Edit result
                    </ButtonLink>
                  )}
                  {r.certificate ? (
                    <ButtonLink href={`/admin/documents?open=${r.certificate.id}`} size="sm" variant="ghost">
                      <Award aria-hidden />
                      {r.certificate.number ?? "Certificate draft"}
                    </ButtonLink>
                  ) : notDone || locked ? null : (
                    <ButtonLink href={issueHref} size="sm" variant={r.status === "completed" && r.eligible ? "secondary" : "ghost"}>
                      <Award aria-hidden />
                      Issue certificate
                    </ButtonLink>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-fg-3">No active or finished enrolments in this batch.</p>
      )}
    </Card>
  );
}
