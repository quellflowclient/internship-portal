/** Batch → Overview cards. Details and Tools and links own their data (pen opens the panel); Next up links to Live track. */
import type { ReactNode } from "react";
import { CircleCheck, FolderGit2, GraduationCap, HardDrive, ListVideo, Pen, Play, Video, XCircle, type LucideIcon } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons";
import { ActionButton } from "@/components/toast";
import { ButtonLink, Card, CardHeader, DL, IconAnchor, IconLink, Meta, Pill } from "@/components/ui";
import { BATCH_STATUS, PLAN_KIND, scheduleLabel } from "@/lib/labels";
import { cn, formatDate, formatDay, inr } from "@/lib/utils";
import type { BatchFull, BatchPlan, PlanItemStatusRow } from "@/lib/types";
import { startBatch } from "@/server/actions/batches";

/* ---------- Next up ---------- */
export function NextUpCard({ item, sessionTime, logHref }: { item: PlanItemStatusRow | null; sessionTime: string | null; logHref: string | null }) {
  if (!item) {
    return (
      <Card>
        <CardHeader title="Next up" />
        <p className="px-4 py-5 text-sm text-fg-3">All planned items are done or skipped.</p>
      </Card>
    );
  }
  const kind = PLAN_KIND[item.kind];
  return (
    <Card>
      <CardHeader title="Next up" />
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <b className="text-md font-semibold break-words">{item.title}</b>
          <span className="text-sm text-fg-2">
            <Meta
              items={[
                formatDay(item.planned_date),
                sessionTime,
                <span key="k" className="inline-flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-sm", kind.dot)} aria-hidden />
                  {kind.label}
                </span>,
                `Week ${item.week}`,
              ]}
            />
          </span>
        </div>
        {logHref ? (
          <ButtonLink href={logHref} className="shrink-0">
            <CircleCheck aria-hidden />
            Log after class
          </ButtonLink>
        ) : null}
      </div>
    </Card>
  );
}

/* ---------- Tools and links ---------- */
const TOOLS: { key: keyof BatchFull & `${string}_url`; label: string; icon?: LucideIcon }[] = [
  { key: "whatsapp_url", label: "WhatsApp group" },
  { key: "classroom_url", label: "Google Classroom", icon: GraduationCap },
  { key: "meet_url", label: "Class meeting link", icon: Video },
  { key: "playlist_url", label: "YouTube playlist", icon: ListVideo },
  { key: "drive_url", label: "Drive folder", icon: HardDrive },
  { key: "github_url", label: "GitHub", icon: FolderGit2 },
];

export const LINK_FIELDS = TOOLS;

export function LinksCard({ b, editHref }: { b: BatchFull; editHref: string | null }) {
  const set = TOOLS.filter((t) => b[t.key]);
  return (
    <Card>
      <CardHeader
        title="Tools and links"
        info="Free tools used for teaching. Students see the same icons on their home screen."
        actions={
          editHref ? (
            <IconLink href={editHref} label="Edit links" scroll={false}>
              <Pen aria-hidden />
            </IconLink>
          ) : null
        }
      />
      {set.length ? (
        <div className="flex flex-wrap gap-2 p-4">
          {set.map(({ key, label, icon: Icon }) => (
            <IconAnchor key={key} href={b[key] as string} label={`Open ${label}`} outline className={key === "whatsapp_url" ? "text-wa" : undefined}>
              {Icon ? <Icon aria-hidden /> : <WhatsAppIcon />}
            </IconAnchor>
          ))}
        </div>
      ) : (
        <p className="px-4 py-5 text-sm text-fg-3">No links yet. Add the WhatsApp group, Classroom, Meet and other links with the pen.</p>
      )}
    </Card>
  );
}

/* ---------- Details ---------- */
function planVersion(plan: BatchPlan | null): ReactNode {
  if (!plan || plan.published_version === 0) return <Pill tone="warn">Draft, not published</Pill>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      Version {plan.published_version}
      {plan.has_unpublished_changes ? <Pill tone="warn">Changes not published</Pill> : null}
    </span>
  );
}

export function DetailsCard({
  b,
  plan,
  seatsTaken,
  coordinator,
  editHref,
  cancelHref,
  canStart,
}: {
  b: BatchFull;
  plan: BatchPlan | null;
  seatsTaken: number;
  coordinator: string | null;
  editHref: string | null;
  cancelHref: string | null;
  canStart: boolean;
}) {
  const st = BATCH_STATUS[b.status];
  return (
    <Card>
      <CardHeader
        title="Details"
        info="Batch details are edited only here. Course plans and fees are edited in Settings."
        actions={
          editHref ? (
            <IconLink href={editHref} label="Edit batch details" scroll={false}>
              <Pen aria-hidden />
            </IconLink>
          ) : null
        }
      />
      <div className="p-4">
        <DL
          items={[
            ["Course plan", `${b.course_plans.courses.name}, ${b.course_plans.duration_days} days`],
            ["Fee", inr(b.course_plans.fee_inr)],
            ["Dates", `${formatDate(b.start_date)} to ${formatDate(b.end_date)}`],
            ["Schedule", `${scheduleLabel(b.schedule_days)}${b.session_time ? `, ${b.session_time}` : ""}`],
            ["Seats", `${seatsTaken} of ${b.capacity} taken`],
            ["Coordinator", coordinator ?? "Not set"],
            [
              "Status",
              <Pill key="s" tone={st.tone} dot>
                {st.label}
              </Pill>,
            ],
            ["Plan", planVersion(plan)],
          ]}
        />
      </div>
      {canStart || cancelHref ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          {cancelHref ? (
            <ButtonLink variant="danger" href={cancelHref} scroll={false}>
              <XCircle aria-hidden />
              Cancel batch
            </ButtonLink>
          ) : null}
          <span className="flex-1" />
          {canStart ? (
            <ActionButton action={startBatch.bind(null, b.id)}>
              <Play aria-hidden />
              Start batch now
            </ActionButton>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
