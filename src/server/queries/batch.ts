import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { BatchFull, BatchPlan, BatchProgress } from "@/lib/types";

/**
 * One batch with everything the batch header and tabs need. Cached per request,
 * so the layout and the page can both call it without a second round of queries.
 */
export const getBatch = cache(async (code: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("batches")
    .select("*, course_plans(id, duration_days, fee_inr, courses(code, name))")
    .eq("code", code)
    .maybeSingle();
  if (!data) return null;
  const batch = data as unknown as BatchFull;
  const [plan, progress, seats] = await Promise.all([
    supabase.from("batch_plans").select("*").eq("batch_id", batch.id).maybeSingle(),
    supabase.from("v_batch_progress").select("*").eq("batch_id", batch.id).maybeSingle(),
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("batch_id", batch.id).in("status", ["assigned", "active"]),
  ]);
  return {
    batch,
    plan: (plan.data as BatchPlan | null) ?? null,
    progress: (progress.data as BatchProgress | null) ?? null,
    seatsTaken: seats.count ?? 0,
  };
});

export type BatchData = NonNullable<Awaited<ReturnType<typeof getBatch>>>;

export const batchTitle = (b: BatchFull) => `${b.course_plans.courses.name}, ${b.course_plans.duration_days} days`;
export const batchPath = (code: string, tab = "") => `/admin/batches/${encodeURIComponent(code)}${tab ? `/${tab}` : ""}`;
