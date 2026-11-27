import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Wordmark } from "@/components/ui";
import { getSession } from "@/lib/auth/session";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Password" };

/** Set or change the password of the signed-in account (also the landing page of reset links). */
export default async function PasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account/password");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-navy">
          <Wordmark />
        </div>
        <Card>
          <h1 className="text-xl font-bold">Set your password</h1>
          <p className="mt-1 text-sm text-slate">
            For <strong className="text-navy">{session.email}</strong>. After this you can sign in with email &amp; password or with
            Google.
          </p>
          <div className="mt-6">
            <PasswordForm />
          </div>
        </Card>
        <p className="mt-4 text-center text-sm">
          <Link href="/" className="text-brand hover:underline">
            Back to portal
          </Link>
        </p>
      </div>
    </main>
  );
}
