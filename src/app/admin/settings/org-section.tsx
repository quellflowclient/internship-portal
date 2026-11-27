import { AlertTriangle } from "lucide-react";
import { Card, CardHeader, Field, FormGrid, Input, Notice, Textarea } from "@/components/ui";
import { ActionForm, FieldError, SubmitButton } from "@/components/toast";
import { createClient } from "@/lib/supabase/server";
import type { OrgSettings } from "@/lib/types";
import { updateOrg } from "@/server/actions/settings";

type Org = Pick<OrgSettings, "org_name" | "website" | "contact_email" | "support_whatsapp" | "verify_base_url" | "address">;

export async function OrgSection({ canEdit }: { canEdit: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("org_settings")
    .select("org_name, website, contact_email, support_whatsapp, verify_base_url, address")
    .eq("id", 1)
    .maybeSingle();
  const org = data as Org | null;

  if (!org) {
    return (
      <Card>
        <CardHeader title="Organisation" />
        <div className="p-4">
          <Notice tone="error">The settings row is missing. Run the seed once on this database.</Notice>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Organisation" info="Printed on letters, certificates and the public verify page." />
      <ActionForm action={updateOrg} className="p-4">
        <FormGrid>
          <Field label="Legal name" htmlFor="org_name" required>
            <Input id="org_name" name="org_name" defaultValue={org.org_name} disabled={!canEdit} autoComplete="organization" />
            <FieldError name="org_name" />
          </Field>
          <Field label="Website" htmlFor="website">
            <Input id="website" name="website" defaultValue={org.website ?? ""} disabled={!canEdit} inputMode="url" placeholder="quellflow.com" />
            <FieldError name="website" />
          </Field>
          <Field label="Support email" htmlFor="contact_email">
            <Input id="contact_email" name="contact_email" type="email" defaultValue={org.contact_email ?? ""} disabled={!canEdit} />
            <FieldError name="contact_email" />
          </Field>
          <Field label="Support WhatsApp" htmlFor="support_whatsapp">
            <Input
              id="support_whatsapp"
              name="support_whatsapp"
              type="tel"
              inputMode="tel"
              defaultValue={org.support_whatsapp ?? ""}
              disabled={!canEdit}
              placeholder="98765 43210"
            />
            <FieldError name="support_whatsapp" />
          </Field>
          <Field
            label="Verify page address"
            htmlFor="verify_base_url"
            className="md:col-span-2"
            hint={
              <span className="inline-flex items-start gap-1.5 text-warn">
                <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                Printed inside every QR code. Fix it before the first certificate.
              </span>
            }
          >
            <Input
              id="verify_base_url"
              name="verify_base_url"
              defaultValue={org.verify_base_url ?? ""}
              disabled={!canEdit}
              inputMode="url"
              placeholder="https://learn.quellflow.com"
            />
            <FieldError name="verify_base_url" />
          </Field>
          <Field label="Address" htmlFor="address" className="md:col-span-2">
            <Textarea id="address" name="address" rows={3} defaultValue={org.address ?? ""} disabled={!canEdit} />
            <FieldError name="address" />
          </Field>
        </FormGrid>
        {canEdit ? (
          <div className="mt-4">
            <SubmitButton>Save</SubmitButton>
          </div>
        ) : null}
      </ActionForm>
    </Card>
  );
}
