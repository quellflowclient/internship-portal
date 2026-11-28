/**
 * Public certificate check (docs/20 §7, docs/19 §8 P6 step 4) – shared by /v/<token> and /verify.
 * Shows only what verify_document / verify_by_number return (public_doc_fields + status), never anything else.
 */
import Link from "next/link";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import { Card, DL, Logo, Notice } from "@/components/ui";
import { DOC_TYPE_LABEL } from "@/lib/labels";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import type { DocType } from "@/lib/types";

export type VerifyStatus = "valid" | "revoked" | "superseded" | "not_found" | "error";
type Raw = Record<string, unknown>;

const STATUS_WORDS = new Set(["valid", "revoked", "superseded", "not_found"]);

function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object") {
    const o = v as Raw;
    const parts = [str(o.name), str(o.title)].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }
  return null;
}

/** The check status from the RPC (`result`); the document's own result comes back as `outcome`. */
export function statusOf(data: unknown, failed: boolean): VerifyStatus {
  if (failed || !data || typeof data !== "object") return "error";
  const d = data as Raw;
  const r = str(d.result);
  if (r === "valid" || r === "revoked" || r === "superseded" || r === "not_found") return r;
  if (!str(d.number)) return "not_found";
  if (d.revoked_on) return "revoked";
  if (d.replaced_by) return "superseded";
  return "valid";
}

export function VerifyHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-4 py-3.5 font-bold">
        <Logo />
        Quellflow certificate check
      </div>
    </header>
  );
}

const BAND = {
  ok: { band: "bg-ok-soft", icon: "bg-ok", title: "text-ok" },
  bad: { band: "bg-bad-soft", icon: "bg-bad", title: "text-bad" },
  warn: { band: "bg-warn-soft", icon: "bg-warn", title: "text-warn" },
} as const;

function Band({ tone, icon, title, sub }: { tone: keyof typeof BAND; icon: React.ReactNode; title: string; sub: React.ReactNode }) {
  const t = BAND[tone];
  return (
    <div className={cn("flex items-center gap-3.5 rounded-t-xl border-b border-line px-4 py-4", t.band)}>
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-full text-surface [&_svg]:size-[22px] [&_svg]:stroke-[2.4]", t.icon)}>{icon}</span>
      <div className="min-w-0">
        <b className={cn("block text-lg", t.title)}>{title}</b>
        <span className="block text-sm break-words text-fg-2">{sub}</span>
      </div>
    </div>
  );
}

export function VerifyResult({ data, failed, byNumber }: { data: unknown; failed?: boolean; byNumber?: boolean }) {
  const status = statusOf(data, !!failed);
  const d = (data && typeof data === "object" ? data : {}) as Raw;
  const type = str(d.type) as DocType | null;
  const typeLabel = type ? (DOC_TYPE_LABEL[type] ?? type) : null;
  const noun = typeLabel && /certificate/i.test(typeLabel) ? "certificate" : "document";
  const checked = <p className="text-center text-xs text-fg-3">Checked {formatDateTime(new Date())}</p>;

  if (status === "error" || status === "not_found") {
    return (
      <>
        <Card>
          {status === "error" ? (
            <Band tone="warn" icon={<TriangleAlert aria-hidden />} title="Could not check right now" sub="Please try again in a minute." />
          ) : (
            <Band tone="warn" icon={<TriangleAlert aria-hidden />} title="Not found" sub={
                byNumber
                  ? "No document matches this number and surname. They may be mistyped, or the document is not genuine."
                  : "No document matches this code. It may be mistyped or not genuine."
              }
            />
          )}
          <div className="flex flex-col gap-2 p-4 text-sm">
            <p>
              Email <b>contact@quellflow.com</b> with a photo of the document and we will confirm.
            </p>
            {byNumber ? null : (
              <p className="text-fg-2">
                No QR code?{" "}
                <Link href="/verify" className="font-semibold">
                  Check by number and surname
                </Link>
              </p>
            )}
          </div>
        </Card>
        {checked}
      </>
    );
  }

  const number = str(d.number);
  const replacedBy = str(d.replaced_by);
  const eventTitle = str(d.event_title);
  const programme = str(d.programme) ?? eventTitle;
  const start = str(d.start_date);
  const end = str(d.end_date);
  const dates = str(d.event_dates) ?? (start || end ? `${formatDate(start)} to ${formatDate(end)}` : null);
  const resultText = str(d.outcome);

  const items: [React.ReactNode, React.ReactNode][] = [];
  const add = (k: string, v: string | null) => {
    if (v) items.push([k, v]);
  };
  add("Document", typeLabel);
  add("Number", number);
  if (status === "revoked") {
    add("Revoked on", formatDate(str(d.revoked_on)));
    add("Reason", str(d.revoked_reason));
    add("Replaced by", replacedBy);
  }
  add("Name", str(d.name));
  add(eventTitle && !str(d.programme) ? "Event" : "Programme", programme);
  add("Project", str(d.project));
  add("Batch", str(d.batch));
  add("Dates", dates);
  add("Result", resultText && !STATUS_WORDS.has(resultText) ? resultText : null);
  add("Issued on", d.issued_on ? formatDate(str(d.issued_on)) : null);
  add("Signed by", str(d.signatory));

  return (
    <>
      <Card>
        {status === "valid" ? (
          <Band tone="ok" icon={<Check aria-hidden />} title={`Valid ${noun}`} sub="Issued by Quellflow Technologies LLP" />
        ) : status === "revoked" ? (
          <Band tone="bad" icon={<X aria-hidden />} title="Revoked" sub={`This ${noun} is no longer valid.`} />
        ) : (
          <Band
            tone="warn"
            icon={<TriangleAlert aria-hidden />}
            title="Superseded"
            sub={replacedBy ? `A newer version exists: ${replacedBy}` : "A newer version exists."}
          />
        )}
        <div className="p-4">
          <DL items={items} />
        </div>
      </Card>
      {status === "valid" ? (
        <Notice icon={<Info aria-hidden />}>Compare the name and number with the copy you have. This page is the proof; a PDF or print alone is not.</Notice>
      ) : null}
      {checked}
    </>
  );
}
