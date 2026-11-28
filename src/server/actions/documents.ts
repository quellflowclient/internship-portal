"use server";

/**
 * Documents (docs/19 §7 rows Documents and Document panel, P6; docs/20 §4, §5) and Batch → Close (certificates).
 * Issued only here. A document starts as a draft with a frozen snapshot; issue_document() gives it the number,
 * token, hash and signatory. Revoke is owner-only with Undo (restore within 2 minutes, enforced by guard_documents).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin, assertOwner } from "@/server/guard";
import { done, fail, fromDb, fromZod, type ActionResult } from "@/server/result";
import { formToObject, optionalText, requiredText, uuid } from "@/lib/validators";
import type { DocType } from "@/lib/types";
import { DOC_TYPES } from "@/server/documents/rules";
import { checkRules, draftFields, DRAFT_FIELDS, issueDraft, saveDraft, type DraftFields, type IssueCtx } from "@/server/documents/issue";

const DOCS = "/admin/documents";

function refresh() {
  revalidatePath(DOCS);
  revalidatePath("/admin");
  revalidatePath("/admin/students/[code]", "page");
  revalidatePath("/admin/batches/[code]", "layout");
}

async function ctxAdmin(): Promise<IssueCtx> {
  const { supabase, profile } = await assertAdmin();
  return { supabase, userId: profile.id, isOwner: profile.is_owner };
}

const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(uuid.nullable())
  .nullish()
  .transform((v) => v ?? null);

const text = (max: number) => optionalText(max).transform((v) => v ?? null);

/* =====================================================================
 * Issue panel → Preview PDF (saves the draft) / Issue
 * ===================================================================== */
const IssueForm = z.object({
  intent: z.enum(["issue", "preview"]).catch("issue"),
  draft_id: optionalId,
  type: z.enum(DOC_TYPES as [DocType, ...DocType[]], { error: "Pick the document" }),
  student_id: z.string().trim().min(1, "Pick a student").pipe(z.uuid("Pick a student")),
  enrollment_id: optionalId,
  project_id: optionalId,
  body: text(5000),
  event_title: text(200),
  event_dates: text(200),
  issue_note: text(300),
  signatory_id: optionalId,
});

export async function issueFromForm(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await ctxAdmin();
  const parsed = IssueForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  const f: DraftFields = {
    type: v.type,
    studentId: v.student_id,
    enrollmentId: v.enrollment_id,
    projectId: v.project_id,
    body: v.body,
    eventTitle: v.event_title,
    eventDates: v.event_dates,
    issueNote: v.issue_note,
    signatoryId: v.signatory_id,
  };

  // Check before anything is written, so a failed Issue does not leave stray drafts behind.
  if (v.intent === "issue") {
    const problem = await checkRules(ctx, f);
    if (problem) return problem.result;
  }
  const saved = await saveDraft(ctx, f, v.draft_id);
  if (!saved.ok) return saved.result;
  refresh();
  if (v.intent === "preview") {
    return done("Draft saved. Open the preview below.", { redirectTo: `${DOCS}?new=1&draft=${saved.id}&preview=1` });
  }

  const issued = await issueDraft(ctx, saved.id);
  if (!issued.ok) {
    if (!v.draft_id && ctx.isOwner) await ctx.supabase.from("documents").delete().eq("id", saved.id).eq("status", "draft");
    const msg = issued.result && !issued.result.ok ? issued.result.message : "The document could not be issued.";
    return fail(!v.draft_id && !ctx.isOwner ? `${msg} It is kept as a draft in the list.` : msg);
  }
  refresh();
  return done(`${issued.number} issued`, { redirectTo: `${DOCS}?open=${saved.id}` });
}

/** Document panel (draft) → Issue. */
export async function issueDraftAction(id: string): Promise<ActionResult> {
  const ctx = await ctxAdmin();
  if (!uuid.safeParse(id).success) return fail("This document no longer exists.");
  const issued = await issueDraft(ctx, id);
  if (!issued.ok) return issued.result;
  refresh();
  return done(`${issued.number} issued`, { redirectTo: `${DOCS}?open=${id}` });
}

/** Document panel (draft) → Delete draft. Owners only; issued documents are never deleted. */
export async function deleteDraft(id: string): Promise<ActionResult> {
  const { supabase } = await assertOwner();
  if (!uuid.safeParse(id).success) return fail("This draft no longer exists.");
  const { data, error } = await supabase.from("documents").delete().eq("id", id).eq("status", "draft").select("id");
  if (error) return fromDb(error);
  if (!data?.length) return fail("Only drafts can be deleted. Revoke an issued document instead.");
  refresh();
  return done("Draft deleted", { redirectTo: DOCS });
}

