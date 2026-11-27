import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

export interface SessionInfo {
  userId: string;
  email: string;
  profile: Profile | null;
}

/** Current user + profile (RLS: users can always read their own profile). Cached per request. */
export const getSession = cache(async (): Promise<SessionInfo | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, is_owner, is_active, full_name, email, phone, created_at")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  return { userId: user.id, email: user.email ?? "", profile: profile ?? null };
});

export function homeFor(role: UserRole): string {
  return role === "admin" ? "/admin" : "/student";
}

/** Server-side guard. Redirects to /login, /no-access or the user's own area. */
export async function requireRole(roles: UserRole[]): Promise<SessionInfo & { profile: Profile }> {
  const session = await getSession();
  if (!session) redirect("/login");
  const { profile } = session;
  if (!profile || !profile.is_active) redirect("/no-access");
  if (!roles.includes(profile.role)) redirect(homeFor(profile.role));
  return { ...session, profile };
}
