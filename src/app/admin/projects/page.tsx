import type { Metadata } from "next";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Projects" };

/** Placeholder until Step F. Links may carry filters (?q=, ?status= …); they are ignored here. */
export default function ProjectsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Projects" description="Client, college and internal projects" />
      <Card>
        <EmptyState title="Coming in Step F">Group students into project teams, track tasks and issue project certificates. This screen arrives in Step F.</EmptyState>
      </Card>
    </div>
  );
}
