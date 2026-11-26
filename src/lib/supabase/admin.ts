import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Service-role client – BYPASSES RLS. Use only in trusted server code
 * (webhooks, imports, document issuing) after your own authorisation checks.
 */
export function createAdminClient() {
  const pub = publicEnv();
  const srv = serverEnv();
  return createClient(pub.NEXT_PUBLIC_SUPABASE_URL, srv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
