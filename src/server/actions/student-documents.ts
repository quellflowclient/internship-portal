"use server";

/**
 * Student accepts an issued offer / T&C / consent (docs/19 §8 P6 step 3).
 * accept_document() re-checks ownership, type, status and the typed name, and stores
 * the typed name, agreement text, IP, user agent and the document's content hash.
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { assertStudent } from "@/server/guard";
import { done, fail, fromDb, type ActionResult } from "@/server/result";
import { uuid } from "@/lib/validators";
import { ACCEPT_CHECKBOX_TEXT } from "@/app/student/documents/_parts/shared";

const NAME_ERROR = /Type your name exactly as it appears on the document: (.+)$/;

export async function acceptDocument(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await assertStudent();
  const id = uuid.safeParse(String(formData.get("id") ?? ""));
  if (!id.success) return fail("This document was not found.");

  const typedName = String(formData.get("typed_name") ?? "").trim().slice(0, 200);
  const fieldErrors: Record<string, string> = {};
  if (formData.get("agree") !== "1") fieldErrors.agree = "Tick the box to agree to this document.";
  if (!typedName) fieldErrors.typed_name = "Type your full name to sign.";
  if (Object.keys(fieldErrors).length) return fail("Please fix the highlighted fields.", fieldErrors);

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
  const userAgent = h.get("user-agent")?.slice(0, 300) || null;

  const { error } = await supabase.rpc("accept_document", {
    p_document: id.data,
    p_typed_name: typedName,
    p_checkbox_text: ACCEPT_CHECKBOX_TEXT,
    p_ip: ip,
    p_user_agent: userAgent,
  });
  if (error) {
    const m = NAME_ERROR.exec(error.message ?? "");
    if (m) return fail("Please fix the highlighted fields.", { typed_name: `Type your name exactly as it appears on the document: ${m[1]}` });
    return fromDb(error);
  }

  revalidatePath("/student/documents");
  revalidatePath("/student", "layout"); // Home "To do" and the Documents tab badge
  return done("Signed. Thank you.", { redirectTo: "/student/documents" });
}
