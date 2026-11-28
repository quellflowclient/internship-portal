import { Info, Lock, Plus } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { Chevron, End, List, ListRow, MainCell, Wide } from "@/components/list";
import { ActionForm, FieldError, SubmitButton } from "@/components/toast";
import { ButtonLink, Card, CardHeader, Checkbox, Field, Input, Notice, Pill, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { saveSignatory } from "@/server/actions/documents-settings";
import { SignatureInput } from "../documents/_parts/signature-input";

type Row = {
  id: string;
  name: string;
  title: string;
  title_on_docs: string | null;
  profile_id: string | null;
  signature_data: string | null;
  is_active: boolean;
};

const CLOSE = "/admin/settings?sec=signatories";
const FORM_ID = "signatory-form";

/** Settings → Signatories (docs/20 §3): one row per admin; the admin who issues a document signs it. */
export async function SignatoriesSection({ isOwner, open, isNew }: { isOwner: boolean; open?: string; isNew: boolean }) {
  const supabase = await createClient();
  const [sigRes, adminRes] = await Promise.all([
    supabase.from("signatories").select("id, name, title, title_on_docs, profile_id, signature_data, is_active").order("sort").order("created_at"),
    supabase.from("profiles").select("id, full_name, email, is_active").eq("role", "admin").order("full_name"),
  ]);
  const rows = (sigRes.data ?? []) as Row[];
  const admins = (adminRes.data ?? []) as { id: string; full_name: string | null; email: string; is_active: boolean }[];
  const adminName = (id: string | null) => {
    const a = admins.find((x) => x.id === id);
    return a ? a.full_name || a.email : null;
  };
  const sel = open ? rows.find((r) => r.id === open) : undefined;
  const editing = isOwner && (isNew || !!sel);
  const linked = new Set(rows.map((r) => r.profile_id).filter(Boolean));

  return (
    <>
      <Card>
        <CardHeader
          title="Signatories"
          info="The admin who issues a document signs it. Their name, title and signature image are printed, and frozen into the document."
          actions={
            isOwner ? (
              <ButtonLink href={`${CLOSE}&new=1`} scroll={false} size="sm">
                <Plus aria-hidden />
                Add signatory
              </ButtonLink>
            ) : null
          }
        />
        <List
          cols="minmax(0,2fr) minmax(0,1.2fr) 120px 90px 20px"
          head={[["Signatory"], ["Linked admin", "wide"], ["Signature", "wide"], ["Status", "wide-right"], ["", "wide"]]}
          empty="No signatories yet. Add one for each admin who issues documents."
        >
          {rows.map((r, i) => (
            <ListRow key={r.id} href={`${CLOSE}&open=${r.id}`} i={i} selected={r.id === open}>
              <MainCell title={r.name} sub={r.title_on_docs || r.title} narrow={adminName(r.profile_id) ?? "No admin linked"} />
              <Wide className="text-fg-2">{adminName(r.profile_id) ?? "Not linked"}</Wide>
              <Wide>
                {r.signature_data ? (
                  // eslint-disable-next-line @next/next/no-img-element -- inline data URL thumbnail
                  <img src={r.signature_data} alt={`Signature of ${r.name}`} className="h-8 max-w-[110px] rounded bg-white object-contain" />
                ) : (
                  <span className="text-xs text-warn">No image</span>
                )}
              </Wide>
              <End>{r.is_active ? <Pill tone="ok">Active</Pill> : <Pill>Inactive</Pill>}</End>
              <Chevron />
            </ListRow>
          ))}
        </List>
      </Card>
      <Notice icon={<Info aria-hidden />}>
        The admin who issues a document signs it. An admin without a linked signatory cannot issue; an owner can sign as another active signatory.
      </Notice>

      {editing ? (
        <Drawer
          closeHref={CLOSE}
          title={sel ? sel.name : "Add signatory"}
          sub="Printed on every document this admin issues"
          footer={
            <>
              <ButtonLink href={CLOSE} scroll={false} variant="ghost">
                Cancel
              </ButtonLink>
              <span className="flex-1 max-md:hidden" />
              <SubmitButton form={FORM_ID}>{sel ? "Save signatory" : "Add signatory"}</SubmitButton>
            </>
          }
        >
          <ActionForm id={FORM_ID} action={saveSignatory} closeHref={CLOSE} className="flex flex-col gap-4">
            {sel ? <input type="hidden" name="id" value={sel.id} /> : null}
            <Field label="Name" htmlFor="sg-name" required hint="As it should print, e.g. Ashish Patel.">
              <Input id="sg-name" name="name" defaultValue={sel?.name ?? ""} maxLength={100} autoComplete="off" />
              <FieldError name="name" />
            </Field>
            <Field label="Title on documents" htmlFor="sg-title" required>
              <Input
                id="sg-title"
                name="title_on_docs"
                defaultValue={sel ? sel.title_on_docs || sel.title : ""}
                maxLength={150}
                placeholder="Partner, Quellflow Technologies LLP"
              />
              <FieldError name="title_on_docs" />
            </Field>
            <Field label="Linked admin" htmlFor="sg-admin" hint="The admin account that signs with this row when it issues a document.">
              <Select id="sg-admin" name="profile_id" defaultValue={sel?.profile_id ?? ""}>
                <option value="">Not linked</option>
                {admins
                  .filter((a) => (a.is_active && !linked.has(a.id)) || a.id === sel?.profile_id)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name || a.email}
                    </option>
                  ))}
              </Select>
              <FieldError name="profile_id" />
            </Field>
            <SignatureInput current={sel?.signature_data ?? null} />
            <FieldError name="signature" />
            <Checkbox name="is_active" defaultChecked={sel ? sel.is_active : true} label="Active. Can sign new documents." />
          </ActionForm>
          <Notice icon={<Info aria-hidden />}>Changing a signature never changes documents already issued.</Notice>
        </Drawer>
      ) : sel ? (
        <Drawer closeHref={CLOSE} title={sel.name} sub={sel.title_on_docs || sel.title}>
          <Notice icon={<Lock aria-hidden />}>Only an owner can change signatories.</Notice>
        </Drawer>
      ) : null}
    </>
  );
}
