"use client";

/**
 * The Log session / Session record form. Client-side only for the phone-first bits:
 * picking a plan item fills kind and title, the kind shows or hides Attendance and Results,
 * and "All present" / "Clear" flip the attendance tiles. Saving goes to src/server/actions/track.ts.
 */
import * as React from "react";
import { ActionForm, FieldError } from "@/components/toast";
import { Button, Field, FormGrid, Input, Notice, RadioSegment, Select, Textarea } from "@/components/ui";
import { ATTENDANCE_KINDS, PLAN_KIND, PLAN_KINDS, RESULT_KINDS, WORK_MARK_LABEL } from "@/lib/labels";
import type { PlanKind, WorkMark } from "@/lib/types";
import { logSession, updateSession } from "@/server/actions/track";
import type { ItemOption, SessionInitial, StudentLine } from "./data";

const KIND_OPTIONS = PLAN_KINDS.map((k) => ({ value: k, label: PLAN_KIND[k].label }));
const MARKS = Object.keys(WORK_MARK_LABEL) as WorkMark[];

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  const id = React.useId();
  return (
    <div role="group" aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={id} className="text-xs font-semibold text-fg-2">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function SessionForm({
  formId,
  batchId,
  entryId,
  closeHref,
  today,
  items,
  initial,
  students,
}: {
  formId: string;
  batchId: string;
  entryId?: string;
  closeHref: string;
  today: string;
  items: ItemOption[];
  initial: SessionInitial;
  students: StudentLine[];
}) {
  const [itemId, setItemId] = React.useState(initial.plan_item_id);
  const [kind, setKind] = React.useState<PlanKind>(initial.kind);
  const [title, setTitle] = React.useState(initial.title);
  const [present, setPresent] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(students.map((s) => [s.enrollment_id, s.present])),
  );

  const pickItem = (id: string) => {
    const prev = items.find((i) => i.id === itemId);
    const next = items.find((i) => i.id === id);
    setItemId(id);
    if (!next) return;
    setKind(next.kind);
    if (!title.trim() || title === prev?.title) setTitle(next.title);
  };

  const takesAttendance = ATTENDANCE_KINDS.includes(kind);
  const takesResults = RESULT_KINDS.includes(kind);
  const isTest = kind === "test";
  const presentCount = students.filter((s) => present[s.enrollment_id]).length;
  const setAll = (v: boolean) => setPresent(Object.fromEntries(students.map((s) => [s.enrollment_id, v])));

  return (
    <ActionForm action={entryId ? updateSession : logSession} closeHref={closeHref} id={formId} className="flex flex-col gap-5">
      <input type="hidden" name="batch_id" value={batchId} />
      {entryId ? <input type="hidden" name="id" value={entryId} /> : null}
      {students.map((s) => (
        <input key={s.enrollment_id} type="hidden" name="enr" value={s.enrollment_id} />
      ))}

      <Field label="Plan item" htmlFor="ls-item" hint={itemId ? "Logging this marks the plan item done." : undefined}>
        <Select id="ls-item" name="plan_item_id" value={itemId} onChange={(e) => pickItem(e.target.value)}>
          <option value="">Unplanned (not in the plan)</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
        </Select>
      </Field>

      <FormGrid>
        <Field label="Date held" htmlFor="ls-date" required>
          <Input id="ls-date" name="held_on" type="date" max={today} defaultValue={initial.held_on} aria-required />
          <FieldError name="held_on" />
        </Field>
        <RadioSegment name="kind" label="Kind" options={KIND_OPTIONS} value={kind} onChange={(k) => setKind(k as PlanKind)}>
          <FieldError name="kind" />
        </RadioSegment>
      </FormGrid>

      <Field label="Title" htmlFor="ls-title" required hint={itemId ? "Left empty, the plan item's title is used." : undefined}>
        <Input id="ls-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        <FieldError name="title" />
      </Field>

      <Field label="Recording or link" htmlFor="ls-link">
        <Input id="ls-link" name="link" inputMode="url" placeholder="youtube.com/…" defaultValue={initial.link} />
        <FieldError name="link" />
      </Field>

      {takesAttendance ? (
        <Section
          title={`Attendance (${presentCount} of ${students.length} present)`}
          aside={
            students.length ? (
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" className="max-md:h-11" onClick={() => setAll(true)}>
                  All present
                </Button>
                <Button type="button" variant="ghost" size="sm" className="max-md:h-11" onClick={() => setAll(false)}>
                  Clear
                </Button>
              </div>
            ) : null
          }
        >
          {students.length ? (
            <div className="grid grid-cols-2 gap-2">
              {students.map((s) => (
                <label
                  key={s.enrollment_id}
                  className="flex min-h-12 min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm font-medium transition-colors has-checked:border-accent has-checked:bg-accent-soft"
                >
                  <input
                    type="checkbox"
                    name="present"
                    value={s.enrollment_id}
                    checked={Boolean(present[s.enrollment_id])}
                    onChange={(e) => setPresent((p) => ({ ...p, [s.enrollment_id]: e.target.checked }))}
                    className="size-5 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="line-clamp-2 min-w-0 break-words">{s.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <Notice>No students in this batch yet. Assign students from their Student 360 page.</Notice>
          )}
          {students.length ? <p className="text-xs text-fg-3">Ticked means present. Untick anyone who was absent.</p> : null}
        </Section>
      ) : null}

      {/* Kept mounted (hidden) so marks survive switching kind; the server ignores them unless the kind is Task or Test. */}
      <div hidden={!takesResults}>
        <Section title="Results">
          {isTest ? (
            <Field label="Out of" htmlFor="ls-max" hint="One maximum score for everyone. Leave empty if there is no score.">
              <Input id="ls-max" name="max_score" inputMode="decimal" defaultValue={initial.max_score} className="md:w-32" />
              <FieldError name="max_score" />
            </Field>
          ) : null}
          {students.length ? (
            <ul className="rounded-lg border border-line">
              {students.map((s) => (
                <li key={s.enrollment_id} className="flex flex-col gap-2 border-b border-line px-3 py-2.5 last:border-b-0 md:flex-row md:items-center md:gap-3">
                  <span className="min-w-0 text-sm font-semibold break-words md:flex-1 md:truncate">{s.name}</span>
                  <div className={isTest ? "grid grid-cols-[minmax(0,1fr)_96px] gap-2 md:w-60" : "md:w-40"}>
                    <Select name={`mark_${s.enrollment_id}`} defaultValue={s.mark} aria-label={`Result for ${s.name}`}>
                      {MARKS.map((m) => (
                        <option key={m} value={m}>
                          {WORK_MARK_LABEL[m]}
                        </option>
                      ))}
                    </Select>
                    {isTest ? (
                      <Input name={`score_${s.enrollment_id}`} inputMode="decimal" placeholder="Score" defaultValue={s.score} aria-label={`Score for ${s.name}`} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Notice>No students in this batch yet.</Notice>
          )}
          <FieldError name="scores" />
        </Section>
      </div>

      <Field label="Note" htmlFor="ls-note">
        <Textarea id="ls-note" name="note" defaultValue={initial.note} placeholder="Anything to remember about this class" />
      </Field>
    </ActionForm>
  );
}
