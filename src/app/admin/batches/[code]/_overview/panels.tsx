/** Batch → Overview panels (?panel=links|edit|cancel). Forms post to src/server/actions/batches.ts. */
import { Info, TriangleAlert } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { ActionForm, SubmitButton } from "@/components/toast";
import { ButtonLink, FormGrid, Notice } from "@/components/ui";
import { cancelBatch, restoreBatch, updateBatch, updateBatchLinks } from "@/server/actions/batches";
import { DaysField, Hidden, SelectField, Spacer, TextField } from "../../_parts/fields";
import type { BatchRow } from "../../_parts/shared";
import { LINK_FIELDS } from "./cards";

function Cancel({ href, children = "Cancel" }: { href: string; children?: string }) {
  return (
    <ButtonLink variant="ghost" href={href} scroll={false}>
      {children}
    </ButtonLink>
  );
}

/* ---------- Tools and links ---------- */
const PLACEHOLDER: Record<string, string> = {
  whatsapp_url: "chat.whatsapp.com/…",
  classroom_url: "classroom.google.com/c/…",
  meet_url: "meet.google.com/…",
  playlist_url: "youtube.com/playlist?list=…",
  drive_url: "drive.google.com/drive/folders/…",
  github_url: "github.com/quellflow/…",
};

export function LinksPanel({ b, closeHref }: { b: BatchRow; closeHref: string }) {
  return (
    <Drawer
      closeHref={closeHref}
      title="Tools and links"
      sub={b.code}
      footer={
        <>
          <Cancel href={closeHref} />
          <Spacer />
          <SubmitButton form="f-batch-links">Save links</SubmitButton>
        </>
      }
    >
      <ActionForm action={updateBatchLinks} closeHref={closeHref} id="f-batch-links" className="flex flex-col gap-3.5">
        <Hidden values={{ id: b.id }} />
        {LINK_FIELDS.map(({ key, label }) => (
          <TextField
            key={key}
            idPrefix="bl"
            name={key}
            label={label}
            type="url"
            inputMode="url"
            placeholder={PLACEHOLDER[key]}
            defaultValue={(b[key] as string | null) ?? ""}
            autoComplete="off"
          />
        ))}
      </ActionForm>
      <Notice icon={<Info aria-hidden />}>Leave a field empty to hide its icon. Students of this batch see the same links.</Notice>
    </Drawer>
  );
}

/* ---------- Details ---------- */
export function EditPanel({
  b,
  seatsTaken,
  admins,
  closeHref,
}: {
  b: BatchRow;
  seatsTaken: number;
  admins: { id: string; name: string }[];
  closeHref: string;
}) {
  const running = b.status === "running";
  return (
    <Drawer
      closeHref={closeHref}
      title="Edit batch"
      sub={b.code}
      footer={
        <>
          <Cancel href={closeHref} />
          <Spacer />
          <SubmitButton form="f-batch-edit">Save</SubmitButton>
        </>
      }
    >
      {running ? (
        <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
          This batch is running. Its dates can be changed only by an owner.
        </Notice>
      ) : null}
      <ActionForm action={updateBatch} closeHref={closeHref} id="f-batch-edit">
        <Hidden values={{ id: b.id }} />
        <FormGrid>
          <TextField
            idPrefix="be"
            name="start_date"
            label="Start date"
            type="date"
            required
            defaultValue={b.start_date}
            hint="Locked once the batch is running, unless you are an owner."
          />
          <TextField
            idPrefix="be"
            name="end_date"
            label="End date"
            type="date"
            required
            defaultValue={b.end_date}
            hint="Plan item dates do not move. Adjust them in the Plan tab."
          />
          <DaysField defaultDays={b.schedule_days ?? []} className="md:col-span-2" />
          <TextField idPrefix="be" name="session_time" label="Session time" placeholder="6–7 pm IST" defaultValue={b.session_time ?? ""} />
          <TextField
            idPrefix="be"
            name="capacity"
            label="Seats"
            required
            inputMode="numeric"
            defaultValue={String(b.capacity)}
            hint={seatsTaken ? `At least ${seatsTaken}, the students already in this batch.` : undefined}
          />
          <SelectField idPrefix="be" name="coordinator_id" label="Coordinator" defaultValue={b.coordinator_id ?? ""} className="md:col-span-2">
            <option value="">Not set</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectField>
        </FormGrid>
      </ActionForm>
    </Drawer>
  );
}

/* ---------- Cancel batch ---------- */
export function CancelPanel({ b, closeHref }: { b: BatchRow; closeHref: string }) {
  return (
    <Drawer
      closeHref={closeHref}
      title="Cancel batch"
      sub={b.code}
      footer={
        <>
          <Cancel href={closeHref}>Keep batch</Cancel>
          <Spacer />
          <SubmitButton form="f-batch-cancel" variant="danger" pendingText="Cancelling…">
            Cancel batch
          </SubmitButton>
        </>
      }
    >
      <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
        The batch moves to Closed as Cancelled. Its plan is kept, and nothing is deleted. You can undo for 5 seconds.
      </Notice>
      <p className="text-sm text-fg-2">Only a planned batch with no students can be cancelled. Students are assigned and removed in Student 360.</p>
      <ActionForm action={cancelBatch} undo={restoreBatch} closeHref={closeHref} id="f-batch-cancel">
        <Hidden values={{ id: b.id }} />
      </ActionForm>
    </Drawer>
  );
}
