/**
 * GET /api/documents/template-preview/<type> – the active template of a type filled with sample data
 * (Settings → Templates "Preview with sample data"). Admins only; marked "SAMPLE – not valid".
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { DOC_TYPE_LABEL } from "@/lib/labels";
import type { DocType } from "@/lib/types";
import { todayIST } from "@/lib/utils";
import { renderPdf, type PdfTemplate } from "@/server/documents/pdf";
import { verifyBase } from "@/server/documents/links";
import { SAMPLE_VALUES } from "@/server/documents/rules";
import { placeholderValues, renderPlaceholders, resolveSignatory, type DocData } from "@/server/documents/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (status: number, message: string) =>
  new NextResponse(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type: raw } = await params;
  if (!Object.prototype.hasOwnProperty.call(DOC_TYPE_LABEL, raw)) return text(404, "Unknown document type");
  const type = raw as DocType;
  const session = await getSession();
  if (!session?.profile?.is_active || session.profile.role !== "admin") return text(403, "Admins only");

  const supabase = await createClient();
  const [tplRes, orgRes] = await Promise.all([
    supabase.from("document_templates").select("title, body, layout, background_path, version").eq("type", type).eq("active", true).maybeSingle(),
    supabase.from("org_settings").select("org_name, verify_base_url").eq("id", 1).maybeSingle(),
  ]);
  const tpl = tplRes.data as (PdfTemplate & { title: string; body: string; version: number }) | null;
  if (!tpl) return text(404, "There is no active template for this type");
  const org = orgRes.data as { org_name: string | null; verify_base_url: string | null } | null;

  const mine = await resolveSignatory(supabase, session.userId);
  const sig =
    mine ??
    ((await supabase.from("signatories").select("name, title, title_on_docs, signature_data").eq("is_active", true).order("sort").limit(1)).data?.[0] as
      | { name: string; title: string; title_on_docs: string | null; signature_data: string | null }
      | undefined);

  const base: Omit<DocData, "text"> = {
    ...SAMPLE_VALUES,
    name: SAMPLE_VALUES.name,
    title: tpl.title,
    issue_date: todayIST(),
    org_name: org?.org_name || "Quellflow Technologies LLP",
    template_version: tpl.version,
  };
  const data: DocData = {
    ...base,
    text: renderPlaceholders(tpl.body, placeholderValues(base, { student_type: SAMPLE_VALUES.student_type, min_attendance: SAMPLE_VALUES.min_attendance })).trim(),
  };
  const origin = req.nextUrl.origin;
  try {
    const bytes = await renderPdf(
      { type, number: `QF-SAMPLE-0001`, data },
      tpl,
      sig ? { name: sig.name, title: sig.title_on_docs?.trim() || sig.title, signature: sig.signature_data } : { name: "Signatory name", title: "Title on documents" },
      `${verifyBase(org?.verify_base_url, origin)}/v/sample`,
      { watermark: "SAMPLE – not valid", origin },
    );
    return new NextResponse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="sample-${type}-v${tpl.version}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("Template preview failed", type, e);
    return text(500, "The preview could not be made. Check the layout JSON of this template.");
  }
}
