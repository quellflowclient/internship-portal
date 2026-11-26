import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin" };

export default async function AdminOverview() {
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const countOf = async (table: string, filter?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    const { count } = await q;
    return count ?? 0;
  };

  const [total, fresh, shortlisted, lastWeek, activeEnrol, invited, pendingInv] = await Promise.all([
    countOf("applicants"),
    countOf("applicants", (q) => q.eq("status", "new")),
    countOf("applicants", (q) => q.eq("status", "shortlisted")),
    countOf("applicants", (q) => q.gte("created_at", weekAgo)),
    countOf("enrollments", (q) => q.eq("status", "active")),
    countOf("enrollments", (q) => q.eq("status", "invited")),
    countOf("invitations", (q) => q.is("accepted_at", null).is("revoked_at", null)),
  ]);

  const tiles = [
    { label: "Total applicants", value: total, href: "/admin/applicants" },
    { label: "New (not reviewed)", value: fresh, href: "/admin/applicants?status=new" },
    { label: "Shortlisted", value: shortlisted, href: "/admin/applicants?status=shortlisted" },
    { label: "Applied in last 7 days", value: lastWeek, href: "/admin/applicants" },
    { label: "Active enrolments", value: activeEnrol, href: "/admin/programs" },
    { label: "Invited (awaiting sign-in)", value: invited, href: "/admin/programs" },
    { label: "Pending invitations", value: pendingInv, href: "/admin/users" },
  ];

  return (
    <>
      <PageHeader title="Overview" description="Internship applications and programmes at a glance." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href}>
            <Card className="h-full transition hover:border-brand">
              <p className="text-sm text-slate">{t.label}</p>
              <p className="mt-2 text-3xl font-extrabold text-brand">{t.value}</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
