import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui";
import { getSession, homeFor } from "@/lib/auth/session";
import { signOut } from "@/server/actions/auth";
import { AuthFrame } from "@/app/login/auth-frame";

export const metadata: Metadata = { title: "No access" };

export default async function NoAccessPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.profile?.is_active) redirect(homeFor(session.profile.role));

  return (
    <AuthFrame>
      <div>
        <h1 className="text-xl font-bold">No access yet</h1>
        <p className="mt-2 text-sm text-fg-2">
          You are signed in as <strong className="font-semibold text-fg">{session.email}</strong>, but this account has not been
          invited to a Quellflow programme.
        </p>
        <p className="mt-2 text-sm text-fg-2">
          If you applied, our team will invite you after shortlisting. If you used a different email in the application form, sign
          out and use that account.
        </p>
      </div>
      <form action={signOut}>
        <Button type="submit" variant="secondary" className="w-full">
          Sign out
        </Button>
      </form>
    </AuthFrame>
  );
}
