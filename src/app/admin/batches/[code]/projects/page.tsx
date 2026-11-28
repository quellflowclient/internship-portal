import { Card, EmptyState } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return { title: `${decodeURIComponent(code)} projects` };
}

/** Placeholder until Step F. The batch header and tabs come from the layout. */
export default function BatchProjects() {
  return (
    <Card>
      <EmptyState title="Projects arrive in Step F">
        Client, college and internal projects linked to this batch will show here, with their members, GitHub link and status. Projects are created
        and edited in Projects.
      </EmptyState>
    </Card>
  );
}
