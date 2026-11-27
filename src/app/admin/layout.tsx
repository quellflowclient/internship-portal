import { AdminShell } from "@/components/shell/admin-shell";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole(["admin"]);
  const supabase = await createClient();
  const [leads, docs, attention] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", "new"),
    supabase.from("v_document_list").select("id", { count: "exact", head: true }).eq("display_status", "awaiting"),
    supabase.from("v_attention").select("n"),
  ]);
  return (
    <AdminShell
      name={profile.full_name ?? profile.email}
      subtitle={profile.is_owner ? "Admin, owner" : "Admin"}
      badges={{ leads: leads.count ?? 0, documents: docs.count ?? 0 }}
      attention={(attention.data ?? []).length}
    >
      {children}
    </AdminShell>
  );
}
