/**
 * Student → Documents (docs/20 §7). RLS shows only the signed-in student's non-draft documents.
 * Offer / T&C / consent waiting for acceptance open the accept page; the rest link to the PDF.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Check, ChevronRight, FileText, History, PenLine, ShieldCheck, X } from "lucide-react";
import { buttonClass, Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ACCEPT_DOC_TYPES, DOC_TYPE_LABEL } from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";
import type { MyAcceptance, MyDocument } from "./_parts/shared";

export const metadata: Metadata = { title: "Documents" };

const ROW = "flex min-h-[60px] items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0";
const ICON = "grid size-[34px] shrink-0 place-items-center rounded-[9px] [&_svg]:size-[17px]";

function RowText({ title, sub }: { title: string; sub: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <b className="text-sm break-words">{title}</b>
      <small className="text-xs break-words text-fg-2">{sub}</small>
    </span>
  );
}

export default async function StudentDocumentsPage() {
  await requireRole(["student"]);
  const supabase = await createClient();
  const [docsRes, accRes] = await Promise.all([
    supabase
      .from("documents")
      .select("id, type, number, version, status, issued_at, revoked_at")
      .neq("status", "draft")
      .order("issued_at", { ascending: false }),
    supabase.from("document_acceptances").select("document_id, typed_name, accepted_at"),
  ]);
  const docs = (docsRes.data ?? []) as MyDocument[];
  const accepted = new Map(((accRes.data ?? []) as MyAcceptance[]).map((a) => [a.document_id, a]));
  const awaiting = docs.filter((d) => d.status === "issued" && ACCEPT_DOC_TYPES.includes(d.type));
  const others = docs.filter((d) => !awaiting.includes(d));
  const hasCertificate = docs.some((d) => d.type === "certificate" && d.status !== "revoked");

  return (
    <>
      <PageHeader title="Documents" description="Each document has a QR code anyone can scan to check it is real." />

      {awaiting.length ? (
        <Card aria-label="Waiting for your signature">
          <ul>
            {awaiting.map((d) => (
              <li key={d.id} className="border-t border-line first:border-t-0">
                <Link href={`/student/documents/${d.id}`} className={cn(ROW, "border-t-0 text-fg no-underline hover:bg-hover")}>
                  <span className={cn(ICON, "bg-warn-soft text-warn")}>
                    <PenLine aria-hidden />
                  </span>
                  <RowText title={`${DOC_TYPE_LABEL[d.type]}${d.version > 1 ? ` v${d.version}` : ""}`} sub={`Awaiting your signature · ${d.number ?? ""}`} />
                  <ChevronRight className="size-4 shrink-0 text-fg-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <ul>
          {others.map((d) => {
            const acc = accepted.get(d.id);
            const view = d.status === "issued" || d.status === "accepted";
            const state =
              d.status === "accepted"
                ? { icon: <Check aria-hidden />, tone: "bg-ok-soft text-ok", sub: `Accepted on ${formatDate(acc?.accepted_at ?? null)}` }
                : d.status === "revoked"
                  ? { icon: <X aria-hidden />, tone: "bg-bad-soft text-bad", sub: `Revoked on ${formatDate(d.revoked_at)}` }
                  : d.status === "superseded"
                    ? { icon: <History aria-hidden />, tone: "bg-surface-2 text-fg-2", sub: "Replaced by a newer version" }
                    : { icon: <FileText aria-hidden />, tone: "bg-accent-soft text-accent-ink", sub: `Issued on ${formatDate(d.issued_at)}` };
            return (
              <li key={d.id} className={ROW}>
                <span className={cn(ICON, state.tone)}>{state.icon}</span>
                <Link href={`/student/documents/${d.id}`} className="flex min-w-0 flex-1 text-fg no-underline hover:underline">
                  <RowText title={`${DOC_TYPE_LABEL[d.type]}${d.version > 1 ? ` v${d.version}` : ""}`} sub={[state.sub, d.number].filter(Boolean).join(" · ")} />
                </Link>
                {view ? (
                  <a href={`/api/documents/${d.id}/pdf`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm", "no-underline")}>
                    View PDF
                  </a>
                ) : null}
              </li>
            );
          })}
          {hasCertificate ? null : (
            <li className={ROW}>
              <span className={cn(ICON, "bg-surface-2 text-fg-2")}>
                <ShieldCheck aria-hidden />
              </span>
              <RowText title="Internship certificate · Not issued yet" sub="Your certificate appears here after your batch is completed." />
            </li>
          )}
        </ul>
      </Card>
    </>
  );
}
