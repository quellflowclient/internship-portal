import Link from "next/link";
import { Check, FileText, Pencil, QrCode, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { WhatsAppIcon, waLink } from "@/components/icons";
import { ActionButton, ActionForm, CopyButton, FieldError, SubmitButton } from "@/components/toast";
import { ButtonLink, DL, Field, IconAnchor, Notice, Pill, Textarea } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { DOC_DISPLAY, DOC_TYPE_LABEL } from "@/lib/labels";
import { academicYear, studentFolder, type FilePatterns } from "@/lib/files";
import type { DocStatus, DocType } from "@/lib/types";
import type { SearchParams } from "@/lib/url";
import { formatDateTime } from "@/lib/utils";
import { deleteDraft, issueDraftAction, newVersion, restoreDocument, revokeDocument } from "@/server/actions/documents";
import { requestOrigin, verifyBase, verifyUrlFor } from "@/server/documents/links";
import type { DocData } from "@/server/documents/snapshot";
import { PdfSavedToggle, SharedViaSelect } from "./doc-toggles";
import { docHref } from "./shared";

type Doc = {
  id: string;
  type: DocType;
  number: string | null;
  status: DocStatus;
  version: number;
  issued_at: string | null;
  issued_by: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  verify_token: string | null;
  pdf_saved: boolean;
  shared_via: string | null;
  issue_note: string | null;
  supersedes_id: string | null;
  data: Partial<DocData> | null;
  student: { id: string; code: string; full_name: string; phone: string | null; created_at: string } | null;
  enrollment: { id: string; batch: { code: string } | null } | null;
};

const SCAN_LABEL: Record<string, string> = {
  valid: "shown as valid",
  revoked: "shown as revoked",
  superseded: "shown as replaced",
  not_found: "not found",
};

/** Documents → ?open=<id> (and &revoke=1 for the reason field). */
export async function DocPanel({ id, params, isOwner, revokeMode }: { id: string; params: SearchParams; isOwner: boolean; revokeMode: boolean }) {
  const supabase = await createClient();
  const closeHref = docHref(params);
  const { data } = await supabase
    .from("documents")
    .select(
      "id, type, number, status, version, issued_at, issued_by, revoked_at, revoked_reason, verify_token, pdf_saved, shared_via, issue_note, supersedes_id, data, student:students(id, code, full_name, phone, created_at), enrollment:enrollments(id, batch:batches(code))",
    )
    .eq("id", id)
    .maybeSingle();
  const d = data as unknown as Doc | null;

  if (!d) {
    return (
      <Drawer closeHref={closeHref} title="Document not found">
        <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
          This document does not exist. It may have been a draft that was deleted.
        </Notice>
      </Drawer>
    );
  }

  const [issuerRes, accRes, scansRes, settingsRes, nextRes, prevRes, origin] = await Promise.all([
    d.issued_by ? supabase.from("profiles").select("full_name, email").eq("id", d.issued_by).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("document_acceptances").select("typed_name, accepted_at, ip").eq("document_id", d.id).maybeSingle(),
    supabase.from("verification_scans").select("id, at, method, result").eq("document_id", d.id).order("at", { ascending: false }).limit(5),
    supabase
      .from("org_settings")
      .select("verify_base_url, local_files_root, file_patterns, academic_year_start_month, academic_year_label_override")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("documents")
      .select("id, number, status")
      .eq("supersedes_id", d.id)
      .neq("status", "draft")
      .order("issued_at", { ascending: false })
      .limit(1),
    d.supersedes_id ? supabase.from("documents").select("id, number").eq("id", d.supersedes_id).maybeSingle() : Promise.resolve({ data: null }),
    requestOrigin(),
  ]);
  const issuer = issuerRes.data as { full_name: string | null; email: string } | null;
  const acc = accRes.data as { typed_name: string; accepted_at: string; ip: string | null } | null;
  const scans = (scansRes.data ?? []) as { id: number; at: string; method: string; result: string }[];
  const settings = settingsRes.data as {
    verify_base_url: string | null;
    local_files_root: string | null;
    file_patterns: FilePatterns | null;
    academic_year_start_month: number | null;
    academic_year_label_override: string | null;
  } | null;
  const next = ((nextRes.data ?? []) as { id: string; number: string | null; status: string }[])[0] ?? null;
  const prev = prevRes.data as { id: string; number: string | null } | null;

  const draft = d.status === "draft";
  const live = d.status === "issued" || d.status === "accepted";
  const st = DOC_DISPLAY[d.status === "issued" && ["offer", "tnc", "consent"].includes(d.type) ? "awaiting" : d.status] ?? DOC_DISPLAY.issued;
  const s = d.student;
  const dd = d.data ?? {};
  const pdfHref = `/api/documents/${d.id}/pdf`;
  const verifyUrl = d.verify_token ? verifyUrlFor(verifyBase(settings?.verify_base_url, origin), d.verify_token) : null;
  const label = DOC_TYPE_LABEL[d.type] ?? d.type;
  const wa =
    verifyUrl && s?.phone
      ? waLink(s.phone, `Hi ${s.full_name.split(/\s+/)[0]}, your ${label.toLowerCase()} ${d.number} from Quellflow is ready. Check it here: ${verifyUrl}`)
      : undefined;
  const folder = s
    ? `${studentFolder(
        settings?.file_patterns,
        settings?.local_files_root,
        academicYear(s.created_at, settings?.academic_year_start_month ?? 6, settings?.academic_year_label_override),
        s.code,
        s.full_name,
      )}03_documents\\`
    : null;
  const fileName = `${d.number ?? "draft"}.pdf`;
  const selfHref = docHref(params, { open: d.id });

  const items: [React.ReactNode, React.ReactNode][] = [
    ["Document", `${label}, version ${d.version}`],
    ["Number", d.number ?? "Given when issued"],
    [
      "Student",
      s ? (
        <>
          <Link href={`/admin/students/${encodeURIComponent(s.code)}`} className="font-semibold text-accent-ink">
            {s.full_name}
          </Link>
          , {s.code}
        </>
      ) : (
        "—"
      ),
    ],
  ];
  if (d.enrollment?.batch?.code) items.push(["Batch", d.enrollment.batch.code]);
  if (dd.event_title) items.push(["Event", [dd.event_title, dd.event_dates].filter(Boolean).join(", ")]);
  if (dd.name) items.push(["Name printed", dd.name]);
  if (d.issued_at) items.push(["Issued", `${formatDateTime(d.issued_at)}${issuer ? `, by ${issuer.full_name || issuer.email}` : ""}`]);
  if (dd.signatory) items.push(["Signed by", `${dd.signatory}${dd.signatory_title ? `, ${dd.signatory_title}` : ""}`]);
  items.push([
    "Status",
    <Pill key="s" tone={st.tone} dot>
      {st.label}
    </Pill>,
  ]);
  if (acc) items.push(["Accepted", `Typed “${acc.typed_name}” on ${formatDateTime(acc.accepted_at)}${acc.ip ? `, IP ${acc.ip}` : ""}`]);
  if (d.issue_note) items.push(["Note", d.issue_note]);
  if (prev) items.push(["Replaces", <Link key="p" href={docHref(params, { open: prev.id })} className="font-semibold text-accent-ink">{prev.number ?? "Earlier version"}</Link>]);
  if (next) items.push(["Replaced by", <Link key="n" href={docHref(params, { open: next.id })} className="font-semibold text-accent-ink">{next.number ?? "Newer version"}</Link>]);

  const footer = draft ? (
    <>
      {isOwner ? (
        <ActionButton action={deleteDraft.bind(null, d.id)} variant="danger">
          <Trash2 aria-hidden />
          Delete draft
        </ActionButton>
      ) : null}
      <span className="flex-1 max-md:hidden" />
      <ButtonLink variant="secondary" href={docHref(params, { new: 1, draft: d.id })} scroll={false}>
        <Pencil aria-hidden />
        Edit
      </ButtonLink>
      <ActionButton action={issueDraftAction.bind(null, d.id)} variant="primary">
        Issue
      </ActionButton>
    </>
  ) : revokeMode && live && isOwner ? (
    <>
      <ButtonLink variant="ghost" href={selfHref} scroll={false}>
        Cancel
      </ButtonLink>
      <span className="flex-1 max-md:hidden" />
      <SubmitButton form="f-revoke" variant="danger" pendingText="Revoking…">
        Revoke document
      </SubmitButton>
    </>
  ) : d.status === "superseded" ? (
    <span className="text-xs text-fg-3">A newer version replaced this document. It cannot be changed.</span>
  ) : (
    <>
      {live && isOwner ? (
        <ButtonLink variant="danger" href={docHref(params, { open: d.id, revoke: 1 })} scroll={false}>
          <Trash2 aria-hidden />
          Revoke
        </ButtonLink>
      ) : d.status === "revoked" ? (
        <span className="text-xs text-fg-3 max-md:hidden">Revoked documents cannot be changed.</span>
      ) : null}
      <span className="flex-1 max-md:hidden" />
      {next ? null : (
        <ActionButton action={newVersion.bind(null, d.id)} variant="secondary">
          <RefreshCw aria-hidden />
          Issue new version
        </ActionButton>
      )}
    </>
  );

  return (
    <Drawer
      closeHref={closeHref}
      title={label}
      sub={d.number ?? "Draft, not issued yet"}
      lead={
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-fg-2 [&_svg]:size-4">
          <FileText aria-hidden />
        </span>
      }
      icons={
        <>
          <IconAnchor href={pdfHref} label={draft ? "Open the draft PDF" : "Open the PDF"}>
            <FileText aria-hidden />
          </IconAnchor>
          {wa ? (
            <IconAnchor href={wa} label="Share on WhatsApp" className="text-wa">
              <WhatsAppIcon className="size-[18px]" />
            </IconAnchor>
          ) : null}
        </>
      }
      footer={footer}
    >
      {d.status === "revoked" ? (
        <Notice tone="error" icon={<TriangleAlert aria-hidden />}>
          Revoked {formatDateTime(d.revoked_at)}. Reason: {d.revoked_reason ?? "—"}
        </Notice>
      ) : null}
      {draft ? (
        <Notice icon={<FileText aria-hidden />}>
          Draft. It has no number and the QR code is not active until you issue it.
        </Notice>
      ) : null}
      {d.status === "issued" && ["offer", "tnc", "consent"].includes(d.type) ? (
        <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
          Waiting for the student to read and accept it in the portal.
        </Notice>
      ) : null}

      {revokeMode && live && isOwner ? (
        <ActionForm action={revokeDocument} undo={restoreDocument} closeHref={selfHref} id="f-revoke">
          <input type="hidden" name="id" value={d.id} />
          <Field label="Why revoke this document?" htmlFor="doc-revoke" required hint="The verify page shows it as revoked with this reason. Undo is possible for 2 minutes.">
            <Textarea id="doc-revoke" name="revoked_reason" maxLength={300} autoFocus placeholder="e.g. Wrong batch dates printed" />
            <FieldError name="revoked_reason" />
          </Field>
        </ActionForm>
      ) : null}

      <DL items={items} />

      {verifyUrl ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-fg-2">Verify link (in the QR code)</span>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 py-1 pr-1 pl-3">
            <code className="min-w-0 flex-1 text-xs break-all">{verifyUrl}</code>
            <CopyButton text={verifyUrl} label="Copy verify link" small />
          </div>
        </div>
      ) : null}

      {!draft ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-fg-2">PDF on the office PC</span>
          {d.pdf_saved ? (
            <Notice tone="success" icon={<Check aria-hidden />}>
              Saved in the student’s documents folder.
            </Notice>
          ) : (
            <Notice tone="info" icon={<FileText aria-hidden />}>
              Open the PDF, save it with this name in this folder, then tick the box.
            </Notice>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 py-1 pr-1 pl-3">
            <code className="min-w-0 flex-1 text-xs break-all">{fileName}</code>
            <CopyButton text={fileName} label="Copy file name" small />
          </div>
          {folder ? (
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 py-1 pr-1 pl-3">
              <code className="min-w-0 flex-1 text-xs break-all text-fg-2">{folder}</code>
              <CopyButton text={folder} label="Copy folder path" small />
            </div>
          ) : null}
          <PdfSavedToggle id={d.id} saved={d.pdf_saved} />
          <SharedViaSelect id={d.id} via={d.shared_via} />
        </div>
      ) : null}

      {!draft ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-fg-2">Recent QR checks</span>
          {scans.length ? (
            <ul className="flex flex-col gap-2.5">
              {scans.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5 text-sm">
                  <span
                    className={
                      c.result === "valid"
                        ? "grid size-7 shrink-0 place-items-center rounded-full bg-ok-soft text-ok [&_svg]:size-3.5"
                        : "grid size-7 shrink-0 place-items-center rounded-full bg-warn-soft text-warn [&_svg]:size-3.5"
                    }
                  >
                    <QrCode aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <b className="block font-semibold">
                      {c.method === "qr" ? "QR code" : "Number and surname"}, {SCAN_LABEL[c.result] ?? c.result}
                    </b>
                    <small className="block text-xs text-fg-3">{formatDateTime(c.at)}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-3">Nobody has checked it yet.</p>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}
