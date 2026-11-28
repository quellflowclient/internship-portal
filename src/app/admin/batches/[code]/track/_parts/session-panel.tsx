/** Log session (?new=1[&item=…]) and Session record (?open=<entry id>) panels. Data is loaded here; the form is a client component. */
import { Trash2 } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { ActionButton, SubmitButton } from "@/components/toast";
import { ButtonLink, EmptyState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatDay, todayIST } from "@/lib/utils";
import type { AttendanceMark, WorkMark } from "@/lib/types";
import { deleteSession, restoreSession } from "@/server/actions/track";
import { itemLabel, type EntryFull, type ItemOption, type ItemStatus, type RosterEnrolment, type SessionInitial, type StudentLine } from "./data";
import { SessionForm } from "./session-form";

const OPEN = ["assigned", "active"];
const FORM_ID = "f-session";
const Spacer = () => <span className="flex-1 max-md:hidden" />;

export async function SessionPanel({
  batchId,
  entryId,
  itemId,
  statuses,
  closeHref,
}: {
  batchId: string;
  entryId?: string;
  itemId?: string;
  statuses: ItemStatus[];
  closeHref: string;
}) {
  const supabase = await createClient();
  const today = todayIST();

  const [enrolRes, entryRes, attRes, resRes] = await Promise.all([
    supabase.from("enrollments").select("id, status, student:students(full_name, code)").eq("batch_id", batchId),
    entryId
      ? supabase
          .from("track_entries")
          .select("id, batch_id, plan_item_id, held_on, kind, title, link, note, deleted_at, created_at, created_by")
          .eq("id", entryId)
          .eq("batch_id", batchId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    entryId ? supabase.from("attendance").select("enrollment_id, mark").eq("track_entry_id", entryId) : Promise.resolve({ data: [] }),
    entryId
      ? supabase.from("work_results").select("enrollment_id, mark, score, max_score").eq("track_entry_id", entryId)
      : Promise.resolve({ data: [] }),
  ]);
  const entry = entryRes.data as EntryFull | null;

  if (entryId && (!entry || entry.deleted_at)) {
    return (
      <Drawer closeHref={closeHref} title="Session record">
        <EmptyState
          title="This record is not available"
          action={
            <ButtonLink href={closeHref} scroll={false}>
              Back to the list
            </ButtonLink>
          }
        >
          It was deleted, or the link is wrong.
        </EmptyState>
      </Drawer>
    );
  }

  const creator =
    entry?.created_by != null
      ? ((await supabase.from("profiles").select("full_name, email").eq("id", entry.created_by).maybeSingle()).data as {
          full_name: string | null;
          email: string;
        } | null)
      : null;

  const att = new Map(((attRes.data ?? []) as { enrollment_id: string; mark: AttendanceMark }[]).map((a) => [a.enrollment_id, a.mark]));
  const res = new Map(
    ((resRes.data ?? []) as { enrollment_id: string; mark: WorkMark; score: number | null; max_score: number | null }[]).map((r) => [
      r.enrollment_id,
      r,
    ]),
  );

  // Every open enrolment, plus (when editing) anyone who already has a row on this record.
  const students: StudentLine[] = ((enrolRes.data ?? []) as unknown as RosterEnrolment[])
    .filter((e) => OPEN.includes(e.status) || att.has(e.id) || res.has(e.id))
    .map((e) => ({
      enrollment_id: e.id,
      name: e.student?.full_name ?? "Student",
      code: e.student?.code ?? "",
      present: (att.get(e.id) ?? "present") === "present",
      mark: res.get(e.id)?.mark ?? "done",
      score: res.get(e.id)?.score != null ? String(res.get(e.id)!.score) : "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Plan items still to do, plus the one linked or asked for.
  const keep = entry?.plan_item_id ?? itemId;
  const items: ItemOption[] = statuses
    .filter((s) => s.status === "planned" || s.status === "overdue" || s.id === keep)
    .map((s) => ({ id: s.id, label: itemLabel(s), kind: s.kind, title: s.title }));
  if (entry?.plan_item_id && !items.some((i) => i.id === entry.plan_item_id)) {
    items.unshift({ id: entry.plan_item_id, label: "A plan item that was removed", kind: entry.kind, title: entry.title });
  }
  const pre = keep ? statuses.find((s) => s.id === keep) : undefined;

  const maxScore = [...res.values()].find((r) => r.max_score != null)?.max_score;
  const initial: SessionInitial = entry
    ? {
        plan_item_id: entry.plan_item_id ?? "",
        held_on: entry.held_on,
        kind: entry.kind,
        title: entry.title,
        link: entry.link ?? "",
        note: entry.note ?? "",
        max_score: maxScore != null ? String(maxScore) : "",
      }
    : {
        plan_item_id: pre?.id ?? "",
        held_on: today,
        kind: pre?.kind ?? "session",
        title: pre?.title ?? "",
        link: "",
        note: "",
        max_score: "",
      };

  return (
    <Drawer
      closeHref={closeHref}
      title={entry ? "Session record" : "Log session"}
      sub={entry ? formatDay(entry.held_on) : "What actually happened. The plan text is not changed."}
      footer={
        <>
          {entry ? (
            <ActionButton action={deleteSession.bind(null, entry.id)} undo={restoreSession} variant="danger" closeHref={closeHref}>
              <Trash2 aria-hidden />
              Delete
            </ActionButton>
          ) : (
            <ButtonLink variant="ghost" href={closeHref} scroll={false}>
              Cancel
            </ButtonLink>
          )}
          <Spacer />
          <SubmitButton form={FORM_ID} pendingText={entry ? "Saving…" : "Logging…"}>
            {entry ? "Save" : "Log session"}
          </SubmitButton>
        </>
      }
    >
      <SessionForm
        formId={FORM_ID}
        batchId={batchId}
        entryId={entry?.id}
        closeHref={closeHref}
        today={today}
        items={items}
        initial={initial}
        students={students}
      />
      {entry ? (
        <p className="text-xs text-fg-3">
          Logged by {creator ? creator.full_name || creator.email : "someone no longer listed"} on {formatDateTime(entry.created_at)}
        </p>
      ) : null}
    </Drawer>
  );
}
