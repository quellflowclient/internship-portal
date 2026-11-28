/**
 * Student → one document (docs/20 §7, docs/19 §8 P6 step 3). Shows the frozen snapshot as text,
 * a PDF link, and – for an issued offer / T&C / consent – the acceptance box.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleCheck, Info } from "lucide-react";
import { buttonClass, Card, CardHeader, Crumbs, DL, Notice } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ACCEPT_DOC_TYPES, DOC_TYPE_LABEL } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/utils";
import { uuid } from "@/lib/validators";
import type { MyAcceptance, MyDocument } from "../_parts/shared";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Document" };

function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const parts = [str(o.name), str(o.title)].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }
  return null;
}

/** Short summary of the snapshot when the document has no body text. */
function summary(data: Record<string, unknown>): [string, string][] {
  const start = str(data.start_date);
  const end = str(data.end_date);
  const rows: [string, string | null][] = [
    ["Name", str(data.name)],
    ["Programme", str(data.programme) ?? str(data.event_title)],
    ["Project", str(data.project)],
    ["Batch", str(data.batch)],
    ["Dates", str(data.event_dates) ?? (start || end ? `${formatDate(start)} to ${formatDate(end)}` : null)],
    ["Result", str(data.result)],
    ["Signed by", str(data.signatory)],
  ];
  return rows.filter((r): r is [string, string] => !!r[1]);
}

export default async function StudentDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["student"]);
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("documents")
    .select("id, type, number, version, status, issued_at, revoked_at, data")
    .eq("id", id)
    .neq("status", "draft")
    .maybeSingle();
  if (!row) notFound();
  const doc = row as MyDocument;
  const snapshot = doc.data ?? {};
  const body = str(snapshot.body);
  const title = DOC_TYPE_LABEL[doc.type];
  const needsAcceptance = ACCEPT_DOC_TYPES.includes(doc.type);

  let acceptance: MyAcceptance | null = null;
  if (needsAcceptance && doc.status !== "issued") {
    const { data } = await supabase.from("document_acceptances").select("document_id, typed_name, accepted_at").eq("document_id", doc.id).maybeSingle();
    acceptance = (data as MyAcceptance | null) ?? null;
  }
  const canView = doc.status === "issued" || doc.status === "accepted";

  return (
    <>
      <Crumbs items={[{ label: "Documents", href: "/student/documents" }, { label: title }]} />

      <article className="flex flex-col gap-3.5 rounded-xl border border-line bg-surface p-[18px] text-base leading-relaxed md:p-7">
        <div className="flex flex-wrap justify-between gap-3 border-b-2 border-fg pb-3.5">
          <div>
            <div className="font-bold tracking-[0.06em]">QUELLFLOW TECHNOLOGIES LLP</div>
            <small className="text-xs text-fg-3">Surendranagar, Gujarat</small>
          </div>
          <div className="text-right">
            <b className="text-sm">{doc.number}</b>
            <br />
            <small className="text-xs text-fg-3">
              Version {doc.version}, issued {formatDate(doc.issued_at)}
            </small>
          </div>
        </div>
        <h1 className="text-lg font-bold">{title}</h1>
        {body ? (
          <div className="whitespace-pre-line break-words">{body}</div>
        ) : (
          <DL items={summary(snapshot)} />
        )}
      </article>

      {canView ? (
        <a href={`/api/documents/${doc.id}/pdf`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "md", "w-full no-underline md:w-fit")}>
          View PDF
        </a>
      ) : null}

      {doc.status === "revoked" ? (
        <Notice tone="error" icon={<Info aria-hidden />}>
          This document was revoked on {formatDate(doc.revoked_at)}. Ask the Quellflow team if you have questions.
        </Notice>
      ) : doc.status === "superseded" ? (
        <Notice icon={<Info aria-hidden />}>A newer version of this document exists. You can find it in your documents.</Notice>
      ) : null}

      {needsAcceptance && doc.status === "issued" ? (
        <Card>
          <CardHeader title="Accept and sign" />
          <AcceptForm id={doc.id} placeholder={str(snapshot.name) ?? undefined} />
        </Card>
      ) : acceptance ? (
        <Notice tone="success" icon={<CircleCheck aria-hidden />}>
          Accepted by <b>{acceptance.typed_name}</b> on {formatDateTime(acceptance.accepted_at)}
        </Notice>
      ) : null}
    </>
  );
}
