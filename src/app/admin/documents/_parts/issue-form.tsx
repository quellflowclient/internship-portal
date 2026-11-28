"use client";

/** Issue form (client: the fields follow the chosen type, student and enrolment). Posted to issueFromForm. */
import * as React from "react";
import { Lock, PenLine, TriangleAlert } from "lucide-react";
import { ActionForm, FieldError } from "@/components/toast";
import { DL, Field, Input, Notice, Pill, Select, Textarea } from "@/components/ui";
import { DOC_TYPE_LABEL, ENROLLMENT_STATUS, STANDALONE_DOC_TYPES } from "@/lib/labels";
import type { DocType, EnrollmentStatus } from "@/lib/types";
import { issueFromForm } from "@/server/actions/documents";
import {
  allowsEnrolment,
  BODY_TYPES,
  DOC_GROUPS,
  needsEnrolment,
  PROJECT_OPTIONAL,
  PROJECT_REQUIRED,
} from "@/server/documents/rules";
import type { IssueInitial, SignatoryChoice, StudentChoice, TemplateChoice } from "./shared";

/** Which enrolments make sense for a type. */
function enrolmentFits(type: DocType, e: StudentChoice["enrolments"][number]) {
  if (type === "certificate") return ["active", "completed", "not_completed"].includes(e.status);
  if (type === "experience") return e.type !== "paid" && ["active", "completed", "not_completed"].includes(e.status);
  return !["withdrawn", "dropped"].includes(e.status);
}

