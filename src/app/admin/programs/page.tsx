import { Flash } from "@/components/flash";
import { Button, Card, EmptyState, Field, Input, PageHeader, Select, StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { DURATION_LABEL, TRACK_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { addBatchMentor, createBatch, createProgram } from "@/server/actions/admin";
import type { DurationPlan, ProgramTrack, RoleCatalog } from "@/lib/types";

export const metadata = { title: "Programs" };

type ProgramRow = {
  id: string;
  name: string;
  track: ProgramTrack;
  role_code: string;
  duration: DurationPlan;
  program_pricing: { default_fee_inr: number | null } | null;
};
type BatchRow = {
  id: string;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  live_slot: string | null;
  programs: { name: string } | null;
  batch_mentors: { is_backup: boolean; profiles: { full_name: string | null; email: string } | null }[];
};

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const flash = await searchParams;
  const supabase = await createClient();
  const [{ data: roles }, { data: programs }, { data: batches }, { data: mentors }] = await Promise.all([
    supabase.from("roles_catalog").select("code, name, is_launch_track").eq("active", true).order("sort").returns<RoleCatalog[]>(),
    supabase.from("programs").select("id, name, track, role_code, duration, program_pricing (default_fee_inr)").order("created_at"),
    supabase
      .from("batches")
      .select("id, code, name, start_date, end_date, status, live_slot, programs:program_id (name), batch_mentors (is_backup, profiles:mentor_id (full_name, email))")
      .order("start_date", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email").eq("role", "mentor").eq("is_active", true).order("full_name"),
  ]);
  const P = (programs ?? []) as unknown as ProgramRow[];
  const B = (batches ?? []) as unknown as BatchRow[];

  return (
    <>
      <PageHeader title="Programs & batches" description="Track × role × duration, and the batches that run them." />
      <Flash {...flash} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">Programs</h2>
          {!P.length ? (
            <EmptyState title="No programs yet">Create one below, e.g. “AI Automation – 45 days (Track A)”.</EmptyState>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {P.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-xs text-slate">
                    {TRACK_LABEL[p.track]} · {DURATION_LABEL[p.duration]} · {p.role_code}
                    {p.program_pricing?.default_fee_inr != null ? ` · default fee ₹${p.program_pricing.default_fee_inr}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <form action={createProgram} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Program name" htmlFor="p_name">
                <Input id="p_name" name="name" required placeholder="AI Automation – 45 days" />
              </Field>
            </div>
            <Field label="Track" htmlFor="p_track">
              <Select id="p_track" name="track">
                {(Object.keys(TRACK_LABEL) as ProgramTrack[]).map((t) => (
                  <option key={t} value={t}>
                    {TRACK_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Role" htmlFor="p_role">
              <Select id="p_role" name="role_code">
                {(roles ?? []).map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                    {r.is_launch_track ? " ★" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Duration" htmlFor="p_duration">
              <Select id="p_duration" name="duration">
                {(Object.keys(DURATION_LABEL) as DurationPlan[]).map((d) => (
                  <option key={d} value={d}>
                    {DURATION_LABEL[d]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Default fee ₹ (optional)" htmlFor="p_fee" hint="Admin-only, never shown publicly">
              <Input id="p_fee" name="default_fee_inr" type="number" min={0} />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">Create program</Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">New batch</h2>
          {!P.length ? (
            <p className="text-sm text-slate">Create a program first.</p>
          ) : (
            <form action={createBatch} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Program" htmlFor="b_prog">
                  <Select id="b_prog" name="program_id">
                    {P.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Batch code" htmlFor="b_code" hint="e.g. AA-2701">
                <Input id="b_code" name="code" required />
              </Field>
              <Field label="Batch name" htmlFor="b_name">
                <Input id="b_name" name="name" required placeholder="AI Automation – Jan 2027" />
              </Field>
              <Field label="Start date" htmlFor="b_start">
                <Input id="b_start" name="start_date" type="date" required />
              </Field>
              <Field label="End date" htmlFor="b_end">
                <Input id="b_end" name="end_date" type="date" required />
              </Field>
              <Field label="Capacity" htmlFor="b_cap">
                <Input id="b_cap" name="capacity" type="number" min={1} />
              </Field>
              <Field label="Live slot" htmlFor="b_slot" hint="e.g. Fri 5–6 pm IST">
                <Input id="b_slot" name="live_slot" />
              </Field>
              <div className="sm:col-span-2">
                <Button type="submit">Create batch</Button>
              </div>
            </form>
          )}
        </Card>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-bold">Batches</h2>
      {!B.length ? (
        <EmptyState title="No batches yet" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {B.map((b) => (
            <Card key={b.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">
                    {b.code} · {b.name}
                  </p>
                  <p className="text-xs text-slate">
                    {b.programs?.name} · {formatDate(b.start_date)} – {formatDate(b.end_date)}
                    {b.live_slot ? ` · ${b.live_slot}` : ""}
                  </p>
                </div>
                <StatusBadge status={b.status === "active" ? "active" : b.status} label={b.status} />
              </div>
              <p className="mt-3 text-sm">
                <span className="text-slate">Mentors: </span>
                {b.batch_mentors.length
                  ? b.batch_mentors.map((m) => `${m.profiles?.full_name ?? m.profiles?.email}${m.is_backup ? " (backup)" : ""}`).join(", ")
                  : "none"}
              </p>
              {mentors?.length ? (
                <form action={addBatchMentor} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="batch_id" value={b.id} />
                  <Select name="mentor_id" aria-label="Mentor" className="w-auto flex-1">
                    {mentors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name ?? m.email}
                      </option>
                    ))}
                  </Select>
                  <label className="flex min-h-11 items-center gap-1 text-xs text-ink">
                    <input type="checkbox" name="is_backup" /> Backup
                  </label>
                  <Button type="submit" variant="secondary">
                    Assign
                  </Button>
                </form>
              ) : (
                <p className="mt-2 text-xs text-slate">Activate a mentor in Users to assign.</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
