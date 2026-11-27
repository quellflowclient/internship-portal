import { createClient } from "@/lib/supabase/server";
import { Drawer } from "@/components/drawer";
import { ActionForm, FieldError, SubmitButton } from "@/components/toast";
import { ButtonLink, Field, FormGrid, Input, Select } from "@/components/ui";
import { SOURCE_LABEL } from "@/lib/labels";
import { createLead } from "@/server/actions/leads";
import type { LeadSource } from "@/lib/types";

const MANUAL_SOURCES: LeadSource[] = ["walk_in", "whatsapp", "referral", "other"];

/** Add lead: walk-ins, calls and referrals. Form leads arrive through /api/leads/import. */
export async function NewLeadPanel({ closeHref }: { closeHref: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("name").eq("active", true).order("name");
  const tracks = ((data ?? []) as { name: string }[]).map((c) => c.name);

  return (
    <Drawer
      closeHref={closeHref}
      title="Add lead"
      sub="For walk-ins, calls and referrals. Form leads arrive by themselves."
      footer={
        <>
          <ButtonLink href={closeHref} scroll={false} variant="ghost">
            Cancel
          </ButtonLink>
          <span className="flex-1 max-md:hidden" />
          <SubmitButton form="lead-new" pendingText="Adding…">
            Add lead
          </SubmitButton>
        </>
      }
    >
      <ActionForm action={createLead} id="lead-new">
        <FormGrid>
          <Field label="Full name" htmlFor="nl-name" required className="md:col-span-2">
            <Input id="nl-name" name="full_name" autoComplete="off" maxLength={120} required />
            <FieldError name="full_name" />
          </Field>
          <Field label="Mobile" htmlFor="nl-phone" required>
            <Input id="nl-phone" name="phone" type="tel" inputMode="tel" autoComplete="off" placeholder="98765 43210" required />
            <FieldError name="phone" />
          </Field>
          <Field label="Source" htmlFor="nl-source">
            <Select id="nl-source" name="source" defaultValue="walk_in">
              {MANUAL_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </Select>
            <FieldError name="source" />
          </Field>
          <Field label="Email" htmlFor="nl-email" className="md:col-span-2">
            <Input id="nl-email" name="email" type="email" inputMode="email" autoComplete="off" />
            <FieldError name="email" />
          </Field>
          <Field label="College" htmlFor="nl-college" className="md:col-span-2">
            <Input id="nl-college" name="college" autoComplete="off" maxLength={200} />
            <FieldError name="college" />
          </Field>
          <Field label="Interested in" htmlFor="nl-track" className="md:col-span-2">
            <Select id="nl-track" name="interested_track" defaultValue="">
              <option value="">Not sure yet</option>
              {tracks.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <FieldError name="interested_track" />
          </Field>
        </FormGrid>
      </ActionForm>
    </Drawer>
  );
}
