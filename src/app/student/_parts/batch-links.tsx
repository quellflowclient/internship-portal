/** The batch's free tools as icon buttons (same set and icons as the admin "Tools and links" card). */
import { FolderGit2, GraduationCap, HardDrive, ListVideo, Video, type LucideIcon } from "lucide-react";
import { IconAnchor } from "@/components/ui";
import { WhatsAppIcon } from "@/components/icons";
import { safeHref } from "@/lib/plan";
import type { MyEnrollment } from "./data";

const TOOLS: { key: keyof MyEnrollment & `${string}_url`; label: string; icon?: LucideIcon }[] = [
  { key: "whatsapp_url", label: "WhatsApp group" },
  { key: "classroom_url", label: "Google Classroom", icon: GraduationCap },
  { key: "meet_url", label: "Class meeting link", icon: Video },
  { key: "playlist_url", label: "YouTube playlist", icon: ListVideo },
  { key: "drive_url", label: "Drive folder", icon: HardDrive },
  { key: "github_url", label: "GitHub", icon: FolderGit2 },
];

export function BatchLinks({ e }: { e: MyEnrollment }) {
  const set = TOOLS.map((t) => ({ ...t, href: safeHref(e[t.key]) })).filter((t) => t.href);
  if (!set.length) return <p className="text-sm text-fg-3">Links appear here when the team adds them.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {set.map(({ key, label, icon: Icon, href }) => (
        <IconAnchor key={key} href={href} label={`Open ${label}`} outline className={key === "whatsapp_url" ? "text-wa" : undefined}>
          {Icon ? <Icon aria-hidden /> : <WhatsAppIcon />}
        </IconAnchor>
      ))}
    </div>
  );
}
