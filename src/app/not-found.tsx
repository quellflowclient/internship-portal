import type { Metadata } from "next";
import { ButtonLink, Wordmark } from "@/components/ui";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-bg px-5 py-10 text-center">
      <Wordmark />
      <div>
        <h1 className="text-xl font-bold">Page not found</h1>
        <p className="mt-1 max-w-sm text-sm text-fg-2">The link may be old or incomplete.</p>
      </div>
      <ButtonLink href="/" variant="primary">
        Go to the portal
      </ButtonLink>
    </main>
  );
}
