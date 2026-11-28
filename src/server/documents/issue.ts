import "server-only";

/**
 * Draft → issue, shared by Documents (one at a time) and Batch → Close ("Issue all eligible").
 * The checks here give clear words first; guard_documents and issue_document() enforce the same rules in the database.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { STANDALONE_DOC_TYPES } from "@/lib/labels";
import type { DocType } from "@/lib/types";
import { fail, fromDb, type ActionResult } from "@/server/result";
import { allowsEnrolment, BODY_TYPES, needsEnrolment, PROJECT_OPTIONAL, PROJECT_REQUIRED } from "./rules";
import { buildSnapshot, contentHash, resolveSignatory, type DocData } from "./snapshot";

export interface IssueCtx {
  supabase: SupabaseClient;
  userId: string;
  isOwner: boolean;
}

export interface DraftFields {
  type: DocType;
  studentId: string;
  enrollmentId: string | null;
  projectId: string | null;
  body: string | null;
  eventTitle: string | null;
  eventDates: string | null;
  issueNote: string | null;
  signatoryId: string | null;
  supersedesId?: string | null;
  version?: number;
}

export const NO_SIGNATURE =
  "No signature is linked to your account. An owner can add it in Settings, Signatories.";

type Outcome<T> = ({ ok: true } & T) | { ok: false; result: ActionResult };
const no = (message: string, field?: string): { ok: false; result: ActionResult } => ({
  ok: false,
  result: fail(message, field ? { [field]: message } : undefined),
});

/** Plain-words version of the issuing rules (docs/20 §4, §5). Returns null when the document may be issued. */
export async function checkRules(ctx: IssueCtx, f: DraftFields): Promise<{ ok: false; result: ActionResult } | null> {
  if (needsEnrolment(f.type) && !f.enrollmentId) return no("Pick the enrolment", "enrollment_id");
  if (PROJECT_REQUIRED.includes(f.type) && !f.projectId) return no("Pick the college project", "project_id");
  if (BODY_TYPES.includes(f.type) && !f.body) return no("Type the text of the document", "body");

  if (STANDALONE_DOC_TYPES.includes(f.type)) {
    if (!ctx.isOwner) return no("Certificates without an internship are issued by an owner, with a reason.");
    if (!f.eventTitle) return no("Enter the event or title", "event_title");
    if (!f.issueNote) return no("Give the reason for this document", "issue_note");
  }

  if ((f.type === "certificate" || f.type === "experience") && f.enrollmentId) {
    const [enrolRes, statRes] = await Promise.all([
      ctx.supabase.from("enrollments").select("status, type").eq("id", f.enrollmentId).maybeSingle(),
      ctx.supabase.from("v_enrollment_stats").select("eligible").eq("enrollment_id", f.enrollmentId).maybeSingle(),
    ]);
    const en = enrolRes.data as { status: string; type: string } | null;
    if (!en) return no("This enrolment no longer exists.", "enrollment_id");
    if (f.type === "experience" && en.type === "paid") {
      return no("Experience letters are for internships only (free or stipend), not for paid training.", "enrollment_id");
    }
    if (f.type === "certificate") {
      const eligible = !!(statRes.data as { eligible: boolean } | null)?.eligible;
      if (en.status !== "completed" || !eligible) {
        if (!ctx.isOwner) {
          return no(
            en.status !== "completed"
              ? "The enrolment is not completed yet. Mark it completed first, or ask an owner to issue it early with a reason."
              : "This student is below the attendance or task minimums. Only an owner can issue the certificate, with a reason.",
          );
        }
        if (!f.issueNote) return no("Give the reason for issuing early or below the minimums", "issue_note");
      }
    }
  }
  return null;
}

