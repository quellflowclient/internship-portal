import { Info } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { CopyButton } from "@/components/toast";
import { WhatsAppIcon, waLink } from "@/components/icons";
import { Avatar, ButtonLink, DL, IconAnchor, Notice, Pill } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { DISPLAY_STATUS, TYPE } from "@/lib/labels";
import { formatPhone } from "@/lib/phone";
import { inr } from "@/lib/utils";
import type { StudentListRow } from "@/lib/types";
import { feeText, studentHref, type FeeBalance } from "./shared";

/** Students list → ?open=<code>: a read-only summary. Edits happen in Student 360. */
export async function QuickView({ code, closeHref }: { code: string; closeHref: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("v_student_list").select("*").eq("code", code).maybeSingle();
  const s = data as StudentListRow | null;

  if (!s) {
    return (
      <Drawer closeHref={closeHref} title="Student not found">
        <Notice tone="warn" icon={<Info aria-hidden />}>
          No student has the code {code}. It may have been changed. Close this panel and search again.
        </Notice>
      </Drawer>
    );
  }

  const { data: fbData } = await supabase.from("v_fee_balance").select("agreed, paid, refunded, pending").eq("student_id", s.id).maybeSingle();
  const fb = fbData as FeeBalance | null;
  const st = DISPLAY_STATUS[s.display_status];
  const wa = waLink(s.phone);

  return (
    <Drawer
      closeHref={closeHref}
      title={s.full_name}
      sub={s.code}
      lead={<Avatar name={s.full_name} size="lg" />}
      icons={
        <>
          {wa ? (
            <IconAnchor href={wa} label={`WhatsApp ${s.full_name}`}>
              <WhatsAppIcon className="text-wa" />
            </IconAnchor>
          ) : null}
          <CopyButton icon="phone" text={s.phone} label={`Copy mobile ${formatPhone(s.phone)}`} />
          <CopyButton icon="mail" text={s.email} label={`Copy email ${s.email}`} />
        </>
      }
      footer={
        <ButtonLink variant="primary" href={studentHref(s.code)} className="md:flex-1">
          Open Student 360
        </ButtonLink>
      }
    >
      <div className="flex flex-wrap gap-2">
        {s.type ? <Pill tone={TYPE[s.type].tone}>{TYPE[s.type].label}</Pill> : null}
        <Pill tone={st.tone} dot>
          {st.label}
        </Pill>
      </div>
      <DL
        items={[
          ["College", s.college],
          ["Course", s.course ? `${s.course}${s.year_of_study ? `, year ${s.year_of_study}` : ""}` : s.year_of_study ? `Year ${s.year_of_study}` : null],
          ["Batch", s.batch_code ?? "Not assigned"],
          ["Attendance", s.attendance_pct !== null ? `${s.attendance_pct}%` : null],
          ["Fees", feeText(s.type, Boolean(s.enrollment_id), fb, inr)],
          ["Mobile", formatPhone(s.phone)],
        ]}
      />
      <Notice icon={<Info aria-hidden />}>To edit details or change the batch, open Student 360.</Notice>
    </Drawer>
  );
}
