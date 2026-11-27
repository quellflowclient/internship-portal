"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Input, Notice } from "@/components/ui";
import { PASSWORD_MIN, passwordProblem } from "@/lib/password";

type Mode = "signin" | "signup" | "forgot" | "link";

/**
 * Two ways in (both invite-only – access is decided by the invitation, not the method):
 *  - Google
 *  - Email + password (create password, sign in, forgot password) – or a one-time email link
 */
export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState(initialError ? "Sign-in failed. Please try again." : "");

  const callback = (to: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(to)}`;
  const reset = (m: Mode) => {
    setMode(m);
    setError("");
    setInfo("");
    setPassword("");
  };

  async function google() {
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback(next) } });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    const supabase = createClient();
    const addr = email.trim().toLowerCase();

    if (mode === "signup") {
      const problem = passwordProblem(password);
      if (problem) return setError(problem);
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: addr, password });
        if (error) {
          setError(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
          return;
        }
        router.replace(next);
        router.refresh();
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: addr, password, options: { emailRedirectTo: callback(next) } });
        if (error) return setError(error.message);
        if (data.session) {
          router.replace(next);
          router.refresh();
        } else {
          setInfo(`We sent a confirmation link to ${addr}. Open it to finish creating your account.`);
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(addr, { redirectTo: callback("/account/password") });
        if (error) return setError(error.message);
        setInfo(`If ${addr} has an account, a password reset link is on its way.`);
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: callback(next) } });
        if (error) return setError(error.message);
        setInfo(`Check your inbox – we sent a sign-in link to ${addr}.`);
      }
    } finally {
      setBusy(false);
    }
  }

  const title = {
    signin: "Sign in with email",
    signup: "Create your password",
    forgot: "Reset your password",
    link: "Get a one-time sign-in link",
  }[mode];

  const cta = {
    signin: "Sign in",
    signup: "Create account",
    forgot: "Send reset link",
    link: "Email me a sign-in link",
  }[mode];

  return (
    <div className="space-y-5">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {info ? <Notice tone="success">{info}</Notice> : null}

      <Button type="button" variant="secondary" className="w-full" onClick={google} disabled={busy}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
        </svg>
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-xs text-slate">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={submit} className="space-y-3" noValidate>
        <p className="text-sm font-semibold text-navy">{title}</p>
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
        {mode === "signin" || mode === "signup" ? (
          <Field
            label="Password"
            htmlFor="password"
            hint={mode === "signup" ? `At least ${PASSWORD_MIN} characters with letters and a number.` : undefined}
          >
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        ) : null}
        <Button type="submit" className="w-full" disabled={busy || !email || ((mode === "signin" || mode === "signup") && !password)}>
          {cta}
        </Button>
      </form>

      <div className="flex flex-col gap-2 text-sm">
        {mode !== "signin" ? (
          <button type="button" className="text-left text-brand hover:underline" onClick={() => reset("signin")}>
            ← Sign in with email & password
          </button>
        ) : (
          <>
            <button type="button" className="text-left text-brand hover:underline" onClick={() => reset("forgot")}>
              Forgot password?
            </button>
            <button type="button" className="text-left text-brand hover:underline" onClick={() => reset("signup")}>
              Invited but no password yet? Create one
            </button>
            <button type="button" className="text-left text-ink hover:underline" onClick={() => reset("link")}>
              Email me a one-time link instead
            </button>
          </>
        )}
      </div>
    </div>
  );
}
