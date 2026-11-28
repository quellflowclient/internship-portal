"use client";

/** Course plan select for New batch. Warns when the chosen plan has no active template (the plan starts empty). */
import * as React from "react";
import { Field, Select } from "@/components/ui";
import { FieldError } from "@/components/toast";

export function PlanSelect({ options }: { options: { id: string; label: string; hasTemplate: boolean }[] }) {
  const [value, setValue] = React.useState(options[0]?.id ?? "");
  const chosen = options.find((o) => o.id === value);
  return (
    <Field
      label="Course plan"
      htmlFor="nb-course_plan_id"
      required
      className="md:col-span-2"
      hint={chosen && !chosen.hasTemplate ? "No plan template yet, so the plan will start empty." : "The plan items are copied from this course plan’s template."}
    >
      <Select id="nb-course_plan_id" name="course_plan_id" aria-required value={value} onChange={(e) => setValue(e.target.value)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>
      <FieldError name="course_plan_id" />
    </Field>
  );
}
