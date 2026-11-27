import type { Metadata } from "next";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Batches" };

/** Placeholder until Step C. Links may carry filters (?q=, ?status= …); they are ignored here. */
export default function BatchesPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Batches" description="Running and planned batches with their plans" />
      <Card>
        <EmptyState title="Coming in Step C">Create batches from a course plan, publish the plan, log sessions and attendance from a phone, and see who is behind. This screen arrives in Step C.</EmptyState>
      </Card>
    </div>
  );
}
