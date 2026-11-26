import Link from "next/link";
import { Button, Card, EmptyState, Input, PageHeader, Select, StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { APPLICANT_STATUS_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import type { Applicant, ApplicantStatus, RoleCatalog } from "@/lib/types";

export const metadata = { title: "Applicants" };

const PAGE_SIZE = 25;
const STATUSES = Object.keys(APPLICANT_STATUS_LABEL) as ApplicantStatus[];

type Search = { q?: string; status?: string; role?: string; cv?: string; page?: string };

export default async function ApplicantsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();

  const { data: roles } = await supabase.from("roles_catalog").select("code, name").order("sort").returns<Pick<RoleCatalog, "code" | "name">[]>();

  let q = supabase
    .from("applicants")
    .select("id, candidate_code, full_name, email, college, year_of_study, role_label, role_code, cv_url, submitted_at, status, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (sp.status && STATUSES.includes(sp.status as ApplicantStatus)) q = q.eq("status", sp.status);
  if (sp.role === "OTHER") q = q.is("role_code", null);
  else if (sp.role && /^[A-Z0-9]{2}$/.test(sp.role)) q = q.eq("role_code", sp.role);
  if (sp.cv === "yes") q = q.like("cv_url", "https%");
  if (sp.q) {
    const term = sp.q.replace(/[%,()]/g, " ").trim();
    if (term) q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,college.ilike.%${term}%,candidate_code.ilike.%${term}%`);
  }

  const { data, count, error } = await q.returns<Applicant[]>();
  const rows = data ?? [];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `?${u.toString()}`;
  };

  return (
    <>
      <PageHeader title="Applicants" description={`${count ?? 0} applications from the Google Form`} />

      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="get">
          <Input name="q" defaultValue={sp.q} placeholder="Search name, email, college, ID" className="lg:col-span-2" aria-label="Search" />
          <Select name="status" defaultValue={sp.status ?? ""} aria-label="Status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {APPLICANT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Select name="role" defaultValue={sp.role ?? ""} aria-label="Role">
            <option value="">All roles</option>
            {(roles ?? []).map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
            <option value="OTHER">Other (typed)</option>
          </Select>
          <div className="flex gap-2">
            <Select name="cv" defaultValue={sp.cv ?? ""} aria-label="CV">
              <option value="">CV: any</option>
              <option value="yes">With CV</option>
            </Select>
            <Button type="submit">Filter</Button>
          </div>
        </form>
      </Card>

      {error ? <EmptyState title="Could not load applicants">{error.message}</EmptyState> : null}
      {!error && !rows.length ? <EmptyState title="No applicants match">Try clearing the filters.</EmptyState> : null}

      {rows.length ? (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border border-line bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy text-xs text-white uppercase">
                <tr>
                  {["ID", "Name", "Role", "Year", "College", "Applied", "CV", "Status"].map((h) => (
                    <th key={h} className="px-3 py-2.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-t border-line hover:bg-tint">
                    <td className="px-3 py-2.5 font-mono text-xs">
                      <Link href={`/admin/applicants/${a.id}`} className="text-brand underline-offset-2 hover:underline">
                        {a.candidate_code}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/admin/applicants/${a.id}`} className="font-semibold hover:underline">
                        {a.full_name}
                      </Link>
                      <div className="text-xs text-slate">{a.email}</div>
                    </td>
                    <td className="px-3 py-2.5">{a.role_label ?? "—"}</td>
                    <td className="px-3 py-2.5">{a.year_of_study ?? "—"}</td>
                    <td className="px-3 py-2.5">{a.college ?? "—"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(a.submitted_at ?? a.created_at)}</td>
                    <td className="px-3 py-2.5">{a.cv_url?.startsWith("http") ? "Yes" : "—"}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={a.status} label={APPLICANT_STATUS_LABEL[a.status]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {rows.map((a) => (
              <Link key={a.id} href={`/admin/applicants/${a.id}`}>
                <Card>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{a.full_name}</p>
                      <p className="font-mono text-xs text-slate">{a.candidate_code}</p>
                    </div>
                    <StatusBadge status={a.status} label={APPLICANT_STATUS_LABEL[a.status]} />
                  </div>
                  <p className="mt-2 text-sm text-ink">{a.role_label ?? "—"}</p>
                  <p className="text-xs text-slate">
                    {a.college ?? "—"} · {a.year_of_study ?? "—"}
                  </p>
                </Card>
              </Link>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-slate">
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link className="rounded-lg border border-line bg-white px-3 py-2" href={qs(page - 1)}>
                  Previous
                </Link>
              ) : null}
              {page < pages ? (
                <Link className="rounded-lg border border-line bg-white px-3 py-2" href={qs(page + 1)}>
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
