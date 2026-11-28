"use client";

/** Shown inside the admin shell when a page fails to load (network or database error). */
import { RotateCcw } from "lucide-react";
import { Button, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Something went wrong" />
      <Card>
        <EmptyState
          title="This page could not be loaded"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={reset}>
                <RotateCcw aria-hidden />
                Try again
              </Button>
              <ButtonLink href="/admin">Go to Dashboard</ButtonLink>
            </div>
          }
        >
          Check the connection and try again. Nothing you saved earlier is lost.
          {error.digest ? <span className="mt-1 block text-xs text-fg-3">Error reference {error.digest}</span> : null}
        </EmptyState>
      </Card>
    </div>
  );
}
