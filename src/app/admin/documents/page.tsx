import type { Metadata } from "next";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Documents" };

/** Placeholder until Step E. Links may carry filters (?q=, ?status= …); they are ignored here. */
export default function DocumentsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Documents" description="Letters and certificates for students" />
      <Card>
        <EmptyState title="Coming in Step E">Issue offer letters, terms, consent and certificates as PDFs with a QR code, and track who has accepted them. This screen arrives in Step E.</EmptyState>
      </Card>
    </div>
  );
}
