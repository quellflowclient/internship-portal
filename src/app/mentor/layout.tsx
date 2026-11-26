import { Gauge } from "lucide-react";
import { AppShell, type NavItem } from "@/components/app-shell";
import { requireRole } from "@/lib/auth/session";

const NAV: NavItem[] = [{ href: "/mentor", label: "Dashboard", icon: Gauge }];

export default async function MentorLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole(["mentor"]);
  return (
    <AppShell nav={NAV} profile={profile}>
      {children}
    </AppShell>
  );
}
