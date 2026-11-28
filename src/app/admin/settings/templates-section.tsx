import { Eye, FolderOpen, Info, Lock } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { Chevron, End, List, ListRow, MainCell, Wide } from "@/components/list";
import { ActionForm, FieldError, SubmitButton } from "@/components/toast";
import { buttonClass, ButtonLink, Card, CardHeader, DL, Field, Input, Notice, Pill, Select, Textarea } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { DOC_TYPE_LABEL } from "@/lib/labels";
import type { DocType } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { saveTemplate } from "@/server/actions/documents-settings";
import { DOC_TYPES, LAYOUT_FIELDS, PLACEHOLDERS } from "@/server/documents/rules";
import { listTemplateFiles } from "@/server/documents/template-files";

type Tpl = {
  id: string;
  type: DocType;
  version: number;
  title: string;
  body: string;
  layout: Record<string, unknown> | null;
  background_path: string | null;
  requires_acceptance: boolean;
  created_at: string;
};

const CLOSE = "/admin/settings?sec=templates";
const FORM_ID = "template-form";

const LAYOUT_EXAMPLE = `{
  "name": { "x": 20, "y": 80, "width": 257, "height": 16, "fontSize": 30, "alignment": "center" },
  "qr": { "x": 22, "y": 152, "width": 30, "height": 30 }
}`;

