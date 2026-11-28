import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";

/** notFound() inside the admin area (an unknown batch or student code): stays inside the shell. */
export default function AdminNotFound() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Not found" />
      <Card>
        <EmptyState title="This page does not exist" action={<ButtonLink href="/admin">Go to Dashboard</ButtonLink>}>
          The code in the link may be wrong, or the record was renamed. Search for it with the search box at the top.
        </EmptyState>
      </Card>
    </div>
  );
}
