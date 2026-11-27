"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Input, Notice } from "@/components/ui";
import { PASSWORD_MIN, passwordProblem } from "@/lib/password";

export function PasswordForm() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const problem = passwordProblem(pw);
    if (problem) return setError(problem);
    if (pw !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(error.message);
    setDone(true);
    setTimeout(() => {
      router.replace("/");
      router.refresh();
    }, 1200);
  }

  if (done) return <Notice tone="success">Password saved. Taking you to the portal…</Notice>;

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field label="New password" htmlFor="pw" hint={`At least ${PASSWORD_MIN} characters with letters and a number.`}>
        <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
      </Field>
      <Field label="Confirm password" htmlFor="pw2">
        <Input id="pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      <Button type="submit" className="w-full" disabled={busy || !pw || !confirm}>
        Save password
      </Button>
    </form>
  );
}
