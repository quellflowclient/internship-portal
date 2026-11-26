"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Input, Notice } from "@/components/ui";

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(initialError ? "Sign-in failed. Please try again." : "");

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function google() {
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  async function emailLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo() },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="space-y-5">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="button" variant="secondary" className="w-full" onClick={google} disabled={busy}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
        </svg>
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-xs text-slate">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      {sent ? (
        <Notice tone="success">Check your inbox – we sent a sign-in link to {email}.</Notice>
      ) : (
        <form onSubmit={emailLink} className="space-y-3">
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Button type="submit" className="w-full" disabled={busy || !email}>
            Email me a sign-in link
          </Button>
        </form>
      )}
    </div>
  );
}
