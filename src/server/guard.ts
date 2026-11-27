import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Server-action guard (defence in depth – RLS and the database functions enforce the same rules). */
export async function assertAdmin() {
  const s = await getSession();
  if (!s?.profile?.is_active || s.profile.role !== "admin") redirect("/no-access");
  return { session: s, profile: s.profile, supabase: await createClient() };
}

export async function assertOwner() {
  const ctx = await assertAdmin();
  if (!ctx.profile.is_owner) redirect("/admin?error=owner-only");
  return ctx;
}

export async function assertStudent() {
  const s = await getSession();
  if (!s?.profile?.is_active || s.profile.role !== "student") redirect("/no-access");
  return { session: s, profile: s.profile, supabase: await createClient() };
}