/** Document panel → Issue new version: a draft copy that supersedes this one when issued. */
export async function newVersion(id: string): Promise<ActionResult> {
  const ctx = await ctxAdmin();
  if (!uuid.safeParse(id).success) return fail("This document no longer exists.");
  const { data } = await ctx.supabase.from("documents").select(`${DRAFT_FIELDS}, version`).eq("id", id).maybeSingle();
  const old = data as unknown as (Parameters<typeof draftFields>[0] & { version: number }) | null;
  if (!old) return fail("This document no longer exists.");
  if (old.status === "draft") return done("This is still a draft. Edit it instead.", { redirectTo: `${DOCS}?new=1&draft=${id}` });
  if (old.status === "superseded") return fail("A newer version already exists. Open that one instead.");

  const { data: existing } = await ctx.supabase
    .from("documents")
    .select("id")
    .eq("supersedes_id", id)
    .eq("status", "draft")
    .limit(1);
  const ex = ((existing ?? []) as { id: string }[])[0];
  if (ex) return done("A draft of the new version already exists", { redirectTo: `${DOCS}?new=1&draft=${ex.id}` });

  const saved = await saveDraft(ctx, { ...draftFields(old), signatoryId: null, supersedesId: id, version: old.version + 1 });
  if (!saved.ok) return saved.result;
  refresh();
  return done("New version drafted. Check it, then issue.", { redirectTo: `${DOCS}?new=1&draft=${saved.id}` });
}

/* =====================================================================
 * Document panel → "I saved the PDF" / "Shared via"
 * ===================================================================== */
const SavedForm = z.object({ id: uuid, saved: z.enum(["0", "1"]) });

export async function markPdfSaved(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = SavedForm.safeParse(formToObject(fd));
  if (!parsed.success) return fail("Something went wrong. Reload and try again.");
  const saved = parsed.data.saved === "1";
  const { data, error } = await supabase
    .from("documents")
    .update({ pdf_saved: saved })
    .eq("id", parsed.data.id)
    .neq("status", "draft")
    .select("id");
  if (error) return fromDb(error);
  if (!data?.length) return fail("Issue the document first.");
  refresh();
  return done(saved ? "PDF marked as saved" : "PDF marked as not saved");
}

const SharedForm = z.object({ id: uuid, via: z.enum(["", "whatsapp", "email", "in_person"]) });

export async function markShared(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = SharedForm.safeParse(formToObject(fd));
  if (!parsed.success) return fail("Pick how it was shared.");
  const via = parsed.data.via || null;
  const { data, error } = await supabase
    .from("documents")
    .update({ shared_via: via, shared_at: via ? new Date().toISOString() : null })
    .eq("id", parsed.data.id)
    .neq("status", "draft")
    .select("id");
  if (error) return fromDb(error);
  if (!data?.length) return fail("Issue the document first.");
  refresh();
  return done(via ? "Sharing saved" : "Sharing cleared");
}

/* =====================================================================
 * Document panel → Revoke (owner, reason) + Undo within 2 minutes
 * ===================================================================== */
const RevokeForm = z.object({ id: uuid, revoked_reason: requiredText(300, "Reason") });

export async function revokeDocument(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertOwner();
  const parsed = RevokeForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const { id, revoked_reason } = parsed.data;
  const { data, error } = await supabase
    .from("documents")
    .update({ status: "revoked", revoked_reason })
    .eq("id", id)
    .in("status", ["issued", "accepted"])
    .select("number");
  if (error) return fromDb(error);
  const row = (data as { number: string | null }[] | null)?.[0];
  if (!row) return fail("Only issued or accepted documents can be revoked.");
  refresh();
  return done(`${row.number ?? "Document"} revoked. The verify page now shows it as revoked.`, { undoId: id });
}

export async function restoreDocument(id: string): Promise<ActionResult> {
  const { supabase } = await assertOwner();
  if (!uuid.safeParse(id).success) return fail("This document no longer exists.");
  const [{ data }, { count }] = await Promise.all([
    supabase.from("documents").select("status").eq("id", id).maybeSingle(),
    supabase.from("document_acceptances").select("id", { count: "exact", head: true }).eq("document_id", id),
  ]);
  const doc = data as { status: string } | null;
  if (!doc) return fail("This document no longer exists.");
  if (doc.status !== "revoked") return done("The document is not revoked");
  const { error } = await supabase
    .from("documents")
    .update({ status: (count ?? 0) > 0 ? "accepted" : "issued" })
    .eq("id", id)
    .eq("status", "revoked");
  if (error) {
    if (/cannot go from/i.test(error.message ?? "")) return fail("Undo is possible only within 2 minutes. Issue a new version instead.");
    return fromDb(error);
  }
  refresh();
  return done("Document restored");
}

