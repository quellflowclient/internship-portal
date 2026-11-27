/** Form field shorthands for the Students panels: label + control + hint + the field's server error. */
import * as React from "react";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { FieldError } from "@/components/toast";

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

export function TextAreaField({
  name,
  label,
  required,
  hint,
  className,
  idPrefix = "f",
  ...area
}: Common & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name">) {
  const id = `${idPrefix}-${name}`;
  return (
    <Field label={label} htmlFor={id} hint={hint} required={required} className={className}>
      <Textarea id={id} name={name} aria-required={required || undefined} {...area} />
      <FieldError name={name} />
    </Field>
  );
}
