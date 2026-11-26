import * as React from "react";
import { cn } from "@/lib/utils";
import { STATUS_TONE } from "@/lib/labels";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary: "bg-white text-navy border border-line hover:bg-tint",
  ghost: "text-ink hover:bg-tint",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-white p-4 sm:p-6", className)} {...props} />;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-navy">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        STATUS_TONE[status] ?? "bg-gray-100 text-gray-800",
      )}
    >
      {label ?? status}
    </span>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1 block text-sm font-semibold text-navy", className)} {...props} />;
}

const FIELD = "w-full min-h-11 rounded-lg border border-line bg-white px-3 text-sm text-navy placeholder:text-slate/70";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(FIELD, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, "min-h-24 py-2", className)} {...props} />;
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center">
      <p className="font-semibold text-navy">{title}</p>
      {children ? <div className="mt-2 text-sm text-slate">{children}</div> : null}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: React.ReactNode }) {
  const t = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    error: "border-red-200 bg-red-50 text-red-900",
    success: "border-green-200 bg-green-50 text-green-900",
  }[tone];
  return <div className={cn("rounded-lg border px-4 py-3 text-sm", t)}>{children}</div>;
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("leading-none", className)}>
      <span className="block font-[family-name:var(--font-display)] text-lg font-extrabold tracking-[0.18em]">QUELLFLOW</span>
      <span className="block text-[10px] font-semibold tracking-[0.35em] opacity-70">TECHNOLOGIES</span>
    </span>
  );
}
