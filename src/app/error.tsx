"use client";

/** Fallback for pages outside the admin shell (sign-in, student area, shared plan). */
import { Button, Wordmark } from "@/components/ui";

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-bg px-5 py-10 text-center">
      <Wordmark />
      <div>
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-1 max-w-sm text-sm text-fg-2">Check the connection and try again.</p>
      </div>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
