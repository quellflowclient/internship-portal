/**
 * GET /api/batches/<code>/zip – Batch → Close step 5 (docs/19 P7 step 3).
 * Admins only. Builds the PDF of every issued or accepted document of the batch's enrolments on the server
 * (the same renderer as /api/documents/<id>/pdf) and streams them as one ZIP, each named <document number>.pdf,
 * plus README.txt with the folder to save into. Nothing is stored.
 */
import { NextResponse, type NextRequest } from "next/server";
import { Zip, ZipPassThrough, strToU8 } from "fflate";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { DocType } from "@/lib/types";
import { renderPdf, type PdfTemplate } from "@/server/documents/pdf";
import { verifyBase, verifyUrlFor } from "@/server/documents/links";
import type { DocData } from "@/server/documents/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const text = (status: number, message: string) =>
  new NextResponse(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

type Doc = {
  id: string;
  type: DocType;
  number: string | null;
  verify_token: string | null;
  template_id: string;
  data: Partial<DocData>;
};

const safeName = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, "_");

/** Adds one stored (not re-compressed: PDFs are already compressed) file to the ZIP. */
function addFile(zip: Zip, name: string, bytes: Uint8Array) {
  const f = new ZipPassThrough(name);
  zip.add(f);
  f.push(bytes, true);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw);
  const session = await getSession();
  if (!session?.profile?.is_active) return text(401, "Sign in to download this ZIP");
  if (session.profile.role !== "admin") return text(403, "Only admins can download the batch ZIP");

  const supabase = await createClient();
  const { data: batch } = await supabase.from("batches").select("id, code").eq("code", code).maybeSingle();
  const b = batch as { id: string; code: string } | null;
  if (!b) return text(404, "Batch not found");

  const [enrolRes, orgRes] = await Promise.all([
    supabase.from("enrollments").select("id").eq("batch_id", b.id),
    supabase.from("org_settings").select("verify_base_url, local_files_root").eq("id", 1).maybeSingle(),
  ]);
  const enrolIds = ((enrolRes.data ?? []) as { id: string }[]).map((e) => e.id);
  const org = orgRes.data as { verify_base_url: string | null; local_files_root: string | null } | null;
  const { data: docRows } = enrolIds.length
    ? await supabase
        .from("documents")
        .select("id, type, number, verify_token, template_id, data")
        .in("enrollment_id", enrolIds)
        .in("status", ["issued", "accepted"])
        .order("number")
    : { data: [] };
  const docs = ((docRows ?? []) as Doc[]).filter((d) => d.number);
  if (!docs.length) return text(404, "No issued documents in this batch yet");

  const tplIds = [...new Set(docs.map((d) => d.template_id))];
  const { data: tplRows } = await supabase.from("document_templates").select("id, title, layout, background_path").in("id", tplIds);
  const templates = new Map(((tplRows ?? []) as (PdfTemplate & { id: string })[]).map((t) => [t.id, t]));

  const origin = req.nextUrl.origin;
  const base = verifyBase(org?.verify_base_url, origin);
  const root = org?.local_files_root?.replace(/[\\/]+$/, "");
  const folder = `${root ? `${root}\\` : "<local files folder>\\"}batches\\${b.code}\\close\\`;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) return controller.error(err);
        controller.enqueue(chunk);
        if (final) controller.close();
      });
      void (async () => {
        const added: string[] = [];
        const failed: string[] = [];
        for (const d of docs) {
          const name = `${safeName(d.number!)}.pdf`;
          try {
            const bytes = await renderPdf(
              { type: d.type, number: d.number, data: d.data ?? {} },
              templates.get(d.template_id) ?? null,
              null,
              verifyUrlFor(base, d.verify_token),
              { origin },
            );
            addFile(zip, name, bytes);
            added.push(name);
          } catch (e) {
            console.error("ZIP: PDF render failed", d.id, e);
            failed.push(d.number!);
          }
        }
        const lines = [
          `Batch ${b.code}: issued documents`,
          "",
          "Save these files to:",
          `  ${folder}`,
          "",
          `${added.length} ${added.length === 1 ? "PDF" : "PDFs"}, each named by its document number:`,
          ...added.map((n) => `  ${n}`),
        ];
        if (failed.length) {
          lines.push("", "These could not be made. Download them one by one from Documents:", ...failed.map((n) => `  ${n}`));
        }
        addFile(zip, "README.txt", strToU8(lines.join("\r\n") + "\r\n"));
        zip.end();
      })().catch((e) => controller.error(e));
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName(b.code)}-close.zip"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
