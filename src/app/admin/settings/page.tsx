import { Flash } from "@/components/flash";
import { Button, Card, Field, Input, Notice, PageHeader, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { DOCUMENT_TYPE_LABEL } from "@/lib/labels";
import { addSignatory, toggleSignatory, updateNumberingScheme, updateOrgSettings } from "@/server/actions/admin";
import type { NumberingScheme, OrgSettings } from "@/lib/types";

export const metadata = { title: "Settings" };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const flash = await searchParams;
  const { profile } = await requireRole(["admin", "super_admin"]);
  const canEdit = profile.role === "super_admin";
  const supabase = await createClient();

  const [{ data: org }, { data: schemes }, { data: signatories }, { data: ay }] = await Promise.all([
    supabase.from("org_settings").select("*").eq("id", 1).maybeSingle<OrgSettings>(),
    supabase.from("numbering_schemes").select("id, doc_type, pattern, reset_per_academic_year, is_active").eq("is_active", true).order("doc_type").returns<NumberingScheme[]>(),
    supabase.from("signatories").select("id, name, title, is_active, signature_path").order("sort"),
    supabase.rpc("academic_year_label"),
  ]);

  const previews = await Promise.all(
    (schemes ?? []).map(async (s) => {
      const { data } = await supabase.rpc("preview_document_number", { p_doc_type: s.doc_type, p_role_code: s.pattern.includes("{ROLE}") ? "AA" : null });
      return [s.id, data as string | null] as const;
    }),
  );
  const preview = Object.fromEntries(previews);
  const disabled = !canEdit;

  return (
    <>
      <PageHeader title="Settings" description="Everything here is editable – nothing about branding or numbering is hard-coded." />
      <Flash {...flash} />
      {!canEdit ? (
        <div className="mb-4">
          <Notice>Read-only: only a super admin can change settings.</Notice>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">Organisation & branding</h2>
          <form action={updateOrgSettings} className="grid gap-3 sm:grid-cols-2">
            <fieldset disabled={disabled} className="contents">
              <Field label="Legal name" htmlFor="org_name">
                <Input id="org_name" name="org_name" defaultValue={org?.org_name} required />
              </Field>
              <Field label="Brand name" htmlFor="brand_name">
                <Input id="brand_name" name="brand_name" defaultValue={org?.brand_name} required />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address" htmlFor="address">
                  <Input id="address" name="address" defaultValue={org?.address ?? ""} />
                </Field>
              </div>
              <Field label="LLPIN" htmlFor="llpin">
                <Input id="llpin" name="llpin" defaultValue={org?.llpin ?? ""} />
              </Field>
              <Field label="Website" htmlFor="website">
                <Input id="website" name="website" defaultValue={org?.website ?? ""} />
              </Field>
              <Field label="Contact email" htmlFor="contact_email">
                <Input id="contact_email" name="contact_email" type="email" defaultValue={org?.contact_email ?? ""} />
              </Field>
              <Field label="Verify base URL" htmlFor="verify_base_url" hint="e.g. https://learn.quellflow.com">
                <Input id="verify_base_url" name="verify_base_url" defaultValue={org?.verify_base_url ?? ""} />
              </Field>
              <Field label="Sender name" htmlFor="sender_name">
                <Input id="sender_name" name="sender_name" defaultValue={org?.sender_name ?? ""} />
              </Field>
              <Field label="Sender email" htmlFor="sender_email" hint="Provided later (D-10)">
                <Input id="sender_email" name="sender_email" type="email" defaultValue={org?.sender_email ?? ""} />
              </Field>
              <Field label="Academic year starts in" htmlFor="ay_month" hint={`Current academic year label: ${ay ?? "—"}`}>
                <Select id="ay_month" name="academic_year_start_month" defaultValue={String(org?.academic_year_start_month ?? 6)}>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Academic year label override" htmlFor="ay_override" hint="Leave empty to compute (e.g. 2627)">
                <Input id="ay_override" name="academic_year_label_override" defaultValue={org?.academic_year_label_override ?? ""} />
              </Field>
              {canEdit ? (
                <div className="sm:col-span-2">
                  <Button type="submit">Save settings</Button>
                </div>
              ) : null}
            </fieldset>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-1 font-bold">Document numbering</h2>
            <p className="mb-3 text-xs text-slate">
              Tokens: <code>{"{AY}"}</code> academic year · <code>{"{YYYY}"}</code> · <code>{"{ROLE}"}</code> role code ·{" "}
              <code>{"{TRACK}"}</code> · <code>{"{SEQ:4}"}</code> padded number. Changes apply to documents issued afterwards.
            </p>
            <ul className="divide-y divide-line">
              {(schemes ?? []).map((s) => (
                <li key={s.id} className="py-3">
                  <form action={updateNumberingScheme} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                    <input type="hidden" name="id" value={s.id} />
                    <fieldset disabled={disabled} className="contents">
                      <Field label={DOCUMENT_TYPE_LABEL[s.doc_type]} htmlFor={`pat_${s.id}`} hint={`Next: ${preview[s.id] ?? "—"}`}>
                        <Input id={`pat_${s.id}`} name="pattern" defaultValue={s.pattern} className="font-mono" />
                      </Field>
                      <div className="flex items-center gap-3 pb-6 sm:pb-0">
                        <label className="flex items-center gap-1 text-xs text-ink">
                          <input type="checkbox" name="reset_per_academic_year" defaultChecked={s.reset_per_academic_year} /> Reset yearly
                        </label>
                        {canEdit ? (
                          <Button type="submit" variant="secondary">
                            Save
                          </Button>
                        ) : null}
                      </div>
                    </fieldset>
                  </form>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-1 font-bold">Signatories</h2>
            <p className="mb-3 text-xs text-slate">Names and titles printed on documents. Signature images are uploaded with the document module (Phase 2).</p>
            <ul className="mb-3 space-y-2 text-sm">
              {(signatories ?? []).length === 0 ? <li className="text-slate">None yet – documents stay in draft until added.</li> : null}
              {(signatories ?? []).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span>
                    <strong>{s.name}</strong> <span className="text-slate">· {s.title}</span>
                    {!s.is_active ? <span className="ml-2 text-xs text-red-700">inactive</span> : null}
                  </span>
                  {canEdit ? (
                    <form action={toggleSignatory}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="is_active" value={String(!s.is_active)} />
                      <Button type="submit" variant="ghost" className="min-h-9 px-2 text-xs">
                        {s.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
            {canEdit ? (
              <form action={addSignatory} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field label="Name" htmlFor="sig_name">
                  <Input id="sig_name" name="name" required />
                </Field>
                <Field label="Title" htmlFor="sig_title">
                  <Input id="sig_title" name="title" required placeholder="Designated Partner" />
                </Field>
                <Button type="submit" variant="secondary">
                  Add
                </Button>
              </form>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  );
}
