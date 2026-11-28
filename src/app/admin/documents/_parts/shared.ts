/** Shared shapes and URL helpers for the Documents screen. No server imports: the issue form (client) uses these too. */
import { PANEL_PARAMS, hrefWith, type SearchParams } from "@/lib/url";
import { DOC_GROUPS, type DocGroup } from "@/server/documents/rules";

export const DOCS_PATH = "/admin/documents";

/** Every param that opens or prefills a Documents panel (closing a panel drops them all). */
export const DOC_PANEL = {
  ...PANEL_PARAMS,
  type: null,
  enrollment: null,
  draft: null,
  preview: null,
  revoke: null,
} as const;

export const docHref = (params: SearchParams, changes: Record<string, string | number | null | undefined> = {}) =>
  hrefWith(DOCS_PATH, params, { ...DOC_PANEL, ...changes });

export const docFilterHref = (params: SearchParams, changes: Record<string, string | number | null | undefined>) =>
  hrefWith(DOCS_PATH, params, { ...DOC_PANEL, page: null, show: null, ...changes });

export const isUuid = (v: string | undefined | null): v is string =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export const isGroup = (v: string | undefined): v is DocGroup => DOC_GROUPS.some((g) => g.key === v);

export const STATUS_FILTER = [
  { value: "", label: "Any status" },
  { value: "draft", label: "Draft" },
  { value: "awaiting", label: "Awaiting" },
  { value: "accepted", label: "Accepted" },
  { value: "issued", label: "Issued" },
  { value: "revoked", label: "Revoked" },
  { value: "superseded", label: "Superseded" },
];

export const SHARED_VIA = [
  { value: "", label: "Not shared yet" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "in_person", label: "In person" },
];

/** One issue-form choice per student (enrolments and college projects ride along). */
export interface StudentChoice {
  id: string;
  label: string;
  enrolments: {
    id: string;
    label: string;
    type: string;
    status: string;
    attendance: number | null;
    tasks: number | null;
    eligible: boolean;
  }[];
  projects: { id: string; name: string; kind: string }[];
}

export interface TemplateChoice {
  id: string;
  type: string;
  version: number;
  title: string;
  background_path: string | null;
}

export interface SignatoryChoice {
  id: string;
  label: string;
  mine: boolean;
}

export interface IssueInitial {
  draftId: string;
  type: string;
  studentId: string;
  enrollmentId: string;
  projectId: string;
  body: string;
  eventTitle: string;
  eventDates: string;
  issueNote: string;
  signatoryId: string;
}
