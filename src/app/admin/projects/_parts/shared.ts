/** Shared shapes, labels and URL helpers for the Projects screens. No server imports: client forms use these too. */
import { PANEL_PARAMS, hrefWith, type SearchParams } from "@/lib/url";
import type { Tone } from "@/lib/types";

export const PROJECTS_PATH = "/admin/projects";

export type ProjectKind = "client" | "college" | "internal";
export type ProjectStatus = "planned" | "active" | "on_hold" | "completed" | "cancelled";
export type TaskStatus = "todo" | "doing" | "review" | "done";
export type ReportStatus = "not_started" | "draft" | "reviewed" | "submitted" | "approved";

export const KINDS: ProjectKind[] = ["client", "college", "internal"];
export const KIND: Record<ProjectKind, { label: string; tone: Tone; short: string }> = {
  client: { label: "Client", tone: "warn", short: "CL" },
  college: { label: "College", tone: "info", short: "CO" },
  internal: { label: "Internal", tone: "mute", short: "IN" },
};

export const STATUSES: ProjectStatus[] = ["planned", "active", "on_hold", "completed", "cancelled"];
export const STATUS: Record<ProjectStatus, { label: string; tone: Tone }> = {
  planned: { label: "Planned", tone: "info" },
  active: { label: "Active", tone: "ok" },
  on_hold: { label: "On hold", tone: "warn" },
  completed: { label: "Completed", tone: "mute" },
  cancelled: { label: "Cancelled", tone: "bad" },
};

/** docs/19 §6 – the same moves the database allows (guard_projects). Button text per move. */
export const NEXT_STATUS: Record<ProjectStatus, { to: ProjectStatus; label: string }[]> = {
  planned: [
    { to: "active", label: "Start" },
    { to: "cancelled", label: "Cancel project" },
  ],
  active: [
    { to: "completed", label: "Mark completed" },
    { to: "on_hold", label: "Put on hold" },
    { to: "cancelled", label: "Cancel project" },
  ],
  on_hold: [
    { to: "active", label: "Resume" },
    { to: "cancelled", label: "Cancel project" },
  ],
  completed: [{ to: "active", label: "Reopen" }],
  cancelled: [{ to: "planned", label: "Reopen" }],
};

export const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "review", "done"];
export const TASK_STATUS: Record<TaskStatus, { label: string; tone: Tone }> = {
  todo: { label: "To do", tone: "mute" },
  doing: { label: "Doing", tone: "info" },
  review: { label: "Review", tone: "vio" },
  done: { label: "Done", tone: "ok" },
};

export const REPORT_STATUSES: ReportStatus[] = ["not_started", "draft", "reviewed", "submitted", "approved"];
export const REPORT_STATUS: Record<ReportStatus, { label: string; tone: Tone }> = {
  not_started: { label: "Not started", tone: "mute" },
  draft: { label: "Draft", tone: "info" },
  reviewed: { label: "Reviewed", tone: "vio" },
  submitted: { label: "Submitted", tone: "acc" },
  approved: { label: "Approved", tone: "ok" },
};
/** A college report is "pending" until it is submitted or approved. */
export const REPORT_PENDING: ReportStatus[] = ["not_started", "draft", "reviewed"];

export const VISIBILITY = [
  { value: "", label: "Not set" },
  { value: "private", label: "Private" },
  { value: "org", label: "Quellflow org" },
  { value: "public", label: "Public" },
];

/** Every param that opens a Projects panel (closing a panel drops them all). */
export const PROJECT_PANEL = { ...PANEL_PARAMS } as const;

export const projectHref = (params: SearchParams, changes: Record<string, string | number | null | undefined> = {}) =>
  hrefWith(PROJECTS_PATH, params, { ...PROJECT_PANEL, ...changes });

export const projectFilterHref = (params: SearchParams, changes: Record<string, string | number | null | undefined>) =>
  hrefWith(PROJECTS_PATH, params, { ...PROJECT_PANEL, page: null, show: null, ...changes });

/** Link used by other screens (Batch → Projects, Student 360): the one place projects are edited. */
export const openProjectHref = (code: string) => `${PROJECTS_PATH}?open=${encodeURIComponent(code)}`;

export const isUuid = (v: string | undefined | null): v is string =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** "https://github.com/quellflow/clinic-ai" → "quellflow/clinic-ai" */
export function shortUrl(url: string | null | undefined): string {
  if (!url) return "";
  return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/^github\.com\//i, "").replace(/\/$/, "");
}

/** Option lists handed from the server panels to the client form. */
export interface Choice {
  value: string;
  label: string;
}

export interface ProjectInitial {
  id: string;
  code: string;
  kind: ProjectKind;
  name: string;
  description: string;
  status: ProjectStatus;
  batch_id: string;
  lead_admin_id: string;
  start_date: string;
  due_date: string;
  github_url: string;
  github_visibility: string;
  demo_url: string;
  docs_url: string;
  client_name: string;
  client_contact: string;
  college_name: string;
  guide_name: string;
  submission_due: string;
  report_status: string;
}