/** Inserts a new draft, or updates draft `draftId`, with a fresh snapshot. */
export async function saveDraft(ctx: IssueCtx, f: DraftFields, draftId?: string | null): Promise<Outcome<{ id: string }>> {
  const signatory = await resolveSignatory(ctx.supabase, ctx.userId, f.signatoryId);
  if (f.signatoryId && signatory?.id !== f.signatoryId) {
    return no(ctx.isOwner ? "This signatory is not active any more." : "You can only sign as yourself.", "signatory_id");
  }
  const standalone = STANDALONE_DOC_TYPES.includes(f.type);
  const enrollmentId = allowsEnrolment(f.type) ? f.enrollmentId : null;
  const projectId = PROJECT_REQUIRED.includes(f.type) || PROJECT_OPTIONAL.includes(f.type) ? f.projectId : null;
  const snap = await buildSnapshot(ctx.supabase, f.type, f.studentId, enrollmentId, {
    projectId,
    body: BODY_TYPES.includes(f.type) ? f.body : null,
    eventTitle: standalone || f.type === "custom_certificate" ? f.eventTitle : null,
    eventDates: standalone ? f.eventDates : null,
    signatory,
  });
  if (!snap.ok) return no(snap.message);

  const row = {
    type: f.type,
    template_id: snap.templateId,
    student_id: f.studentId,
    enrollment_id: enrollmentId,
    project_id: projectId,
    data: snap.data,
    issue_note: f.issueNote,
    event: standalone ? { title: f.eventTitle, dates: f.eventDates } : null,
    signatory_id: signatory?.id ?? null,
  };
  if (draftId) {
    const { data, error } = await ctx.supabase.from("documents").update(row).eq("id", draftId).eq("status", "draft").select("id");
    if (error) return { ok: false, result: fromDb(error) };
    if (!data?.length) return no("This draft was issued or deleted. Close the panel and check the list.");
    return { ok: true, id: draftId };
  }
  const { data, error } = await ctx.supabase
    .from("documents")
    .insert({ ...row, supersedes_id: f.supersedesId ?? null, version: f.version ?? 1 })
    .select("id")
    .single();
  if (error || !data) return { ok: false, result: fromDb(error) };
  return { ok: true, id: (data as { id: string }).id };
}

type DraftRow = {
  id: string;
  type: DocType;
  status: string;
  student_id: string;
  enrollment_id: string | null;
  project_id: string | null;
  issue_note: string | null;
  event: { title?: string | null; dates?: string | null } | null;
  data: Partial<DocData> | null;
  signatory_id: string | null;
};

/** The fields a stored draft was made with (to re-check and re-snapshot it). */
export function draftFields(d: DraftRow): DraftFields {
  return {
    type: d.type,
    studentId: d.student_id,
    enrollmentId: d.enrollment_id,
    projectId: d.project_id,
    body: d.data?.body ?? null,
    eventTitle: d.event?.title ?? d.data?.event_title ?? null,
    eventDates: d.event?.dates ?? d.data?.event_dates ?? null,
    issueNote: d.issue_note,
    signatoryId: d.signatory_id,
  };
}

export const DRAFT_FIELDS = "id, type, status, student_id, enrollment_id, project_id, issue_note, event, data, signatory_id";

/** Re-checks the rules, refreshes the snapshot (today's date, the signer), then issues: number, token, hash. */
export async function issueDraft(ctx: IssueCtx, id: string): Promise<Outcome<{ number: string }>> {
  const { data } = await ctx.supabase.from("documents").select(DRAFT_FIELDS).eq("id", id).maybeSingle();
  const draft = data as unknown as DraftRow | null;
  if (!draft) return no("This document no longer exists.");
  if (draft.status !== "draft") return no("This document is already issued.");
  const f = draftFields(draft);

  const problem = await checkRules(ctx, f);
  if (problem) return problem;
  const signatory = await resolveSignatory(ctx.supabase, ctx.userId, f.signatoryId);
  if (!signatory) return no(f.signatoryId ? "The chosen signatory is not active any more." : NO_SIGNATURE);
  if (signatory.profile_id !== ctx.userId && !ctx.isOwner) return no("You can only sign as yourself.");

  const saved = await saveDraft(ctx, { ...f, signatoryId: signatory.id }, id);
  if (!saved.ok) return saved;
  const { data: fresh } = await ctx.supabase.from("documents").select("data").eq("id", id).maybeSingle();
  const frozen = (fresh as { data: DocData } | null)?.data;
  if (!frozen) return no("This document no longer exists.");

  const { data: res, error } = await ctx.supabase.rpc("issue_document", {
    p_document: id,
    p_content_hash: contentHash(frozen),
    p_signatory: signatory.id,
  });
  if (error) return { ok: false, result: fromDb(error) };
  return { ok: true, number: (res as { number: string } | null)?.number ?? "Document" };
}