export function IssueForm({
  formId,
  initial,
  students,
  templates,
  signatories,
  isOwner,
  myName,
  hasOwnSignature,
  closeHref,
}: {
  formId: string;
  initial: IssueInitial;
  students: StudentChoice[];
  templates: TemplateChoice[];
  signatories: SignatoryChoice[];
  isOwner: boolean;
  myName: string;
  hasOwnSignature: boolean;
  closeHref: string;
}) {
  const [type, setType] = React.useState<DocType>(initial.type as DocType);
  const [studentId, setStudentId] = React.useState(initial.studentId);
  const [enrollmentId, setEnrollmentId] = React.useState(initial.enrollmentId);
  const [filter, setFilter] = React.useState("");

  const student = students.find((s) => s.id === studentId);
  const enrolOptions = (student?.enrolments ?? []).filter((e) => enrolmentFits(type, e));
  const enrolValue = enrolOptions.some((e) => e.id === enrollmentId)
    ? enrollmentId
    : needsEnrolment(type)
      ? (enrolOptions.find((e) => ["active", "completed"].includes(e.status))?.id ?? enrolOptions[0]?.id ?? "")
      : "";
  const enrol = enrolOptions.find((e) => e.id === enrolValue);
  const projects = (student?.projects ?? []).filter((p) => (PROJECT_REQUIRED.includes(type) ? p.kind === "college" : true));
  const standalone = STANDALONE_DOC_TYPES.includes(type);
  const template = templates.find((t) => t.type === type);
  const certOverride = type === "certificate" && !!enrol && !(enrol.status === "completed" && enrol.eligible);

  const f = filter.trim().toLowerCase();
  const shown = f ? students.filter((s) => s.id === studentId || s.label.toLowerCase().includes(f)) : students;

  return (
    <ActionForm action={issueFromForm} closeHref={closeHref} id={formId} className="flex flex-col gap-4">
      {initial.draftId ? <input type="hidden" name="draft_id" value={initial.draftId} /> : null}

      <Field label="Document" htmlFor="df-type" required>
        <Select id="df-type" name="type" value={type} onChange={(e) => setType(e.target.value as DocType)} disabled={!!initial.draftId}>
          {DOC_GROUPS.map((g) => (
            <optgroup key={g.key} label={g.label}>
              {g.types.map((t) => (
                <option key={t} value={t}>
                  {DOC_TYPE_LABEL[t]}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        {initial.draftId ? <input type="hidden" name="type" value={type} /> : null}
        <FieldError name="type" />
      </Field>

      <Field label="Student" htmlFor="df-student" required hint={initial.draftId ? undefined : "Type part of the name or code to shorten the list."}>
        {initial.draftId ? null : (
          <Input
            type="search"
            aria-label="Filter students"
            placeholder="Filter by name or code"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoComplete="off"
          />
        )}
        <Select
          id="df-student"
          name="student_id"
          value={studentId}
          onChange={(e) => {
            setStudentId(e.target.value);
            setEnrollmentId("");
          }}
          disabled={!!initial.draftId}
        >
          <option value="">Choose a student</option>
          {shown.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        {initial.draftId ? <input type="hidden" name="student_id" value={studentId} /> : null}
        <FieldError name="student_id" />
      </Field>

      {allowsEnrolment(type) ? (
        <Field
          label="Enrolment"
          htmlFor="df-enrol"
          required={needsEnrolment(type)}
          hint={type === "experience" ? "Internships only (free or stipend). Paid training never gets an experience letter." : undefined}
        >
          <Select id="df-enrol" name="enrollment_id" value={enrolValue} onChange={(e) => setEnrollmentId(e.target.value)} disabled={!student}>
            {needsEnrolment(type) && enrolOptions.length ? null : <option value="">{needsEnrolment(type) ? "No enrolment fits" : "None"}</option>}
            {enrolOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </Select>
          <FieldError name="enrollment_id" />
        </Field>
      ) : null}

      {type === "certificate" && enrol ? (
        <div className="flex flex-col gap-2 rounded-[10px] border border-line bg-surface-2 p-3">
          <span className="text-xs font-semibold text-fg-2">Eligibility</span>
          <DL
            items={[
              ["Enrolment", ENROLLMENT_STATUS[enrol.status as EnrollmentStatus]?.label ?? enrol.status],
              ["Attendance", enrol.attendance === null ? "Not marked yet" : `${enrol.attendance}%`],
              ["Tasks", enrol.tasks === null ? "None given" : `${enrol.tasks}%`],
              [
                "Certificate",
                enrol.status === "completed" && enrol.eligible ? (
                  <Pill key="e" tone="ok" dot>
                    Eligible
                  </Pill>
                ) : (
                  <Pill key="e" tone="warn" dot>
                    {enrol.status !== "completed" ? "Not completed yet" : "Below the minimums"}
                  </Pill>
                ),
              ],
            ]}
          />
        </div>
      ) : null}

      {certOverride ? (
        isOwner ? (
          <Field
            label="Issue early or override: reason"
            htmlFor="df-note"
            required
            hint="Kept with the document and in the log. An early certificate prints the day it was completed, not the batch end date."
          >
            <Textarea id="df-note" name="issue_note" defaultValue={initial.issueNote} maxLength={300} placeholder="e.g. Leaving early for exams, all work done" />
            <FieldError name="issue_note" />
          </Field>
        ) : (
          <Notice tone="warn" icon={<Lock aria-hidden />}>
            Only an owner can issue a certificate before the enrolment is completed or below the minimums. Mark it completed in Batch, Close, or ask an owner.
          </Notice>
        )
      ) : null}

      {PROJECT_REQUIRED.includes(type) || PROJECT_OPTIONAL.includes(type) ? (
        <Field label={PROJECT_REQUIRED.includes(type) ? "College project" : "Project (optional)"} htmlFor="df-project" required={PROJECT_REQUIRED.includes(type)}>
          <Select id="df-project" name="project_id" defaultValue={initial.projectId} key={`${studentId}-${type}`} disabled={!student}>
            <option value="">{projects.length ? (PROJECT_REQUIRED.includes(type) ? "Choose a project" : "None") : "No project for this student"}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <FieldError name="project_id" />
        </Field>
      ) : null}

      {standalone ? (
        isOwner ? (
          <>
            <Field label={type === "custom_certificate" ? "Title" : "Event or title"} htmlFor="df-event" required>
              <Input id="df-event" name="event_title" defaultValue={initial.eventTitle} maxLength={200} placeholder="e.g. Hands-on workshop on AI agents" />
              <FieldError name="event_title" />
            </Field>
            <Field label="Dates" htmlFor="df-dates" hint="Printed as typed, e.g. on 12 December 2026, or from 2 to 4 January 2027.">
              <Input id="df-dates" name="event_dates" defaultValue={initial.eventDates} maxLength={200} />
              <FieldError name="event_dates" />
            </Field>
            <Field label="Reason" htmlFor="df-reason" required hint="Why this person gets a document without an internship. Kept in the log.">
              <Textarea id="df-reason" name="issue_note" defaultValue={initial.issueNote} maxLength={300} />
              <FieldError name="issue_note" />
            </Field>
          </>
        ) : (
          <Notice tone="warn" icon={<Lock aria-hidden />}>
            Documents without an internship are issued by an owner, with a reason.
          </Notice>
        )
      ) : null}

      {BODY_TYPES.includes(type) ? (
        <Field label="Text" htmlFor="df-body" required hint="Printed where the template has {body}.">
          <Textarea id="df-body" name="body" defaultValue={initial.body} maxLength={5000} rows={7} className="min-h-40" />
          <FieldError name="body" />
        </Field>
      ) : null}

      <div className="flex flex-col gap-2 rounded-[10px] border border-line px-3 py-2.5 text-sm">
        <DL
          items={[
            [
              "Template",
              template ? (
                `${template.title}, version ${template.version}${template.background_path ? "" : ", demo layout"}`
              ) : (
                <span key="t" className="text-bad">
                  No active template. An owner can add one in Settings, Templates.
                </span>
              ),
            ],
            ["Number", "Given when issued"],
          ]}
        />
      </div>

      {isOwner && signatories.length ? (
        <Field label="Signed by" htmlFor="df-sig" hint="The admin who issues a document signs it. Owners can sign as another active signatory.">
          <Select id="df-sig" name="signatory_id" defaultValue={initial.signatoryId}>
            {hasOwnSignature ? null : <option value="">Choose a signatory</option>}
            {signatories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
          <FieldError name="signatory_id" />
        </Field>
      ) : hasOwnSignature ? (
        <p className="flex items-center gap-2 text-sm text-fg-2">
          <PenLine className="size-4" aria-hidden />
          Signed by {myName}
        </p>
      ) : (
        <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
          No signature is linked to your account, so you cannot issue yet. An owner can add it in Settings, Signatories.
        </Notice>
      )}
    </ActionForm>
  );
}
