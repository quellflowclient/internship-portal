import { Gauge, Inbox, Layers, Settings, Users } from "lucide-react";
import { AppShell, type NavItem } from "@/components/app-shell";
import { requireRole } from "@/lib/auth/session";

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: Gauge },
  { href: "/admin/applicants", label: "Applicants", icon: Inbox },
  { href: "/admin/programs", label: "Programs", icon: Layers },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole(["admin", "super_admin"]);
  return (
    <AppShell nav={NAV} profile={profile}>
      {children}
    </AppShell>
  );
}
