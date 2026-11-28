import { notFound } from "next/navigation";
import { Kpi, KpiGrid } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { hrefWith, sp, type SearchParams } from "@/lib/url";
import { todayIST } from "@/lib/utils";
import type { EnrollmentStats, PlanItemStatusRow, StudentType } from "@/lib/types";
import { batchPath, getBatch } from "@/server/queries/batch";
import { emptyMix, plural } from "../_parts/shared";
import { DetailsCard, LinksCard, NextUpCard } from "./_overview/cards";
import { CancelPanel, EditPanel, LinksPanel } from "./_overview/panels";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return { title: decodeURIComponent(code) };
}

export default async function BatchOverview({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<SearchParams> }) {
  const [{ code: raw }, query] = await Promise.all([params, searchParams]);
  const data = await getBatch(decodeURIComponent(raw));
  if (!data) notFound();
  const { plan, progress, seatsTaken } = data;
  const b = data.batch;
  const supabase = await createClient();

  const base = batchPath(b.code);
  const panel = sp(query, "panel");
  const closeHref = hrefWith(base, query, { panel: null });
  const editable = b.status === "planned" || b.status === "running";

  const [enrolRes, statsRes, settingsRes, trackRes, nextRes, coordRes, adminsRes] = await Promise.all([
    supabase.from("enrollments").select("id, type").eq("batch_id", b.id).in("status", ["assigned", "active"]),
    supabase.from("v_enrollment_stats").select("enrollment_id, attendance_pct").eq("batch_id", b.id),
    supabase.from("org_settings").select("min_attendance_pct").eq("id", 1).maybeSingle(),
    supabase.from("track_entries").select("id", { count: "exact", head: true }).eq("batch_id", b.id).is("deleted_at", null),
    progress?.next_item_id
      ? supabase.from("v_plan_item_status").select("*").eq("id", progress.next_item_id).maybeSingle()
      : Promise.resolve({ data: null }),
    b.coordinator_id ? supabase.from("profiles").select("full_name, email").eq("id", b.coordinator_id).maybeSingle() : Promise.resolve({ data: null }),
    panel === "edit" && editable
      ? supabase.from("profiles").select("id, full_name, email").eq("role", "admin").eq("is_active", true).order("full_name")
      : Promise.resolve({ data: [] }),
  ]);

  /* Students: open enrolments only */
  const open = (enrolRes.data ?? []) as { id: string; type: StudentType }[];
  const openIds = new Set(open.map((e) => e.id));
  const mix = emptyMix();
  for (const e of open) mix[e.type] += 1;

  /* Attendance: average over open enrolments that have marked sessions */
  const minAtt = (settingsRes.data as { min_attendance_pct: number } | null)?.min_attendance_pct ?? 75;
  const pcts = ((statsRes.data ?? []) as Pick<EnrollmentStats, "enrollment_id" | "attendance_pct">[])
    .filter((s) => openIds.has(s.enrollment_id) && s.attendance_pct !== null)
    .map((s) => s.attendance_pct as number);
  const avgAtt = pcts.length ? Math.round(pcts.reduce((a, n) => a + n, 0) / pcts.length) : null;
  const below = pcts.filter((p) => p < minAtt).length;

  const done = progress?.done ?? 0;
  const planned = progress?.planned ?? 0;
  const behind = progress?.days_behind ?? 0;
  const next = nextRes.data as PlanItemStatusRow | null;
  const coord = coordRes.data as { full_name: string | null; email: string } | null;
  const admins = ((adminsRes.data ?? []) as { id: string; full_name: string | null; email: string }[]).map((a) => ({
    id: a.id,
    name: a.full_name || a.email,
  }));
  const canLog = editable;
  const canStart = b.status === "planned" && b.start_date <= todayIST();
  const canCancel = b.status === "planned" && seatsTaken === 0;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <KpiGrid>
        <Kpi
          label="Students"
          value={seatsTaken}
          sub={`${mix.paid} paid, ${mix.free} free, ${mix.stipend} stipend`}
          href={batchPath(b.code, "students")}
        />
        <Kpi
          label="Average attendance"
          value={avgAtt === null ? "—" : `${avgAtt}%`}
          sub={avgAtt === null ? "No sessions marked yet" : `${below} below ${minAtt}%`}
          tone={below > 0 ? "warn" : undefined}
        />
        <Kpi
          label="Plan done"
          value={`${done} of ${planned}`}
          sub={b.status === "running" ? (behind > 0 ? `${plural(behind, "day")} behind` : "On track") : undefined}
          tone={b.status === "running" ? (behind > 0 ? "warn" : "ok") : undefined}
          href={batchPath(b.code, "plan")}
        />
        <Kpi
          label="Sessions logged"
          value={trackRes.count ?? 0}
          sub={`${progress?.unplanned ?? 0} unplanned`}
          href={batchPath(b.code, "track")}
        />
      </KpiGrid>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <NextUpCard
            item={next}
            sessionTime={b.session_time}
            logHref={next && canLog ? `${batchPath(b.code, "track")}?new=1&item=${encodeURIComponent(next.id)}` : null}
          />
          <DetailsCard
            b={b}
            plan={plan}
            seatsTaken={seatsTaken}
            coordinator={coord ? coord.full_name || coord.email : null}
            editHref={editable ? hrefWith(base, query, { panel: "edit" }) : null}
            cancelHref={canCancel ? hrefWith(base, query, { panel: "cancel" }) : null}
            canStart={canStart}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <LinksCard b={b} editHref={editable ? hrefWith(base, query, { panel: "links" }) : null} />
        </div>
      </div>

      {panel === "links" && editable ? <LinksPanel b={b} closeHref={closeHref} /> : null}
      {panel === "edit" && editable ? <EditPanel b={b} seatsTaken={seatsTaken} admins={admins} closeHref={closeHref} /> : null}
      {panel === "cancel" && canCancel ? <CancelPanel b={b} closeHref={closeHref} /> : null}
    </div>
  );
}
