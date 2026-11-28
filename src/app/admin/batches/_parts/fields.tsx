/** Form field shorthands for the Batches panels: label + control + hint + the field's server error. */
import * as React from "react";
import { Field, Input, Select } from "@/components/ui";
import { FieldError } from "@/components/toast";
import { WEEKDAYS } from "@/lib/labels";

type Common = { name: string; label: string; required?: boolean; hint?: React.ReactNode; className?: string; idPrefix?: string };

export function TextField({
  name,
  label,
  required,
  hint,
  className,
  idPrefix = "f",
  ...input
}: Common & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name">) {
  const id = `${idPrefix}-${name}`;
  return (
    <Field label={label} htmlFor={id} hint={hint} required={required} className={className}>
      <Input id={id} name={name} aria-required={required || undefined} {...input} />
      <FieldError name={name} />
    </Field>
  );
}

export function SelectField({
  name,
  label,
  required,
  hint,
  className,
  idPrefix = "f",
  children,
  ...select
}: Common & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name">) {
  const id = `${idPrefix}-${name}`;
  return (
    <Field label={label} htmlFor={id} hint={hint} required={required} className={className}>
      <Select id={id} name={name} aria-required={required || undefined} {...select}>
        {children}
      </Select>
      <FieldError name={name} />
    </Field>
  );
}

/** Class days as a row of checkboxes (name="days", ISO weekday numbers). */
export function DaysField({ defaultDays, className }: { defaultDays: number[]; className?: string }) {
  return (
    <fieldset className={className}>
      <legend className="mb-1.5 text-xs font-semibold text-fg-2">
        Class days<span className="text-bad"> *</span>
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAYS.map(([n, name]) => (
          <label key={n} className="cursor-pointer">
            <input type="checkbox" name="days" value={n} defaultChecked={defaultDays.includes(n)} className="peer sr-only" />
            <span className="inline-flex h-10 min-w-12 items-center justify-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-fg-2 peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent-ink peer-focus-visible:outline-2 peer-focus-visible:outline-accent md:h-9">
              {name}
            </span>
          </label>
        ))}
      </div>
      <FieldError name="days" />
    </fieldset>
  );
}

export function Hidden({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

export const Spacer = () => <span className="flex-1 max-md:hidden" />;
