"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, assertSuperAdmin, back } from "@/server/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applicantUpdateSchema,
  batchMentorSchema,
  batchSchema,
  convertSchema,
  firstError,
  formToObject,
  invitationSchema,
  numberingSchema,
  orgSettingsSchema,
  programSchema,
  setRoleSchema,
  signatorySchema,
} from "@/lib/validators";

// ---------------------------------------------------------------- Applicants
export async function updateApplicant(fd: FormData) {
  const { supabase } = await assertAdmin();
  const parsed = applicantUpdateSchema.safeParse(formToObject(fd));
  const path = `/admin/applicants/${fd.get("id")}`;
  if (!parsed.success) back(path, { error: firstError(parsed.error) });
  const { id, status, notes } = parsed.data;
  const { error } = await supabase.from("applicants").update({ status, notes }).eq("id", id);
  if (error) back(path, { error: error.message });
  revalidatePath("/admin/applicants");
  back(path, { ok: "Applicant updated" });
}

/**
 * Applicant -> enrolment (status invited) + admin-only money terms + invitation.
 * If the person already has a profile (signed in before), link and activate it.
 */
export async function convertApplicant(fd: FormData) {
  const { supabase, profile: me } = await assertAdmin();
  const raw = formToObject(fd);
  const path = `/admin/applicants/${raw.applicant_id}`;
  const parsed = convertSchema.safeParse(raw);
  if (!parsed.success) back(path, { error: firstError(parsed.error) });
  const v = parsed.data;

  const { data: applicant } = await supabase
    .from("applicants")
    .select("id, email, status, profile_id")
    .eq("id", v.applicant_id)
    .single();
  if (!applicant) back(path, { error: "Applicant not found" });

  const { data: batch } = await supabase
    .from("batches")
    .select("id, program_id, start_date, end_date")
    .eq("id", v.batch_id)
    .single();
  if (!batch) back(path, { error: "Batch not found" });

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("email", applicant.email.toLowerCase())
    .maybeSingle();

  if (existing && existing.role !== "student") {
    back(path, { error: `This email already belongs to a ${existing.role} account.` });
  }

  const { data: enrol, error: enErr } = await supabase
    .from("enrollments")
    .insert({
      applicant_id: applicant.id,
      profile_id: existing?.id ?? null,
      batch_id: batch.id,
      program_id: batch.program_id,
      mentor_id: v.mentor_id,
      start_date: batch.start_date,
      end_date: batch.end_date,
      weekly_hours: v.weekly_hours,
      status: "invited",
    })
    .select("id")
    .single();
  if (enErr || !enrol) back(path, { error: enErr?.message ?? "Could not create enrolment" });

  const { error: tErr } = await supabase.from("enrollment_terms").insert({
    enrollment_id: enrol.id,
    engagement_type: v.engagement_type,
    stipend_amount_inr: v.engagement_type === "stipend" ? v.stipend_amount_inr : null,
    stipend_frequency: v.engagement_type === "stipend" ? v.stipend_frequency : null,
    fee_amount_inr: v.fee_amount_inr ?? null,
  });
  if (tErr) {
    await supabase.from("enrollments").delete().eq("id", enrol.id);
    back(path, { error: tErr.message });
  }

  if (existing) {
    if (!existing.is_active) {
      const { error } = await supabase.rpc("admin_set_user_role", { p_profile: existing.id, p_role: "student", p_active: true });
      if (error) back(path, { error: error.message });
    }
    await supabase.from("applicants").update({ profile_id: existing.id }).eq("id", applicant.id);
  } else {
    const { error } = await supabase
      .from("invitations")
      .insert({ email: applicant.email.toLowerCase(), role: "student", applicant_id: applicant.id, invited_by: me.id });
    if (error && !error.message.includes("invitations_pending_email_uq")) back(path, { error: error.message });
  }

  await supabase.from("applicants").update({ status: "converted" }).eq("id", applicant.id);
  revalidatePath("/admin/applicants");
  back(path, {
    ok: existing
      ? "Enrolment created and account activated."
      : "Enrolment created. The candidate gets access when they sign in with this email.",
  });
}

// ---------------------------------------------------------------- Users & invitations
export async function createInvitation(fd: FormData) {
  const { supabase, profile: me } = await assertAdmin();
  const parsed = invitationSchema.safeParse(formToObject(fd));
  if (!parsed.success) back("/admin/users", { error: firstError(parsed.error) });
  const { email, role } = parsed.data;
  if (role === "super_admin" && me.role !== "super_admin") back("/admin/users", { error: "Only a super admin can invite a super admin." });

  const { data: existing } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) {
    const { error } = await supabase.rpc("admin_set_user_role", { p_profile: existing.id, p_role: role, p_active: true });
    if (error) back("/admin/users", { error: error.message });
    revalidatePath("/admin/users");
    back("/admin/users", { ok: `${email} already had an account – activated as ${role}.` });
  }

  const { error } = await supabase.from("invitations").insert({ email, role, invited_by: me.id });
  if (error) back("/admin/users", { error: error.message.includes("invitations_pending_email_uq") ? "An invitation for this email is already pending." : error.message });

  if (fd.get("send_email") === "on") {
    try {
      const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
      await createAdminClient().auth.admin.inviteUserByEmail(email, { redirectTo: `${site}/auth/callback` });
    } catch {
      revalidatePath("/admin/users");
      back("/admin/users", { ok: `Invitation saved for ${email}, but the email could not be sent (email provider not configured yet).` });
    }
  }
  revalidatePath("/admin/users");
  back("/admin/users", { ok: `Invitation saved for ${email}. They get access on first sign-in.` });
}

