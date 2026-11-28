import { TriangleAlert } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { ActionForm, SubmitButton } from "@/components/toast";
import { ButtonLink, Notice } from "@/components/ui";
import { archiveBatch, reopenBatch } from "@/server/actions/batch-close";

/** Batch → Close → ?archive=1: confirm before close_batch(). Undo (reopen_batch) works for 2 minutes. */
export function ArchivePanel({
  batchId,
  code,
  finished,
  issued,
  closeHref,
}: {
  batchId: string;
  code: string;
  finished: number;
  issued: number;
  closeHref: string;
}) {
  const formId = "f-archive-batch";
  return (
    <Drawer
      closeHref={closeHref}
      title="Archive batch"
      sub={code}
      footer={
        <>
          <ButtonLink href={closeHref} scroll={false} variant="ghost">
            Keep open
          </ButtonLink>
          <span className="flex-1 max-md:hidden" />
          <SubmitButton form={formId} pendingText="Archiving…">
            Archive batch
          </SubmitButton>
        </>
      }
    >
      <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
        The batch moves to Completed and its results can no longer change. Students with no other open enrolment move to alumni.
        Documents stay verifiable. You can undo for 2 minutes.
      </Notice>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-fg-2">
        <li>{finished === 1 ? "1 student has a result." : `${finished} students have a result.`}</li>
        <li>
          {issued === 1 ? "1 document is issued." : `${issued} documents are issued.`} Export the ZIP first if you have not saved them.
        </li>
      </ul>
      <ActionForm action={archiveBatch} undo={reopenBatch} closeHref={closeHref} id={formId}>
        <input type="hidden" name="id" value={batchId} />
      </ActionForm>
    </Drawer>
  );
}
