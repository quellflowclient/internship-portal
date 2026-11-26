import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button, Card, Wordmark } from "@/components/ui";
import { getSession, homeFor } from "@/lib/auth/session";
import { signOut } from "@/server/actions/auth";

export const metadata: Metadata = { title: "No access" };

export default async function NoAccessPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.profile?.is_active) redirect(homeFor(session.profile.role));

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-navy">
          <Wordmark />
        </div>
        <Card>
          <h1 className="text-xl font-bold">No access yet</h1>
          <p className="mt-2 text-sm text-slate">
            You are signed in as <strong className="text-navy">{session.email}</strong>, but this account has not been
            invited to a Quellflow programme. If you applied, our team will invite you after shortlisting. If you used a
            different email in the application form, sign out and use that account.
          </p>
          <form action={signOut} className="mt-6">
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
