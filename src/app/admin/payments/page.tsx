import type { Metadata } from "next";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Payments" };

/** Placeholder until Step D. Links may carry filters (?q=, ?status= …); they are ignored here. */
export default function PaymentsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Payments" description="Fees in, refunds and stipends out" />
      <Card>
        <EmptyState title="Coming in Step D">One ledger for fees, refunds and stipends, with pending fees, the monthly stipend run and screenshot file names. This screen arrives in Step D.</EmptyState>
      </Card>
    </div>
  );
}
