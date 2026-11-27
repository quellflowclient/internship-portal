"use server";

/**
 * Settings (docs/19 §7 "Settings"). Organisation, rules and users are owner-only (RLS: org_settings and
 * role changes are owner-write); course plan fees can be changed by any admin (RLS: course_plans admin update).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin, assertOwner } from "@/server/guard";
import { done, fail, fromDb, fromZod, type ActionResult } from "@/server/result";
import { emailSchema, formToObject, optionalEmail, optionalText, optionalUrl, requiredText, uuid } from "@/lib/validators";
import { toE164India } from "@/lib/phone";

const PATH = "/admin/settings";

/* ---------- Organisation ---------- */
const orgSchema = z.object({
  org_name: requiredText(200, "Legal name"),
  website: optionalUrl,
  contact_email: optionalEmail,
  support_whatsapp: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const e = toE164India(v);
      if (!e) {
        ctx.addIssue({ code: "custom", message: "Enter a 10-digit Indian mobile number" });
        return z.NEVER;
      }
      return e;
    })
    .nullish(),
  verify_base_url: optionalUrl,
  address: optionalText(500),
});

export async function updateOrg(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertOwner();
  const parsed = orgSchema.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  const { data, error } = await supabase
    .from("org_settings")
    .update({
      org_name: v.org_name,
      website: v.website ?? null,
      contact_email: v.contact_email ?? null,
      support_whatsapp: v.support_whatsapp ?? null,
      verify_base_url: v.verify_base_url ? v.verify_base_url.replace(/\/+$/, "") : null,
      address: v.address ?? null,
    })
    .eq("id", 1)
    .select("id");
  if (error) return fromDb(error);
  if (!data?.length) return fail("You don’t have permission to do this.");
  revalidatePath(PATH);
  return done("Organisation details saved");
}

/* ---------- Local files and rules ---------- */
const pct = (label: string) =>
  z.coerce.number({ message: `${label} must be a number` }).int(`${label} must be a whole number`).min(0, `${label} must be 0 to 100`).max(100, `${label} must be 0 to 100`);

const rulesSchema = z.object({
  local_files_root: requiredText(300, "Root folder"),
  min_attendance_pct: pct("Minimum attendance"),
  min_task_pct: pct("Minimum tasks done"),
  stipend_pay_by_day: z.coerce
    .number({ message: "Pay-by day must be a number" })
    .int("Pay-by day must be a whole number")
    .min(1, "Pay-by day must be 1 to 28")
    .max(28, "Pay-by day must be 1 to 28"),
  holidays: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      const parts = (raw ?? "")
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const bad = parts.filter((p) => !isRealDate(p));
      if (bad.length) {
        ctx.addIssue({ code: "custom", message: `Use YYYY-MM-DD dates. Not valid: ${bad.slice(0, 3).join(", ")}` });
        return z.NEVER;
      }
      return [...new Set(parts)].sort();
    }),
});

function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export async function updateRules(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertOwner();
  const parsed = rulesSchema.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  const { data, error } = await supabase
    .from("org_settings")
    .update({
      local_files_root: v.local_files_root,
      min_attendance_pct: v.min_attendance_pct,
      min_task_pct: v.min_task_pct,
      stipend_pay_by_day: v.stipend_pay_by_day,
      holidays: v.holidays,
    })
    .eq("id", 1)
    .select("id");
  if (error) return fromDb(error);
  if (!data?.length) return fail("You don’t have permission to do this.");
  revalidatePath(PATH);
  revalidatePath("/admin", "layout");
  return done("Files and rules saved");
}

/* ---------- Course plans ---------- */
const planSchema = z.object({
  id: uuid,
  fee_inr: z.string().trim().min(1, "Enter the fee in rupees").transform(Number).pipe(z.number({ message: "Enter the fee in rupees" }).int("Whole rupees only").min(0, "Fee cannot be negative").max(10_000_000, "Fee is too high")),
  active: z.string().optional().transform((v) => v === "on"),
});

export async function updateCoursePlan(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const parsed = planSchema.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const { id, fee_inr, active } = parsed.data;
  const { data, error } = await supabase.from("course_plans").update({ fee_inr, active }).eq("id", id).select("id");
  if (error) return fromDb(error);
  if (!data?.length) return fail("This course plan was not found.");
  revalidatePath(PATH);
  return done("Course plan saved");
}

/* ---------- Users ---------- */
const inviteSchema = z.object({ email: emailSchema });

export async function inviteAdmin(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase, profile } = await assertOwner();
  const parsed = inviteSchema.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const { email } = parsed.data;

  const { data: existing } = await supabase.from("profiles").select("id, role").eq("email", email).maybeSingle<{ id: string; role: string }>();
  if (existing) {
    return fail("This person already has an account. Open them in the list and change their role instead.", {
      email: "Already has an account",
    });
  }

  const { error } = await supabase.from("invitations").insert({ email, role: "admin", invited_by: profile.id });
  if (error) {
    if (error.code === "23505") return fail("There is already a pending invitation for this email.", { email: "Already invited" });
    return fromDb(error);
  }
  revalidatePath(PATH);
  return done(`Invitation saved. ${email} becomes an admin on first sign-in.`, { redirectTo: `${PATH}?sec=users` });
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  const { supabase } = await assertOwner();
  if (!uuid.safeParse(id).success) return fail("This invitation was not found.");
  const { data, error } = await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id");
  if (error) return fromDb(error);
  if (!data?.length) return fail("This invitation was already used or cancelled.");
  revalidatePath(PATH);
  return done("Invitation cancelled");
}

const roleSchema = z.object({
  profile_id: uuid,
  role: z.enum(["admin", "student"], { message: "Choose a role" }),
  active: z.string().optional().transform((v) => v === "on"),
  owner: z.string().optional().transform((v) => v === "on"),
});

export async function setUserRole(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase, profile } = await assertOwner();
  const parsed = roleSchema.safeParse(formToObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  if (v.profile_id === profile.id) return fail("You cannot change your own role, owner flag or access.");
  if (v.owner && v.role !== "admin") return fail("Only an admin can be an owner.", { owner: "Choose Admin to make this person an owner" });

  const { error } = await supabase.rpc("admin_set_user_role", {
    p_profile: v.profile_id,
    p_role: v.role,
    p_active: v.active,
    p_owner: v.owner,
  });
  if (error) {
    if (/own role/i.test(error.message)) return fail("You cannot change your own role, owner flag or access.");
    if (/owner accounts/i.test(error.message)) return fail("Only an owner can change an owner account.");
    if (/not found/i.test(error.message)) return fail("This account was not found.");
    return fromDb(error);
  }
  revalidatePath(PATH);
  return done("Access updated");
}
