"use server";

import { assertAdmin } from "@/server/guard";

export interface SearchHit {
  kind: "student" | "lead" | "document" | "project";
  id: string;
  code: string;
  title: string;
  subtitle: string;
  href: string;
}

/** Top-bar search (docs/19 §8 P8): students, leads, documents, projects – admin only, max 20. */
export async function searchAll(q: string): Promise<SearchHit[]> {
  const query = q.trim();
  if (query.length < 2 || query.length > 80) return [];
  const { supabase } = await assertAdmin();
  const { data, error } = await supabase.rpc("search_all", { p_q: query });
  if (error || !data) return [];
  return (data as Omit<SearchHit, "href">[]).map((h) => ({
    ...h,
    href:
      h.kind === "student"
        ? `/admin/students/${encodeURIComponent(h.code)}`
        : h.kind === "lead"
          ? `/admin/leads?open=${h.id}`
          : h.kind === "document"
            ? `/admin/documents?q=${encodeURIComponent(h.code)}`
            : `/admin/projects?q=${encodeURIComponent(h.code)}`,
  }));
}