export async function revokeInvitation(fd: FormData) {
  const { supabase } = await assertAdmin();
  const id = String(fd.get("id") ?? "");
  const { error } = await supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  if (error) back("/admin/users", { error: error.message });
  revalidatePath("/admin/users");
  back("/admin/users", { ok: "Invitation revoked" });
}

export async function setUserRole(fd: FormData) {
  const { supabase } = await assertAdmin();
  const parsed = setRoleSchema.safeParse(formToObject(fd));
  if (!parsed.success) back("/admin/users", { error: firstError(parsed.error) });
  const { profile_id, role, is_active } = parsed.data;
  const { error } = await supabase.rpc("admin_set_user_role", { p_profile: profile_id, p_role: role, p_active: is_active });
  if (error) back("/admin/users", { error: error.message });
  revalidatePath("/admin/users");
  back("/admin/users", { ok: "User updated" });
}

// ---------------------------------------------------------------- Programs & batches
export async function createProgram(fd: FormData) {
  const { supabase } = await assertAdmin();
  const parsed = programSchema.safeParse(formToObject(fd));
  if (!parsed.success) back("/admin/programs", { error: firstError(parsed.error) });
  const { default_fee_inr, ...program } = parsed.data;
  const { data, error } = await supabase.from("programs").insert(program).select("id").single();
  if (error || !data) back("/admin/programs", { error: error?.message.includes("duplicate") ? "This track/role/duration already exists." : error?.message ?? "Failed" });
  const { error: pErr } = await supabase.from("program_pricing").insert({ program_id: data.id, default_fee_inr: default_fee_inr ?? null });
  if (pErr) back("/admin/programs", { error: pErr.message });
  revalidatePath("/admin/programs");
  back("/admin/programs", { ok: "Program created" });
}

export async function createBatch(fd: FormData) {
  const { supabase } = await assertAdmin();
  const parsed = batchSchema.safeParse(formToObject(fd));
  if (!parsed.success) back("/admin/programs", { error: firstError(parsed.error) });
  const { error } = await supabase.from("batches").insert(parsed.data);
  if (error) back("/admin/programs", { error: error.message.includes("duplicate") ? "Batch code already used." : error.message });
  revalidatePath("/admin/programs");
  back("/admin/programs", { ok: "Batch created" });
}

export async function addBatchMentor(fd: FormData) {
  const { supabase } = await assertAdmin();
  const parsed = batchMentorSchema.safeParse(formToObject(fd));
  if (!parsed.success) back("/admin/programs", { error: firstError(parsed.error) });
  const { error } = await supabase.from("batch_mentors").upsert(parsed.data);
  if (error) back("/admin/programs", { error: error.message });
  revalidatePath("/admin/programs");
  back("/admin/programs", { ok: "Mentor assigned" });
}

// ---------------------------------------------------------------- Settings (super_admin)
export async function updateOrgSettings(fd: FormData) {
  const { supabase, profile } = await assertSuperAdmin();
  const parsed = orgSettingsSchema.safeParse(formToObject(fd));
  if (!parsed.success) back("/admin/settings", { error: firstError(parsed.error) });
  const { error } = await supabase.from("org_settings").update({ ...parsed.data, updated_by: profile.id }).eq("id", 1);
  if (error) back("/admin/settings", { error: error.message });
  revalidatePath("/admin/settings");
  back("/admin/settings", { ok: "Settings saved" });
}

export async function updateNumberingScheme(fd: FormData) {
  const { supabase, profile } = await assertSuperAdmin();
  const parsed = numberingSchema.safeParse(formToObject(fd));
  if (!parsed.success) back("/admin/settings", { error: firstError(parsed.error) });
  const { id, pattern, reset_per_academic_year } = parsed.data;
  const { error } = await supabase
    .from("numbering_schemes")
    .update({ pattern, reset_per_academic_year, updated_by: profile.id })
    .eq("id", id);
  if (error) back("/admin/settings", { error: error.message });
  revalidatePath("/admin/settings");
  back("/admin/settings", { ok: "Numbering updated – applies to documents issued from now on" });
}

export async function addSignatory(fd: FormData) {
  const { supabase } = await assertSuperAdmin();
  const parsed = signatorySchema.safeParse(formToObject(fd));
  if (!parsed.success) back("/admin/settings", { error: firstError(parsed.error) });
  const { error } = await supabase.from("signatories").insert(parsed.data);
  if (error) back("/admin/settings", { error: error.message });
  revalidatePath("/admin/settings");
  back("/admin/settings", { ok: "Signatory added (signature image upload comes with documents in Phase 2)" });
}

export async function toggleSignatory(fd: FormData) {
  const { supabase } = await assertSuperAdmin();
  const id = String(fd.get("id") ?? "");
  const active = fd.get("is_active") === "true";
  const { error } = await supabase.from("signatories").update({ is_active: active }).eq("id", id);
  if (error) back("/admin/settings", { error: error.message });
  revalidatePath("/admin/settings");
  back("/admin/settings", { ok: active ? "Signatory activated" : "Signatory deactivated" });
}
