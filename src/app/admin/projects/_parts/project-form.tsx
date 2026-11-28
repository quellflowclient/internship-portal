"use client";

/** New / Edit project form. The kind is picked first (new only); the fields change with it. */
import * as React from "react";
import { Info, ShieldAlert } from "lucide-react";
import { ActionForm, FieldError } from "@/components/toast";
import { Field, FormGrid, InfoTip, Input, Notice, RadioSegment, Select, Textarea } from "@/components/ui";
import type { ActionResult } from "@/server/result";
import { KIND, KINDS, REPORT_STATUS, REPORT_STATUSES, VISIBILITY, type Choice, type ProjectInitial, type ProjectKind } from "./shared";

function Text({
  name,
  label,
  required,
  hint,
  className,
  ...input
}: { name: keyof ProjectInitial; label: string; required?: boolean; hint?: React.ReactNode; className?: string } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "name"
>) {
  const id = `pf-${name}`;
  return (
    <Field label={label} htmlFor={id} hint={hint} required={required} className={className}>
      <Input id={id} name={name} aria-required={required || undefined} {...input} />
      <FieldError name={name} />
    </Field>
  );
}

function Pick({
  name,
  label,
  hint,
  className,
  children,
  ...select
}: { name: keyof ProjectInitial; label: string; hint?: React.ReactNode; className?: string } & Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "name"
>) {
  const id = `pf-${name}`;
  return (
    <Field label={label} htmlFor={id} hint={hint} className={className}>
      <Select id={id} name={name} {...select}>
        {children}
      </Select>
      <FieldError name={name} />
    </Field>
  );
}

export function ProjectForm({
  formId,
  closeHref,
  action,
  initial,
  isNew,
  batches,
  admins,
}: {
  formId: string;
  closeHref?: string;
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  initial: ProjectInitial;
  isNew: boolean;
  batches: Choice[];
  admins: Choice[];
}) {
  const [kind, setKind] = React.useState<ProjectKind>(initial.kind);
  const i = initial;

  return (
    <ActionForm action={action} id={formId} closeHref={closeHref}>
      {i.id ? <input type="hidden" name="id" value={i.id} /> : null}
      {isNew ? null : <input type="hidden" name="kind" value={kind} />}
      <FormGrid>
        {isNew ? (
          <div className="md:col-span-2">
            <RadioSegment
              name="kind"
              label="Kind"
              value={kind}
              onChange={(v) => setKind(v as ProjectKind)}
              options={KINDS.map((k) => ({ value: k, label: KIND[k].label }))}
            >
              <FieldError name="kind" />
            </RadioSegment>
          </div>
        ) : null}

        {kind === "client" ? (
          <div className="md:col-span-2">
            <Notice tone="warn" icon={<ShieldAlert aria-hidden />}>
              Client project: members need an accepted NDA consent, the repo stays private, and client details are for admins only.
            </Notice>
          </div>
        ) : null}

        <Text name="name" label="Project name" required defaultValue={i.name} autoComplete="off" className="md:col-span-2" maxLength={160} />

        {kind === "client" ? (
          <>
            <Text name="client_name" label="Client name" required defaultValue={i.client_name} autoComplete="off" />
            <Text name="client_contact" label="Client contact" hint="Name, phone or email. Admins only." defaultValue={i.client_contact} autoComplete="off" />
          </>
        ) : null}

        {kind === "college" ? (
          <>
            <Text name="college_name" label="College" defaultValue={i.college_name} autoComplete="off" />
            <Text name="guide_name" label="Guide" defaultValue={i.guide_name} autoComplete="off" />
            <Text name="submission_due" label="Submission due" type="date" defaultValue={i.submission_due} />
            <Pick name="report_status" label="Report" defaultValue={i.report_status || "not_started"}>
              {REPORT_STATUSES.map((r) => (
                <option key={r} value={r}>
                  {REPORT_STATUS[r].label}
                </option>
              ))}
            </Pick>
          </>
        ) : null}

        <Pick name="batch_id" label="Batch" defaultValue={i.batch_id} hint="Optional. The batch Projects tab lists it.">
          <option value="">No batch</option>
          {batches.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </Pick>
        <Pick name="lead_admin_id" label="Lead admin" defaultValue={i.lead_admin_id}>
          <option value="">Not set</option>
          {admins.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </Pick>

        {isNew ? (
          <div className="md:col-span-2">
            <RadioSegment
              name="status"
              label="Starts as"
              defaultValue={i.status === "active" ? "active" : "planned"}
              options={[
                { value: "planned", label: "Planned" },
                { value: "active", label: "Active" },
              ]}
            />
          </div>
        ) : null}

        <Text name="start_date" label="Start date" type="date" defaultValue={i.start_date} />
        <Text name="due_date" label="Due date" type="date" defaultValue={i.due_date} />

        <div className="flex items-center gap-1.5 md:col-span-2">
          <span className="text-xs font-semibold text-fg-2">Links</span>
          <InfoTip text="GitHub, demo and docs links. Paste them with or without https://." />
        </div>
        <Text name="github_url" label="GitHub" placeholder="github.com/…" defaultValue={i.github_url} autoComplete="off" inputMode="url" />
        <Pick
          name="github_visibility"
          label="Repo visibility"
          defaultValue={i.github_visibility}
          hint={kind === "college" ? "A college repo may be public." : "Private by default."}
        >
          {VISIBILITY.filter((o) => kind !== "client" || o.value !== "public").map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Pick>
        <Text name="demo_url" label="Demo" placeholder="https://…" defaultValue={i.demo_url} autoComplete="off" inputMode="url" />
        <Text name="docs_url" label="Docs" placeholder="https://…" defaultValue={i.docs_url} autoComplete="off" inputMode="url" />

        <Field label="Description" htmlFor="pf-description" className="md:col-span-2">
          <Textarea id="pf-description" name="description" defaultValue={i.description} maxLength={2000} rows={3} />
          <FieldError name="description" />
        </Field>
      </FormGrid>
      {isNew ? (
        <div className="mt-3.5">
          <Notice icon={<Info aria-hidden />}>The project code is given when you create it. Add members and tasks next.</Notice>
        </div>
      ) : null}
    </ActionForm>
  );
}
