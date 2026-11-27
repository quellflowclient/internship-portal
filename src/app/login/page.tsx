import type { Metadata } from "next";
import { AuthFrame } from "./auth-frame";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <AuthFrame>
      <div>
        <h1 className="text-xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-fg-2">Use the Google account or email your Quellflow invite was sent to.</p>
      </div>
      <LoginForm next={next && next.startsWith("/") ? next : "/"} initialError={error} />
      <p className="text-xs text-fg-3">Access is by invitation only.</p>
    </AuthFrame>
  );
}
