/**
 * UI kit – mirrors the approved preview. No hooks here, so these work in server and client components.
 * Buttons: one primary per screen; icon buttons always carry a label (aria-label + tooltip via data-tip).
 */
import * as React from "react";
import Link from "next/link";
import { ChevronRight, Info } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import type { Tone } from "@/lib/types";

/* ---------- buttons ---------- */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";
const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover border border-accent hover:border-accent-hover",
  secondary: "bg-surface text-fg border border-line-strong hover:bg-hover",
  ghost: "text-fg-2 hover:bg-hover hover:text-fg border border-transparent",
  danger: "text-bad hover:bg-bad-soft border border-transparent",
};
const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-xs md:h-8",
  md: "h-10 px-4 text-sm md:h-9",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

const IB =
  "inline-grid shrink-0 place-items-center rounded-lg text-fg-2 transition-colors hover:bg-hover hover:text-fg size-10 md:size-9 [&_svg]:size-[18px]";
const IB_OUT = "border border-line-strong bg-surface";

/** Icon-only button. `label` becomes the accessible name and the tooltip. */
export function IconButton({
  label,
  outline,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string; outline?: boolean }) {
  return (
    <button type="button" aria-label={label} data-tip={label} className={cn(IB, outline && IB_OUT, className)} {...props}>
      {children}
    </button>
  );
}

export function IconLink({
  label,
  outline,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Link> & { label: string; outline?: boolean }) {
  return (
    <Link aria-label={label} data-tip={label} className={cn(IB, outline && IB_OUT, className)} {...props}>
      {children}
    </Link>
  );
}

/** External link as an icon (WhatsApp, Meet, GitHub…). Opens in a new tab. */
export function IconAnchor({
  label,
  outline,
  className,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { label: string; outline?: boolean }) {
  return (
    <a aria-label={label} data-tip={label} target="_blank" rel="noopener noreferrer" className={cn(IB, outline && IB_OUT, className)} {...props}>
      {children}
    </a>
  );
}

/** (i) – explains a section. Works on hover, keyboard focus and tap (see TooltipLayer). */
export function InfoTip({ text }: { text: string }) {
  return (
    <button
      type="button"
      className="qf-info inline-grid size-6 shrink-0 cursor-help place-items-center rounded-full text-fg-3 hover:bg-accent-soft hover:text-accent-ink"
      data-tip={text}
      aria-label={`What is this? ${text}`}
    >
      <Info className="size-4" aria-hidden />
    </button>
  );
}

/* ---------- status ---------- */
const TONE: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  vio: "bg-vio-soft text-vio",
  acc: "bg-accent-soft text-accent-ink",
  mute: "bg-surface-2 text-fg-2",
};
export const toneClass = (t: Tone) => TONE[t];

export function Pill({ tone = "mute", dot, children, className }: { tone?: Tone; dot?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-1.5 rounded-full px-2.5 text-xs leading-none font-semibold whitespace-nowrap", TONE[tone], className)}>
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}
/** @deprecated use Pill */
export const StatusBadge = ({ label, status }: { status: string; label?: string }) => <Pill>{label ?? status}</Pill>;

const AV: Tone[] = ["acc", "ok", "warn", "info", "vio"];
export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" | "xl" }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const s = { md: "size-8 text-xs", lg: "size-11 text-[15px]", xl: "size-15 text-xl" }[size];
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full font-bold", s, TONE[AV[h % AV.length]])}>
      {initials(name)}
    </span>
  );
}

export function Bar({ pct, tone = "acc", label }: { pct: number; tone?: "acc" | "ok" | "warn"; label?: string }) {
  const fill = { acc: "bg-accent", ok: "bg-ok", warn: "bg-warn" }[tone];
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={label ?? `${v}%`}>
      <span className={cn("block h-full rounded-full", fill)} style={{ width: `${v}%` }} />
    </span>
  );
}

