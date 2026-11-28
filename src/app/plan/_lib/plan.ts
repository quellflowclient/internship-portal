/**
 * Plan helpers shared by the batch Plan tab, the public share page, the template editor and their
 * server actions (pure functions and zod pieces only – no "use server", no React).
 */
import { z } from "zod";
import { optionalText, requiredText } from "@/lib/validators";
import type { PlanKind, PlanResource } from "@/lib/types";

const IST = "Asia/Kolkata";

export const KIND_VALUES = ["session", "task", "test", "milestone", "buffer"] as const satisfies readonly PlanKind[];

/** "Label | https://…" per line → [{label, url}]. Lines without an http(s) link are dropped. */
export function parseResources(text: string | null | undefined): PlanResource[] {
  const out: PlanResource[] = [];
  for (const raw of (text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const bar = line.lastIndexOf("|");
    const label = (bar >= 0 ? line.slice(0, bar) : "").trim();
    const url = (bar >= 0 ? line.slice(bar + 1) : line).trim();
    if (!/^https?:\/\/\S+$/i.test(url)) continue;
    let host = url;
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    out.push({ label: (label || host).slice(0, 80), url: url.slice(0, 500) });
    if (out.length >= 20) break;
  }
  return out;
}

export function resourcesToText(list: PlanResource[] | null | undefined): string {
  return (list ?? []).map((r) => `${r.label} | ${r.url}`).join("\n");
}

/** Only http(s) links are rendered as links (data from the database is still checked). */
export const safeHref = (url: string | null | undefined) => (url && /^https?:\/\//i.test(url) ? url : undefined);

const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

/** Week number of `date` in a batch starting `start`, weeks running Monday to Sunday (week 1 holds the start date). */
export function weekOf(date: string, start: string): number {
  const monday = (n: number) => n - ((n + 3) % 7); // 1970-01-01 was a Thursday
  return Math.max(1, Math.floor((monday(dayNumber(date)) - monday(dayNumber(start))) / 7) + 1);
}

/** "7–11 Dec", "28 Dec to 3 Jan" or "8 Dec" */
export function shortRange(from: string, to: string): string {
  const f = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...o, timeZone: IST }).format(new Date(`${d}T00:00:00+05:30`));
  if (from === to) return f(from, { day: "numeric", month: "short" });
  if (from.slice(0, 7) === to.slice(0, 7)) return `${f(from, { day: "numeric" })}–${f(to, { day: "numeric", month: "short" })}`;
  return `${f(from, { day: "numeric", month: "short" })} to ${f(to, { day: "numeric", month: "short" })}`;
}

/** Groups items (already sorted) by week number, with the date range of each week's items. */
export function groupByWeek<T extends { week: number }>(items: T[], dateOf: (t: T) => string | null) {
  const map = new Map<number, T[]>();
  for (const it of items) {
    const list = map.get(it.week) ?? [];
    list.push(it);
    map.set(it.week, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, list]) => {
      const dates = list.map(dateOf).filter((d): d is string => !!d).sort();
      return { week, items: list, range: dates.length ? shortRange(dates[0], dates[dates.length - 1]) : "" };
    });
}

/* ---------- zod pieces for item forms ---------- */
export const optionalWholeNumber = (label: string, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be a whole number from 1 to ${max}` });
        return z.NEVER;
      }
      return n;
    });

export const wholeNumber = (label: string, max: number) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = Number(v);
      if (v === "" || !Number.isInteger(n) || n < 1 || n > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be a whole number from 1 to ${max}` });
        return z.NEVER;
      }
      return n;
    });

/** Fields shared by batch plan items and template items. */
export const itemContentSchema = z.object({
  title: requiredText(200, "Title"),
  kind: z.enum(KIND_VALUES, { message: "Pick a kind" }),
  description: optionalText(2000),
  resources: z
    .string()
    .optional()
    .transform((v) => parseResources(v)),
  duration_min: optionalWholeNumber("Duration", 600),
});
