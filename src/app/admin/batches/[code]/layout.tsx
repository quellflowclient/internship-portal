import { notFound } from "next/navigation";
import { Video } from "lucide-react";
import { Crumbs, IconAnchor, Meta, PageHeader, Pill } from "@/components/ui";
import { WhatsAppIcon } from "@/components/icons";
import { BATCH_STATUS, scheduleLabel } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { batchTitle, getBatch } from "@/server/queries/batch";
import { BatchTabs } from "./batch-tabs";

/** Shared header + tabs for every batch section (Overview, Plan, Live track, Students, Projects, Close). */
export default async function BatchLayout({ children, params }: { children: React.ReactNode; params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw);
  const data = await getBatch(code);
  if (!data) notFound();
  const { batch: b, progress, seatsTaken } = data;
  const st = BATCH_STATUS[b.status];

  return (
    <>
      <Crumbs items={[{ label: "Batches", href: "/admin/batches" }, { label: b.code }]} />
      <PageHeader
        title={batchTitle(b)}
        description={
          <Meta
            items={[
              b.code,
              `${formatDate(b.start_date)} to ${formatDate(b.end_date)}`,
              `${scheduleLabel(b.schedule_days)}${b.session_time ? `, ${b.session_time}` : ""}`,
              b.status === "running" && progress ? `Day ${Math.max(1, progress.day_x)} of ${progress.day_n}` : null,
            ]}
          />
        }
        actions={
          <>
            <Pill tone={st.tone} dot>
              {st.label}
            </Pill>
            {b.whatsapp_url ? (
              <IconAnchor href={b.whatsapp_url} label="Open the batch WhatsApp group" outline className="text-wa">
                <WhatsAppIcon />
              </IconAnchor>
            ) : null}
            {b.meet_url ? (
              <IconAnchor href={b.meet_url} label="Open the class meeting link" outline>
                <Video aria-hidden />
              </IconAnchor>
            ) : null}
          </>
        }
      />
      <BatchTabs code={b.code} counts={{ students: seatsTaken }} />
      {children}
    </>
  );
}
