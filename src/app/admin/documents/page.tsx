import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { ButtonLink, Kpi, KpiGrid, PageHeader, Tabs } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { sp, type SearchParams } from "@/lib/url";
import { todayIST } from "@/lib/utils";
import { DOC_GROUPS } from "@/server/documents/rules";
import { DocList } from "./_parts/doc-list";
import { DocPanel } from "./_parts/doc-panel";
import { IssuePanel } from "./_parts/issue-panel";
import { docFilterHref, docHref, isGroup, isUuid } from "./_parts/shared";

export const metadata: Metadata = { title: "Documents" };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { profile } = await requireRole(["admin"]);
  const supabase = await createClient();

  const tabRaw = sp(params, "tab");
  const tab = isGroup(tabRaw) ? tabRaw : "all";
  const open = sp(params, "open");
  const isNew = sp(params, "new") === "1";

  const { data: s } = await supabase.from("org_settings").select("academic_year_start_month").eq("id", 1).maybeSingle();
  const startMonth = (s as { academic_year_start_month: number | null } | null)?.academic_year_start_month ?? 6;
  const today = todayIST();
  const [y, m] = today.split("-").map(Number);
  const ayYear = m >= startMonth ? y : y - 1;
  const ayStart = `${ayYear}-${String(startMonth).padStart(2, "0")}-01T00:00:00+05:30`;
  const monthStart = `${today.slice(0, 7)}-01T00:00:00+05:30`;
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();

  const head = { count: "exact" as const, head: true };
  const [issuedRes, awaitingRes, awaitingOldRes, scansRes, scansValidRes, revokedRes] = await Promise.all([
    supabase.from("documents").select("id", head).neq("status", "draft").gte("issued_at", ayStart),
    supabase.from("v_document_list").select("id", head).eq("display_status", "awaiting"),
    supabase.from("v_document_list").select("id", head).eq("display_status", "awaiting").lt("issued_at", threeDaysAgo),
    supabase.from("verification_scans").select("id", head).gte("at", monthStart),
    supabase.from("verification_scans").select("id", head).gte("at", monthStart).eq("result", "valid"),
    supabase.from("documents").select("id", head).eq("status", "revoked"),
  ]);
  const awaitingOld = awaitingOldRes.count ?? 0;
  const scans = scansRes.count ?? 0;
  const scansValid = scansValidRes.count ?? 0;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title="Documents"
        info="Issued only here. PDFs are made on demand and never stored online. Every document has a QR code that opens the public check page."
        description="Letters and certificates, each with its own number and QR code"
        actions={
          <ButtonLink variant="primary" href={docHref(params, { new: 1 })} scroll={false}>
            <Plus aria-hidden />
            Issue document
          </ButtonLink>
        }
      />

      <KpiGrid>
        <Kpi label="Issued this year" value={issuedRes.count ?? 0} sub={`since ${MONTHS[startMonth - 1]} ${ayYear}`} />
        <Kpi
          label="Awaiting acceptance"
          value={awaitingRes.count ?? 0}
          sub={awaitingOld ? `${awaitingOld} older than 3 days` : "students still to sign"}
          tone={awaitingOld ? "warn" : undefined}
          href={docFilterHref(params, { status: "awaiting", tab: null })}
        />
        <Kpi label="QR checks this month" value={scans} sub={scans ? `${scansValid} shown as valid` : "no checks yet"} />
        <Kpi label="Revoked" value={revokedRes.count ?? 0} sub="replaced by a new number" href={docFilterHref(params, { status: "revoked", tab: null })} />
      </KpiGrid>

      <Tabs
        label="Document types"
        items={[
          { href: docFilterHref(params, { tab: null }), label: "All", active: tab === "all" },
          ...DOC_GROUPS.map((g) => ({ href: docFilterHref(params, { tab: g.key }), label: g.label, active: tab === g.key })),
        ]}
      />

      <DocList params={params} group={tab === "all" ? null : tab} />

      {isNew ? (
        <IssuePanel params={params} profile={profile} closeHref={docHref(params)} />
      ) : isUuid(open) ? (
        <DocPanel id={open} params={params} isOwner={profile.is_owner} revokeMode={sp(params, "revoke") === "1"} />
      ) : null}
    </div>
  );
}
