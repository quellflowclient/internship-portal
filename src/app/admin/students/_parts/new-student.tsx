import { Info, TriangleAlert } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { ActionForm, SubmitButton } from "@/components/toast";
import { ButtonLink, FormGrid, Notice, RadioSegment } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { formatPhone } from "@/lib/phone";
import { createStudent } from "@/server/actions/students";
import { SelectField, TextField } from "./fields";
import { planLabel, TYPE_OPTIONS, type PlanRef } from "./shared";

interface LeadPrefill {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  college: string | null;
  course: string | null;
  year_of_study: string | null;
  stage: string;
}

/** Students → ?new=1 (+ &lead=<id> from "Convert to student"). Creates the student; batch comes next in Student 360. */
export async function NewStudentPanel({ leadId, closeHref }: { leadId?: string; closeHref: string }) {
  const supabase = await createClient();
  const [plansRes, leadRes] = await Promise.all([
    supabase
      .from("course_plans")
      .select("id, duration_days, fee_inr, course:courses(code, name, active)")
      .eq("active", true)
      .order("duration_days"),
    leadId && /^[0-9a-f-]{36}$/i.test(leadId)
      ? supabase
          .from("leads")
          .select("id, full_name, phone, email, college, course, year_of_study, stage")
          .eq("id", leadId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const plans = ((plansRes.data ?? []) as unknown as (PlanRef & { id: string; course: { code: string; name: string; active: boolean } | null })[])
    .filter((p) => p.course?.active !== false)
    .sort((a, b) => (a.course?.name ?? "").localeCompare(b.course?.name ?? "") || a.duration_days - b.duration_days);
  const lead = leadRes.data as LeadPrefill | null;
  const converted = lead?.stage === "converted";
  const l = lead && !converted ? lead : null;
  const year = l?.year_of_study ? /[1-6]/.exec(l.year_of_study)?.[0] : undefined;

  return (
    <Drawer
      closeHref={closeHref}
      title="New student"
      sub={l ? `From lead ${l.full_name}. The lead history is kept.` : "Creates a student code and a sign-in invite."}
      footer={
        <>
          <ButtonLink variant="ghost" href={closeHref} scroll={false}>
            Cancel
          </ButtonLink>
          <span className="flex-1 max-md:hidden" />
          <SubmitButton form="f-new-student" pendingText="Creating…">
            Create student
          </SubmitButton>
        </>
      }
    >
      {converted ? (
        <Notice tone="warn" icon={<TriangleAlert aria-hidden />}>
          {lead?.full_name} is already a student. This form creates a separate new student.
        </Notice>
      ) : null}
      <ActionForm action={createStudent} id="f-new-student">
        {l ? <input type="hidden" name="lead" value={l.id} /> : null}
        <FormGrid>
          <TextField
            idPrefix="ns"
            name="full_name"
            label="Full name (as on documents)"
            required
            defaultValue={l?.full_name ?? ""}
            autoComplete="off"
            className="md:col-span-2"
          />
          <TextField
            idPrefix="ns"
            name="phone"
            label="Mobile"
            required
            inputMode="tel"
            placeholder="+91"
            defaultValue={l?.phone ? formatPhone(l.phone) : ""}
            autoComplete="off"
          />
          <TextField idPrefix="ns" name="email" label="Email" required type="email" defaultValue={l?.email ?? ""} autoComplete="off" />
          <TextField idPrefix="ns" name="college" label="College" required defaultValue={l?.college ?? ""} className="md:col-span-2" />
          <TextField idPrefix="ns" name="course" label="Course" placeholder="B.Tech CE" defaultValue={l?.course ?? ""} />
          <SelectField idPrefix="ns" name="year" label="Year" defaultValue={year ?? ""}>
            <option value="">Not given</option>
            {[1, 2, 3, 4, 5, 6].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </SelectField>
          <div className="md:col-span-2">
            <RadioSegment name="planned_type" label="Planned student type" options={TYPE_OPTIONS} defaultValue="paid" />
          </div>
          <SelectField
            idPrefix="ns"
            name="planned_course_plan_id"
            label="Planned course plan"
            hint="Only pre-fills the Assign form. Not a booking."
            defaultValue=""
            className="md:col-span-2"
          >
            <option value="">Not decided</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {planLabel(p)}
              </option>
            ))}
          </SelectField>
        </FormGrid>
      </ActionForm>
      <Notice icon={<Info aria-hidden />}>Batch assignment is done next, in Student 360.</Notice>
    </Drawer>
  );
}
