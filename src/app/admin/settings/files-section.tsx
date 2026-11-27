import { Card, CardHeader, Field, FormGrid, Input, Notice, Textarea } from "@/components/ui";
import { ActionForm, FieldError, SubmitButton } from "@/components/toast";
import { createClient } from "@/lib/supabase/server";
import type { OrgSettings } from "@/lib/types";
import { updateRules } from "@/server/actions/settings";

type Rules = Pick<OrgSettings, "local_files_root" | "min_attendance_pct" | "min_task_pct" | "stipend_pay_by_day" | "holidays">;

export async function FilesSection({ canEdit }: { canEdit: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("org_settings")
    .select("local_files_root, min_attendance_pct, min_task_pct, stipend_pay_by_day, holidays")
    .eq("id", 1)
    .maybeSingle();
  const r = data as Rules | null;

  if (!r) {
    return (
      <Card>
        <CardHeader title="Local files and rules" />
        <div className="p-4">
          <Notice tone="error">The settings row is missing. Run the seed once on this database.</Notice>
        </div>
      </Card>
    );
  }
  const holidays = Array.isArray(r.holidays) ? r.holidays : [];

  return (
    <Card>
      <CardHeader title="Local files and rules" info="Files stay on the office PC. Nothing is uploaded to the portal." />
      <ActionForm action={updateRules} className="flex flex-col gap-5 p-4">
        <Field
          label="Root folder on the office PC"
          htmlFor="local_files_root"
          hint="Sync this folder to OneDrive or Google Drive for backup. The portal only prints file names inside it."
          required
        >
          <Input id="local_files_root" name="local_files_root" defaultValue={r.local_files_root} disabled={!canEdit} spellCheck={false} />
          <FieldError name="local_files_root" />
        </Field>

        <FormGrid className="md:grid-cols-3">
          <Field label="Minimum attendance (%)" htmlFor="min_attendance_pct" hint="Below this a student is at risk and not eligible." required>
            <Input id="min_attendance_pct" name="min_attendance_pct" type="number" inputMode="numeric" min={0} max={100} defaultValue={r.min_attendance_pct} disabled={!canEdit} />
            <FieldError name="min_attendance_pct" />
          </Field>
          <Field label="Minimum tasks done (%)" htmlFor="min_task_pct" hint="Needed for the certificate." required>
            <Input id="min_task_pct" name="min_task_pct" type="number" inputMode="numeric" min={0} max={100} defaultValue={r.min_task_pct} disabled={!canEdit} />
            <FieldError name="min_task_pct" />
          </Field>
          <Field label="Pay stipend by day" htmlFor="stipend_pay_by_day" hint="Day of the next month, 1 to 28." required>
            <Input id="stipend_pay_by_day" name="stipend_pay_by_day" type="number" inputMode="numeric" min={1} max={28} defaultValue={r.stipend_pay_by_day} disabled={!canEdit} />
            <FieldError name="stipend_pay_by_day" />
          </Field>
        </FormGrid>

        <Field label="Holidays" htmlFor="holidays" hint="One date per line as YYYY-MM-DD (commas also work). Skipped when batch plans are dated.">
          <Textarea id="holidays" name="holidays" rows={5} defaultValue={holidays.join("\n")} disabled={!canEdit} spellCheck={false} className="font-mono" />
          <FieldError name="holidays" />
        </Field>

        {canEdit ? (
          <div>
            <SubmitButton>Save</SubmitButton>
          </div>
        ) : null}
      </ActionForm>
    </Card>
  );
}
