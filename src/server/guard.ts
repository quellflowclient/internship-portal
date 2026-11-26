import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Server-action guard (defence in depth – RLS enforces the same rules). */
export async function assertAdmin() {
  const s = await getSession();
  if (!s?.profile?.is_active || !["admin", "super_admin"].includes(s.profile.role)) redirect("/no-access");
  return { session: s, profile: s.profile, supabase: await createClient() };
}

export async function assertSuperAdmin() {
  const ctx = await assertAdmin();
  if (ctx.profile.role !== "super_admin") back("/admin/settings", { error: "Only a super admin can change this." });
  return ctx;
}

/** Redirect back with a flash message in the query string. */
export function back(path: string, msg: { ok?: string; error?: string }): never {
  const u = new URL(path, "http://x");
  if (msg.ok) u.searchParams.set("ok", msg.ok);
  if (msg.error) u.searchParams.set("error", msg.error);
  redirect(u.pathname + u.search);
}