/** Settings → Templates (docs/20 §2): wording, Canva background and field positions. Saving makes a new version. */
export async function TemplatesSection({ isOwner, open }: { isOwner: boolean; open?: string }) {
  const supabase = await createClient();
  const [{ data }, files] = await Promise.all([
    supabase
      .from("document_templates")
      .select("id, type, version, title, body, layout, background_path, requires_acceptance, created_at")
      .eq("active", true),
    listTemplateFiles(),
  ]);
  const rows = (data ?? []) as Tpl[];
  const byType = new Map(rows.map((t) => [t.type, t]));
  const selType = DOC_TYPES.find((t) => t === open);
  const sel = selType ? byType.get(selType) : undefined;
  const layoutText = sel?.layout && Object.keys(sel.layout).length ? JSON.stringify(sel.layout, null, 2) : "";

  return (
    <>
      <Card>
        <CardHeader
          title="Document templates"
          info="Wording, background design and field positions for each document. Saving makes a new version; documents already issued keep theirs."
        />
        <List cols="minmax(0,2fr) 90px minmax(0,1.2fr) 20px" head={[["Document"], ["Version", "wide"], ["Design", "wide-right"], ["", "wide"]]}>
          {DOC_TYPES.map((t, i) => {
            const tpl = byType.get(t);
            return (
              <ListRow key={t} href={`${CLOSE}&open=${t}`} i={i} selected={t === open}>
                <MainCell title={DOC_TYPE_LABEL[t]} sub={tpl ? tpl.title : "No active template"} narrow={tpl ? `version ${tpl.version}` : undefined} />
                <Wide className="text-fg-2">{tpl ? `Version ${tpl.version}` : "—"}</Wide>
                <End>
                  {!tpl ? (
                    <Pill tone="bad">Missing</Pill>
                  ) : tpl.background_path ? (
                    <Pill tone="acc">{tpl.background_path.replace("/templates/", "")}</Pill>
                  ) : (
                    <Pill>Demo layout</Pill>
                  )}
                </End>
                <Chevron />
              </ListRow>
            );
          })}
        </List>
      </Card>

      {selType ? (
        <Drawer
          closeHref={CLOSE}
          title={DOC_TYPE_LABEL[selType]}
          sub={sel ? `Version ${sel.version}, saved ${formatDate(sel.created_at)}` : "No active template yet"}
          footer={
            isOwner ? (
              <>
                <ButtonLink href={CLOSE} scroll={false} variant="ghost">
                  Cancel
                </ButtonLink>
                <span className="flex-1 max-md:hidden" />
                {sel ? (
                  <a href={`/api/documents/template-preview/${selType}`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                    <Eye aria-hidden />
                    Preview with sample data
                  </a>
                ) : null}
                <SubmitButton form={FORM_ID}>Save as new version</SubmitButton>
              </>
            ) : sel ? (
              <a href={`/api/documents/template-preview/${selType}`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                <Eye aria-hidden />
                Preview with sample data
              </a>
            ) : undefined
          }
        >
          {!isOwner ? (
            <>
              <Notice icon={<Lock aria-hidden />}>Only an owner can change templates.</Notice>
              {sel ? (
                <DL
                  items={[
                    ["Title", sel.title],
                    ["Design", sel.background_path ?? "Demo layout"],
                    ["Wording", <span key="b" className="whitespace-pre-wrap">{sel.body.replace(/\\n/g, "\n")}</span>],
                  ]}
                />
              ) : null}
            </>
          ) : (
            <>
              <Notice icon={<Info aria-hidden />}>
                The preview shows the saved version. Save first to preview your changes; issued documents keep their own version.
              </Notice>
              <ActionForm id={FORM_ID} action={saveTemplate} closeHref={`${CLOSE}&open=${selType}`} className="flex flex-col gap-4">
                <input type="hidden" name="type" value={selType} />
                <Field label="Title" htmlFor="tp-title" required hint="Printed as the heading.">
                  <Input id="tp-title" name="title" defaultValue={sel?.title ?? DOC_TYPE_LABEL[selType]} maxLength={150} />
                  <FieldError name="title" />
                </Field>
                <Field label="Wording" htmlFor="tp-body" required hint="Use the placeholders below; they are filled in from the student’s record when the document is issued.">
                  <Textarea id="tp-body" name="body" defaultValue={sel?.body.replace(/\\n/g, "\n") ?? ""} rows={10} className="min-h-48" maxLength={10000} />
                  <FieldError name="body" />
                </Field>
                <details className="rounded-[10px] border border-line px-3 py-2 text-sm">
                  <summary className="min-h-11 cursor-pointer content-center font-semibold md:min-h-0">Placeholders</summary>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {PLACEHOLDERS.map(([k, m]) => (
                      <li key={k} className="flex flex-wrap gap-x-2">
                        <code className="rounded bg-surface-2 px-1.5 text-xs">{`{${k}}`}</code>
                        <span className="text-xs text-fg-2">{m}</span>
                      </li>
                    ))}
                  </ul>
                </details>

                <Field label="Background design (Canva PDF)" htmlFor="tp-bg" hint="Exported without the variable text. Leave on Demo layout until the design arrives.">
                  <Select id="tp-bg" name="background_path" defaultValue={sel?.background_path ?? ""}>
                    <option value="">Demo layout</option>
                    {files.map((f) => (
                      <option key={f} value={`/templates/${f}`}>
                        {f}
                      </option>
                    ))}
                  </Select>
                  <FieldError name="background_path" />
                </Field>
                {files.length ? null : (
                  <Notice icon={<FolderOpen aria-hidden />}>
                    Put the Canva PDF in public/templates/ to use it. Name it like {selType}-v1.pdf.
                  </Notice>
                )}

                <Field
                  label="Field positions (JSON, millimetres)"
                  htmlFor="tp-layout"
                  hint="Leave empty for the demo positions. Each field: x, y, width, height, and optionally fontSize and alignment (left, center, right)."
                >
                  <Textarea id="tp-layout" name="layout" defaultValue={layoutText} rows={8} className="min-h-40 font-mono text-xs" placeholder={LAYOUT_EXAMPLE} spellCheck={false} />
                  <FieldError name="layout" />
                </Field>
                <details className="rounded-[10px] border border-line px-3 py-2 text-sm">
                  <summary className="min-h-11 cursor-pointer content-center font-semibold md:min-h-0">Field names</summary>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {LAYOUT_FIELDS.map(([k, m]) => (
                      <li key={k} className="flex flex-wrap gap-x-2">
                        <code className="rounded bg-surface-2 px-1.5 text-xs">{k}</code>
                        <span className="text-xs text-fg-2">{m}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </ActionForm>
            </>
          )}
        </Drawer>
      ) : null}
    </>
  );
}