/* ---------- layout ---------- */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("min-w-0 rounded-xl border border-line bg-surface", className)} {...props} />;
}

export function CardHeader({ title, info, actions, className }: { title: React.ReactNode; info?: string; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-13 items-center justify-between gap-3 border-b border-line px-4 py-3", className)}>
      <div className="flex min-w-0 items-center gap-1.5">
        <h2 className="text-md font-semibold">{title}</h2>
        {info ? <InfoTip text={info} /> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  info,
  actions,
  lead,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  info?: string;
  actions?: React.ReactNode;
  lead?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 items-center gap-3.5">
        {lead}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg font-bold md:text-xl">{title}</h1>
            {info ? <InfoTip text={info} /> : null}
          </div>
          {description ? <div className="mt-1 text-sm text-fg-2">{description}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-fg-3">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {it.href ? (
            <Link href={it.href} className="font-medium text-accent-ink no-underline">
              {it.label}
            </Link>
          ) : (
            <span>{it.label}</span>
          )}
          {i < items.length - 1 ? <ChevronRight className="size-3.5" aria-hidden /> : null}
        </React.Fragment>
      ))}
    </nav>
  );
}

/** Separate pieces of metadata with space, not "A · B · C". */
export function Meta({ items, className }: { items: React.ReactNode[]; className?: string }) {
  return (
    <span className={cn("inline-flex flex-wrap gap-x-3.5 gap-y-0.5", className)}>
      {items.filter(Boolean).map((x, i) => (
        <span key={i}>{x}</span>
      ))}
    </span>
  );
}

