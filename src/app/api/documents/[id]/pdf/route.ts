/**
 * GET /api/documents/<id>/pdf – the PDF, made on demand and never stored (docs/19 P6).
 * Access is decided by RLS on documents: admins see every document, students only their own issued ones.
 * Drafts (admins only) carry a "DRAFT – not valid" watermark.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DocStatus, DocType } from "@/lib/types";
import { renderPdf, type PdfTemplate } from "@/server/documents/pdf";
import { verifyBase, verifyUrlFor } from "@/server/documents/links";
import type { DocData } from "@/server/documents/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WATERMARK: Partial<Record<DocStatus, string>> = {
  draft: "DRAFT – not valid",
  revoked: "REVOKED – not valid",
  superseded: "REPLACED – not valid",
};

const text = (status: number, message: string) =>
  new NextResponse(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

type Doc = {
  id: string;
  type: DocType;
  number: string | null;
  status: DocStatus;
  verify_token: string | null;
  template_id: string;
  data: Partial<DocData>;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return text(404, "Document not found");
  const session = await getSession();
  if (!session?.profile?.is_active) return text(401, "Sign in to open this document");
  const isAdmin = session.profile.role === "admin";

  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, type, number, status, verify_token, template_id, data")
    .eq("id", id)
    .maybeSingle();
  const doc = data as Doc | null;
  if (!doc || (doc.status === "draft" && !isAdmin)) return text(404, "Document not found");

  // Templates are admin-only in RLS; a student who may see the document gets its (immutable) template version here.
  const fields = "title, layout, background_path";
  let tpl = (await supabase.from("document_templates").select(fields).eq("id", doc.template_id).maybeSingle()).data as PdfTemplate | null;
  if (!tpl) {
    try {
      tpl = (await createAdminClient().from("document_templates").select(fields).eq("id", doc.template_id).maybeSingle()).data as PdfTemplate | null;
    } catch {
      tpl = null; // no service key: the demo layout is used
    }
  }
  const { data: org } = await supabase.from("org_settings").select("verify_base_url").eq("id", 1).maybeSingle();
  const origin = req.nextUrl.origin;
  const verifyUrl = verifyUrlFor(verifyBase((org as { verify_base_url: string | null } | null)?.verify_base_url, origin), doc.verify_token);

  try {
    const bytes = await renderPdf({ type: doc.type, number: doc.number, data: doc.data ?? {} }, tpl, null, verifyUrl, {
      watermark: WATERMARK[doc.status] ?? null,
      origin,
    });
    const fileName = `${(doc.number ?? "draft").replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`;
    return new NextResponse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (e) {
    console.error("PDF render failed", id, e);
    return text(500, "The PDF could not be made. Check the template layout in Settings, Templates.");
  }
}
