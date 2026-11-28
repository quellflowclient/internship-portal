"use client";

/** Document panel: "I saved the PDF" checkbox and "Shared via" select, both save on change. */
import { ActionForm } from "@/components/toast";
import { Checkbox, Label, Select } from "@/components/ui";
import { markPdfSaved, markShared } from "@/server/actions/documents";
import { SHARED_VIA } from "./shared";

export function PdfSavedToggle({ id, saved }: { id: string; saved: boolean }) {
  return (
    <ActionForm action={markPdfSaved} key={String(saved)}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="saved" value={saved ? "0" : "1"} />
      <Checkbox
        defaultChecked={saved}
        label="I saved the PDF in the student’s folder"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      />
    </ActionForm>
  );
}

export function SharedViaSelect({ id, via }: { id: string; via: string | null }) {
  return (
    <ActionForm action={markShared} key={via ?? ""} className="flex flex-col gap-1.5">
      <input type="hidden" name="id" value={id} />
      <Label htmlFor="doc-shared">Shared via</Label>
      <Select id="doc-shared" name="via" defaultValue={via ?? ""} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {SHARED_VIA.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </ActionForm>
  );
}
