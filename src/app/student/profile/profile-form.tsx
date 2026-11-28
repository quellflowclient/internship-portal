"use client";

import { ActionForm, FieldError, SubmitButton } from "@/components/toast";
import { Field, FormGrid, Input } from "@/components/ui";
import { updateMyProfile } from "@/server/actions/student-profile";
import { formatPhone } from "@/lib/phone";

export type MyContact = { phone: string; city: string | null; github_url: string | null; linkedin_url: string | null };

/** The only fields a student can change (guard_students): mobile, city, GitHub, LinkedIn. */
export function ProfileForm({ me }: { me: MyContact }) {
  return (
    <ActionForm action={updateMyProfile} className="flex flex-col gap-4 p-4">
      <FormGrid>
        <Field label="Mobile" htmlFor="p-phone" required>
          <Input id="p-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={formatPhone(me.phone)} required />
          <FieldError name="phone" />
        </Field>
        <Field label="City" htmlFor="p-city">
          <Input id="p-city" name="city" autoComplete="address-level2" defaultValue={me.city ?? ""} />
          <FieldError name="city" />
        </Field>
        <Field label="GitHub" htmlFor="p-gh">
          <Input id="p-gh" name="github_url" inputMode="url" placeholder="github.com/your-name" defaultValue={me.github_url ?? ""} />
          <FieldError name="github_url" />
        </Field>
        <Field label="LinkedIn" htmlFor="p-li">
          <Input id="p-li" name="linkedin_url" inputMode="url" placeholder="linkedin.com/in/your-name" defaultValue={me.linkedin_url ?? ""} />
          <FieldError name="linkedin_url" />
        </Field>
      </FormGrid>
      <div>
        <SubmitButton>Save</SubmitButton>
      </div>
    </ActionForm>
  );
}
