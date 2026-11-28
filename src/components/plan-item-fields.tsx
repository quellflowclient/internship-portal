/** Form fields shared by the batch plan item panel and the Settings template item panel. */
import * as React from "react";
import { FieldError } from "@/components/toast";
import { Field, FormGrid, Input, RadioSegment, Textarea } from "@/components/ui";
import { PLAN_KIND, PLAN_KINDS } from "@/lib/labels";
import { resourcesToText } from "@/lib/plan";
import type { PlanKind, PlanResource } from "@/lib/types";

const KIND_OPTIONS = PLAN_KINDS.map((k) => ({ value: k, label: PLAN_KIND[k].label }));

export type ItemContent = {
  title: string;
  kind: PlanKind;
  description: string | null;
  resources: PlanResource[] | null;
  duration_min: number | null;
};

/** Title, kind, `children` (date/week or week/day), duration, description and resources. */
export function ItemFields({ idp, item, children }: { idp: string; item?: ItemContent | null; children?: React.ReactNode }) {
  return (
    <>
      <Field label="Title" htmlFor={`${idp}-title`} required>
        <Input id={`${idp}-title`} name="title" defaultValue={item?.title ?? ""} maxLength={200} required />
        <FieldError name="title" />
      </Field>
      <div className="flex flex-col gap-1">
        <RadioSegment name="kind" label="Kind" options={KIND_OPTIONS} defaultValue={item?.kind ?? "session"} />
        <FieldError name="kind" />
      </div>
      <FormGrid>
        {children}
        <Field label="Duration in minutes" htmlFor={`${idp}-dur`} hint="Optional">
          <Input
            id={`${idp}-dur`}
            name="duration_min"
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            step={1}
            defaultValue={item?.duration_min ?? ""}
          />
          <FieldError name="duration_min" />
        </Field>
      </FormGrid>
      <Field label="Description" htmlFor={`${idp}-desc`} hint="Optional. Shown to students in the app.">
        <Textarea id={`${idp}-desc`} name="description" rows={3} maxLength={2000} defaultValue={item?.description ?? ""} />
        <FieldError name="description" />
      </Field>
      <Field
        label="Resources"
        htmlFor={`${idp}-res`}
        hint="One link per line, as Label | https://… Lines without an http or https link are left out."
      >
        <Textarea
          id={`${idp}-res`}
          name="resources"
          rows={3}
          className="font-mono text-sm"
          placeholder="Recording | https://youtube.com/…"
          defaultValue={resourcesToText(item?.resources)}
        />
        <FieldError name="resources" />
      </Field>
    </>
  );
}
