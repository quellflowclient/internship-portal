"use client";

import { ActionForm } from "@/components/toast";
import { Checkbox } from "@/components/ui";
import { updateShareSettings } from "@/server/actions/plan";

/** A checkbox that saves itself (share link on/off, show done marks). */
export function ShareToggle({
  planId,
  field,
  checked,
  label,
}: {
  planId: string;
  field: "share_enabled" | "show_done_marks";
  checked: boolean;
  label: string;
}) {
  return (
    <ActionForm key={String(checked)} action={updateShareSettings}>
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="field" value={field} />
      <Checkbox name="value" defaultChecked={checked} label={label} onChange={(e) => e.currentTarget.form?.requestSubmit()} />
    </ActionForm>
  );
}
