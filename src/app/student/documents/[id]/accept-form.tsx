"use client";

import { ActionForm, FieldError, SubmitButton } from "@/components/toast";
import { Checkbox, Input, Label } from "@/components/ui";
import { acceptDocument } from "@/server/actions/student-documents";
import { ACCEPT_CHECKBOX_TEXT } from "../_parts/shared";

export function AcceptForm({ id, placeholder }: { id: string; placeholder?: string }) {
  return (
    <ActionForm action={acceptDocument} className="flex flex-col gap-3.5 p-4">
      <input type="hidden" name="id" value={id} />
      <div>
        <Checkbox name="agree" value="1" label={ACCEPT_CHECKBOX_TEXT} />
        <FieldError name="agree" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="acc-name">Type your full name to sign</Label>
        <Input id="acc-name" name="typed_name" autoComplete="name" maxLength={200} placeholder={placeholder} />
        <FieldError name="typed_name" />
      </div>
      <SubmitButton pendingText="Signing…" className="w-full md:w-fit">
        Accept and sign
      </SubmitButton>
      <small className="text-xs text-fg-3">We record your typed name, the date and time, your IP address and a fingerprint of this exact version.</small>
    </ActionForm>
  );
}
