import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AuthFrame } from "@/app/login/auth-frame";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Password" };

/** Set or change the password of the signed-in account (also the landing page of reset links). */
export default async function PasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account/password");

  return (
    <AuthFrame>
      <div>
        <h1 className="text-xl font-bold">Set your password</h1>
        <p className="mt-1 text-sm text-fg-2">
          For <strong className="font-semibold text-fg">{session.email}</strong>. After this you can sign in with email and password
          or with Google.
        </p>
      </div>
      <PasswordForm />
      <p className="text-sm">
        <Link href="/" className="font-medium text-accent-ink hover:underline">
          Back to portal
        </Link>
      </p>
    </AuthFrame>
  );
}