/* =====================================================================
 * Batch → Close: mark an enrolment completed, issue every eligible certificate
 * ===================================================================== */
const CompleteForm = z.object({
  enrollment_id: uuid,
  result_note: requiredText(200, "Result"),
  change_reason: text(300),
});

export async function markCompleted(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = CompleteForm.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  const { data: row } = await supabase.from("enrollments").select("status, end_date").eq("id", v.enrollment_id).maybeSingle();
  const en = row as { status: string; end_date: string } | null;
  if (!en) return fail("This enrolment no longer exists.");
  if (!["active", "completed"].includes(en.status)) return fail("Only active enrolments can be marked completed.");
  const early = en.end_date > new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  if (early && en.status !== "completed" && !v.change_reason) {
    const m = "Give the reason for completing before the end date";
    return fail(m, { change_reason: m });
  }
  const { error } = await supabase
    .from("enrollments")
    .update({
      status: "completed",
      result_note: v.result_note,
      change_reason: v.change_reason ?? (early ? null : "Completed at batch close"),
    })
    .eq("id", v.enrollment_id);
  if (error) return fromDb(error);
  refresh();
  return done(en.status === "completed" ? "Result saved" : "Marked completed");
}

/** Owner: one certificate per completed, eligible enrolment of the batch that has none yet. Each stays individual. */
export async function issueAllEligible(batchId: string): Promise<ActionResult> {
  const { supabase, profile } = await assertOwner();
  if (!uuid.safeParse(batchId).success) return fail("This batch no longer exists.");
  const ctx: IssueCtx = { supabase, userId: profile.id, isOwner: true };

  const { data: enrolRows, error } = await supabase
    .from("enrollments")
    .select("id, student_id")
    .eq("batch_id", batchId)
    .eq("status", "completed");
  if (error) return fromDb(error);
  const enrols = (enrolRows ?? []) as { id: string; student_id: string }[];
  if (!enrols.length) return done("No completed enrolments yet. Mark students completed first.");
  const ids = enrols.map((e) => e.id);
  const [statsRes, docsRes] = await Promise.all([
    supabase.from("v_enrollment_stats").select("enrollment_id, eligible").in("enrollment_id", ids),
    supabase.from("documents").select("id, enrollment_id, status").eq("type", "certificate").in("enrollment_id", ids),
  ]);
  const eligible = new Set(((statsRes.data ?? []) as { enrollment_id: string; eligible: boolean }[]).filter((s) => s.eligible).map((s) => s.enrollment_id));
  const docs = (docsRes.data ?? []) as { id: string; enrollment_id: string; status: string }[];
  const has = new Set(docs.filter((d) => ["issued", "accepted"].includes(d.status)).map((d) => d.enrollment_id));
  const drafts = new Map(docs.filter((d) => d.status === "draft").map((d) => [d.enrollment_id, d.id]));

  const todo = enrols.filter((e) => eligible.has(e.id) && !has.has(e.id));
  if (!todo.length) return done("Nothing to issue. Every eligible student already has a certificate.");

  let issued = 0;
  let firstError = "";
  for (const e of todo) {
    let id = drafts.get(e.id);
    const created = !id;
    if (!id) {
      const saved = await saveDraft(ctx, {
        type: "certificate",
        studentId: e.student_id,
        enrollmentId: e.id,
        projectId: null,
        body: null,
        eventTitle: null,
        eventDates: null,
        issueNote: null,
        signatoryId: null,
      });
      if (!saved.ok) {
        firstError ||= saved.result && !saved.result.ok ? saved.result.message : "";
        continue;
      }
      id = saved.id;
    }
    const r = await issueDraft(ctx, id);
    if (r.ok) issued++;
    else {
      firstError ||= r.result && !r.result.ok ? r.result.message : "";
      if (created) await supabase.from("documents").delete().eq("id", id).eq("status", "draft");
      // Missing signature or numbering: the same error would repeat for everyone.
      if (issued === 0) break;
    }
  }
  refresh();
  if (!issued) return fail(firstError || "No certificate could be issued.");
  const left = todo.length - issued;
  return done(
    `${issued} ${issued === 1 ? "certificate" : "certificates"} issued${left ? `, ${left} not issued: ${firstError}` : ""}`,
  );
}