export function Kpi({
  label,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "ok" | "warn" | "bad";
  href?: string;
}) {
  const body = (
    <>
      <span className="text-sm font-medium text-fg-2">{label}</span>
      <span className="text-lg leading-tight font-bold md:text-xl">{value}</span>
      {sub ? <span className={cn("text-xs text-fg-3", tone && { ok: "text-ok", warn: "text-warn", bad: "text-bad" }[tone])}>{sub}</span> : null}
      {href ? <ChevronRight className="absolute top-3.5 right-3.5 size-4 text-fg-3" aria-hidden /> : null}
    </>
  );
  const cls = "relative flex min-w-0 flex-col gap-0.5 rounded-xl border border-line bg-surface p-3 md:px-4 md:py-3.5";
  return href ? (
    <Link href={href} className={cn(cls, "text-fg no-underline transition-colors hover:border-accent")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5 md:grid-cols-[repeat(auto-fit,minmax(160px,1fr))] md:gap-3">{children}</div>;
}

export function DL({ items }: { items: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(104px,max-content)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
      {items.map(([k, v], i) => (
        <React.Fragment key={i}>
          <dt className="text-fg-3">{k}</dt>
          <dd className="min-w-0 font-medium break-words">{v ?? "—"}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

/** Tabs and filter chips are links: the state lives in the URL. */
export function Tabs({ items, label }: { items: { href: string; label: string; count?: number; active: boolean }[]; label: string }) {
  return (
    <nav aria-label={label} className="flex gap-0.5 overflow-x-auto border-b border-line [scrollbar-width:none]">
      {items.map((t) => (
        <Link
          key={t.href + t.label}
          href={t.href}
          scroll={false}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap no-underline",
            t.active ? "border-accent font-semibold text-accent-ink" : "border-transparent font-medium text-fg-2 hover:text-fg",
          )}
        >
          {t.label}
          {t.count !== undefined ? <span className="rounded-full bg-surface-2 px-1.5 text-[11px] font-bold text-fg-2">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function Segmented({ items, label }: { items: { href: string; label: string; active: boolean }[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[9px] border border-line bg-surface-2 p-[3px] [scrollbar-width:none]">
      {items.map((s) => (
        <Link
          key={s.href + s.label}
          href={s.href}
          scroll={false}
          aria-current={s.active ? "true" : undefined}
          className={cn(
            "inline-flex h-8 items-center rounded-[7px] px-3 text-xs font-semibold whitespace-nowrap no-underline md:h-[30px]",
            s.active ? "bg-surface text-fg shadow-[0_0_0_1px_var(--line)]" : "text-fg-2 hover:text-fg",
          )}
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}

export function ChipLink({ href, active, tone, children }: { href: string; active?: boolean; tone?: "warn" | "bad"; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold whitespace-nowrap no-underline [&_svg]:size-3.5",
        tone === "warn" && "border-transparent bg-warn-soft text-warn",
        tone === "bad" && "border-transparent bg-bad-soft text-bad",
        !tone && (active ? "border-transparent bg-accent-soft text-accent-ink" : "border-line-strong bg-surface text-fg-2"),
      )}
    >
      {children}
    </Link>
  );
}

export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2.5">{children}</div>;
}

/* ---------- forms ---------- */
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-xs font-semibold text-fg-2", className)} {...props} />;
}

const FIELD =
  "h-11 w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3 text-base text-fg placeholder:text-fg-3 transition-colors focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none md:h-10 aria-[invalid=true]:border-bad disabled:bg-surface-2 disabled:text-fg-2";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, className)} {...props} />;
}
export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(FIELD, "pr-8", className)} {...props} />;
}
export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, "h-auto min-h-20 py-2.5", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-bad"> *</span> : null}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-bad">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-fg-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-3.5 md:grid-cols-2", className)}>{children}</div>;
}

export function Checkbox({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm", className)}>
      <input type="checkbox" className="mt-0.5 size-[18px] shrink-0 accent-[var(--accent)]" {...props} />
      <span>{label}</span>
    </label>
  );
}

/** Radio group styled as a segmented control (for forms). */
export function RadioSegment({
  name,
  options,
  defaultValue,
  label,
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  label: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-xs font-semibold text-fg-2">{label}</legend>
      <div className="inline-flex w-fit max-w-full gap-0.5 rounded-[9px] border border-line bg-surface-2 p-[3px]">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input type="radio" name={name} value={o.value} defaultChecked={o.value === defaultValue} className="peer sr-only" />
            <span className="inline-flex h-9 items-center rounded-[7px] px-3 text-xs font-semibold text-fg-2 peer-checked:bg-surface peer-checked:text-fg peer-checked:shadow-[0_0_0_1px_var(--line)] peer-focus-visible:outline-2 peer-focus-visible:outline-accent md:h-8">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/* ---------- messages ---------- */
export function Notice({ tone = "info", icon, children }: { tone?: "info" | "error" | "success" | "warn"; icon?: React.ReactNode; children: React.ReactNode }) {
  const t = { info: "bg-info-soft", error: "bg-bad-soft", success: "bg-ok-soft", warn: "bg-warn-soft" }[tone];
  const ic = { info: "text-info", error: "text-bad", success: "text-ok", warn: "text-warn" }[tone];
  return (
    <div role={tone === "error" ? "alert" : undefined} className={cn("flex items-start gap-2.5 rounded-[10px] px-3 py-2.5 text-sm text-fg", t)}>
      {icon ? <span className={cn("mt-0.5 [&_svg]:size-4", ic)}>{icon}</span> : null}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children ? <div className="max-w-md text-sm text-fg-2">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/* ---------- brand ---------- */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-[30px] shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id="qf-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4A63FF" />
          <stop offset="1" stopColor="#8B4DFF" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#qf-logo-g)" />
      <circle cx="15.2" cy="14.8" r="7" fill="none" stroke="#fff" strokeWidth="3.2" />
      <path d="M18.8 18.6 24 23.8" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Logo />
      <span className="leading-tight">
        <span className="block text-md font-bold">Quellflow</span>
        <span className="block text-xs text-fg-3">Internship Portal</span>
      </span>
    </span>
  );
}
