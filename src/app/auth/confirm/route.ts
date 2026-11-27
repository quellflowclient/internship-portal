import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["recovery", "invite", "email", "signup", "magiclink", "email_change"];

/**
 * Landing page for every link in the auth emails (supabase/templates/*.html):
 *   /auth/confirm?token_hash=…&type=recovery|invite|email|email_change&next=/…
 * Uses verifyOtp with the token hash, so the link works on any device or browser
 * (the older ?code= flow only worked in the browser that asked for the email).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const fallback = type === "recovery" || type === "invite" ? "/account/password" : "/";
  const nextParam = searchParams.get("next") ?? fallback;
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : fallback;

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
