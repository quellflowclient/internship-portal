"use client";

/** "I saved the screenshot" – a checkbox that saves on tick / untick. */
import { ActionForm } from "@/components/toast";
import { Checkbox } from "@/components/ui";
import { markProofSaved } from "@/server/actions/payments";

export function ProofToggle({ id, saved }: { id: string; saved: boolean }) {
  return (
    <ActionForm action={markProofSaved} key={String(saved)}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="saved" value={saved ? "0" : "1"} />
      <Checkbox
        defaultChecked={saved}
        label="I saved the screenshot in the student’s folder"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      />
    </ActionForm>
  );
}
