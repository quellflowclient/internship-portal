import { Home } from "lucide-react";
import { AppShell, type NavItem } from "@/components/app-shell";
import { requireRole } from "@/lib/auth/session";

const NAV: NavItem[] = [{ href: "/student", label: "Today", icon: Home }];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole(["student"]);
  return (
    <AppShell nav={NAV} profile={profile}>
      {children}
    </AppShell>
  );
}
