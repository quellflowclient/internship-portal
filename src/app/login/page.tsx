import type { Metadata } from "next";
import { Card, Wordmark } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-navy">
          <Wordmark />
        </div>
        <Card>
          <h1 className="text-xl font-bold">Sign in</h1>
          <p className="mt-1 text-sm text-slate">
            Use the Google account or email your Quellflow programme invite was sent to.
          </p>
          <div className="mt-6">
            <LoginForm next={next && next.startsWith("/") ? next : "/"} initialError={error} />
          </div>
        </Card>
        <p className="mt-4 text-center text-xs text-slate">Access is by invitation only.</p>
      </div>
    </main>
  );
}
