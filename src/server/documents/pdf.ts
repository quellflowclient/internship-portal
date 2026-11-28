import "server-only";

/**
 * PDF on demand with pdfme (MIT). Nothing is stored: the route renders the frozen snapshot every time (docs/19 P6).
 * With a Canva background (document_templates.background_path) the variable fields are placed from
 * document_templates.layout ({ field: { x, y, width, height, fontSize, alignment } } in mm). Without one, a
 * built-in demo layout is used: A4 landscape certificate or A4 portrait letter.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Schema, Template } from "@pdfme/common";
import { generate } from "@pdfme/generator";
import { barcodes, image, line, rectangle, text } from "@pdfme/schemas";
import { DOC_TYPE_LABEL } from "@/lib/labels";
import type { DocType } from "@/lib/types";
import { isCertificateLayout } from "./rules";
import { printDate, type DocData } from "./snapshot";

export type Alignment = "left" | "center" | "right" | "justify";

export interface FieldBox {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  alignment?: Alignment;
}

export interface PdfDocument {
  type: DocType;
  number: string | null;
  data: Partial<DocData>;
}

export interface PdfTemplate {
  title?: string | null;
  layout?: Record<string, Partial<FieldBox>> | null;
  background_path?: string | null;
}

export interface PdfSignatory {
  name?: string | null;
  title?: string | null;
  signature?: string | null;
}

export interface RenderOptions {
  /** Big diagonal text, e.g. "DRAFT – not valid". */
  watermark?: string | null;
  /** Used to fetch the background over HTTP when the file is not on the server's disk. */
  origin?: string | null;
}

const BACKGROUND_PATH = /^\/templates\/[A-Za-z0-9._-]+\.pdf$/;
const INK = "#1d2433";
const MUTED = "#5b6475";
const ACCENT = "#4a63ff";

type Style = Partial<FieldBox> & { fontColor?: string; lineHeight?: number; dynamic?: [min: number, max: number] };
type FieldKind = "text" | "qr" | "image";

/** What each field prints. Layout JSON may use any of these names. */
function fieldValues(doc: PdfDocument, signatory: PdfSignatory | null, verifyUrl: string, certificate: boolean) {
  const d = doc.data;
  const name = d.name ?? "";
  const body = d.text ?? "";
  return {
    org: d.org_name ?? "Quellflow Technologies",
    title: d.title ?? DOC_TYPE_LABEL[doc.type],
    intro: "This is to certify that",
    name,
    body: certificate ? certificateLine(body, name) : body,
    issue_date: d.issue_date ? `Issued on ${printDate(d.issue_date)}` : "",
    date: d.issue_date ? `Date: ${printDate(d.issue_date)}` : "",
    number: doc.number ? `No. ${doc.number}` : "Draft, no number yet",
    qr: verifyUrl,
    verify: `Check this document at ${verifyUrl}`,
    signature: signatory?.signature ?? d.signature ?? "",
    signatory_name: signatory?.name ?? d.signatory ?? "",
    signatory_title: signatory?.title ?? d.signatory_title ?? "",
    programme: d.programme ?? "",
    batch: d.batch ?? "",
    start_date: printDate(d.start_date),
    end_date: printDate(d.end_date),
    result: d.result ?? "",
    role: d.role ?? "",
    project: d.project ?? "",
    event_title: d.event_title ?? "",
    event_dates: d.event_dates ?? "",
  } satisfies Record<string, string>;
}

type FieldName = keyof ReturnType<typeof fieldValues>;
const KIND: Partial<Record<FieldName, FieldKind>> = { qr: "qr", signature: "image" };

/**
 * On the certificate the intro line and the big name already say "This is to certify that <name>",
 * so a template sentence starting with exactly that continues after the name.
 */
export function certificateLine(body: string, name: string): string {
  const lead = `this is to certify that ${name}`.toLowerCase();
  const b = body.trim();
  if (name && b.toLowerCase().startsWith(lead)) return b.slice(lead.length).trim();
  return b;
}

/* ---------- demo layouts (mm) ---------- */
const CERT_FIELDS: Partial<Record<FieldName, Style>> = {
  org: { x: 20, y: 22, width: 257, height: 8, fontSize: 13, alignment: "center", fontColor: ACCENT },
  title: { x: 20, y: 36, width: 257, height: 14, fontSize: 28, alignment: "center", fontColor: INK },
  intro: { x: 20, y: 60, width: 257, height: 7, fontSize: 12, alignment: "center", fontColor: MUTED },
  name: { x: 20, y: 70, width: 257, height: 16, fontSize: 30, alignment: "center", fontColor: INK, dynamic: [16, 30] },
  body: { x: 38, y: 92, width: 221, height: 44, fontSize: 12.5, alignment: "center", fontColor: INK, lineHeight: 1.45 },
  qr: { x: 22, y: 152, width: 30, height: 30 },
  issue_date: { x: 56, y: 156, width: 95, height: 6, fontSize: 10, fontColor: INK },
  number: { x: 56, y: 163, width: 95, height: 6, fontSize: 10, fontColor: INK },
  verify: { x: 56, y: 170, width: 110, height: 10, fontSize: 7.5, fontColor: MUTED, lineHeight: 1.3 },
  signature: { x: 207, y: 146, width: 60, height: 20 },
  signatory_name: { x: 192, y: 170, width: 90, height: 6, fontSize: 11, alignment: "center", fontColor: INK },
  signatory_title: { x: 192, y: 176.5, width: 90, height: 6, fontSize: 9, alignment: "center", fontColor: MUTED },
};

const LETTER_FIELDS: Partial<Record<FieldName, Style>> = {
  org: { x: 20, y: 16, width: 120, height: 9, fontSize: 15, fontColor: ACCENT },
  number: { x: 120, y: 16, width: 70, height: 6, fontSize: 9, alignment: "right", fontColor: MUTED },
  date: { x: 120, y: 22, width: 70, height: 6, fontSize: 9, alignment: "right", fontColor: MUTED },
  title: { x: 20, y: 40, width: 170, height: 10, fontSize: 17, fontColor: INK },
  body: { x: 20, y: 56, width: 170, height: 170, fontSize: 11, fontColor: INK, lineHeight: 1.5 },
  signature: { x: 20, y: 232, width: 50, height: 18 },
  signatory_name: { x: 20, y: 252, width: 100, height: 6, fontSize: 11, fontColor: INK },
  signatory_title: { x: 20, y: 258, width: 100, height: 6, fontSize: 9, fontColor: MUTED },
  qr: { x: 165, y: 240, width: 25, height: 25 },
  verify: { x: 110, y: 267, width: 80, height: 10, fontSize: 7, alignment: "right", fontColor: MUTED, lineHeight: 1.3 },
};

/** Variable fields only, for a Canva background with no layout saved yet. */
const VARIABLE_FIELDS: FieldName[] = [
  "name",
  "body",
  "issue_date",
  "date",
  "number",
  "qr",
  "verify",
  "signature",
  "signatory_name",
  "signatory_title",
];

function textSchema(name: string, s: Style): Schema {
  return {
    name,
    type: "text",
    position: { x: s.x ?? 0, y: s.y ?? 0 },
    width: s.width ?? 60,
    height: s.height ?? 8,
    fontSize: s.fontSize ?? 11,
    alignment: s.alignment ?? "left",
    verticalAlignment: "top",
    lineHeight: s.lineHeight ?? 1.25,
    characterSpacing: 0,
    fontColor: s.fontColor ?? INK,
    backgroundColor: "",
    ...(s.dynamic ? { dynamicFontSize: { min: s.dynamic[0], max: s.dynamic[1], fit: "horizontal" } } : {}),
  } as Schema;
}

function fieldSchema(name: string, s: Style): Schema {
  const kind = KIND[name as FieldName] ?? "text";
  const base = { name, position: { x: s.x ?? 0, y: s.y ?? 0 }, width: s.width ?? 30, height: s.height ?? 30 };
  if (kind === "qr") return { ...base, type: "qrcode", backgroundColor: "#ffffff", barColor: "#000000" } as Schema;
  if (kind === "image") return { ...base, type: "image" } as Schema;
  return textSchema(name, s);
}

function decorations(certificate: boolean): Schema[] {
  if (certificate) {
    return [
      { name: "frame_outer", type: "rectangle", position: { x: 8, y: 8 }, width: 281, height: 194, borderWidth: 1.2, borderColor: ACCENT, color: "", readOnly: true },
      { name: "frame_inner", type: "rectangle", position: { x: 12, y: 12 }, width: 273, height: 186, borderWidth: 0.3, borderColor: "#b7c0ff", color: "", readOnly: true },
      { name: "rule", type: "line", position: { x: 118.5, y: 54 }, width: 60, height: 0.4, color: ACCENT, readOnly: true },
      { name: "sign_rule", type: "line", position: { x: 202, y: 168 }, width: 70, height: 0.3, color: "#9aa3b5", readOnly: true },
    ] as Schema[];
  }
  return [
    { name: "head_rule", type: "line", position: { x: 20, y: 30 }, width: 170, height: 0.4, color: ACCENT, readOnly: true },
    { name: "sign_rule", type: "line", position: { x: 20, y: 251 }, width: 60, height: 0.3, color: "#9aa3b5", readOnly: true },
  ] as Schema[];
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Merges a saved layout over defaults. Only finite numbers and known alignments are taken from the JSON. */
function mergeBox(base: Style | undefined, saved: Partial<FieldBox> | undefined): Style | null {
  if (!saved) return base ?? null;
  const s: Style = { ...(base ?? {}) };
  for (const k of ["x", "y", "width", "height", "fontSize"] as const) if (isNum(saved[k])) s[k] = saved[k];
  if (saved.alignment && ["left", "center", "right", "justify"].includes(saved.alignment)) s.alignment = saved.alignment;
  if (!isNum(s.x) || !isNum(s.y) || !isNum(s.width) || !isNum(s.height)) return null;
  return s;
}

/** Reads public/templates/<file>.pdf from disk, or over HTTP from the site when the file is not bundled. */
export async function loadBackground(backgroundPath: string, origin?: string | null): Promise<Uint8Array | null> {
  if (!BACKGROUND_PATH.test(backgroundPath)) return null;
  try {
    return new Uint8Array(await readFile(path.join(process.cwd(), "public", backgroundPath)));
  } catch {
    if (!origin) return null;
    try {
      const res = await fetch(new URL(backgroundPath, origin), { cache: "no-store" });
      return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
    } catch {
      return null;
    }
  }
}

/** Renders one document. `signatory` overrides the snapshot's signatory (used for the template preview). */
export async function renderPdf(
  doc: PdfDocument,
  template: PdfTemplate | null,
  signatory: PdfSignatory | null,
  verifyUrl: string,
  opts: RenderOptions = {},
): Promise<Uint8Array> {
  const certificate = isCertificateLayout(doc.type);
  const values = fieldValues(doc, signatory, verifyUrl, certificate);
  const layout = template?.layout && typeof template.layout === "object" ? template.layout : {};
  const background = template?.background_path ? await loadBackground(template.background_path, opts.origin) : null;

  const page = certificate ? { width: 297, height: 210 } : { width: 210, height: 297 };
  const demo = certificate ? CERT_FIELDS : LETTER_FIELDS;
  const schemas: Schema[] = background ? [] : decorations(certificate);
  const inputs: Record<string, string> = {};

  // Which fields to place: with a background, the saved layout (or the variable fields of the demo layout);
  // without one, the full demo layout plus any extra field named in the layout.
  const layoutNames = Object.keys(layout);
  const names: string[] = background
    ? layoutNames.length
      ? layoutNames
      : VARIABLE_FIELDS.filter((n) => demo[n])
    : [...new Set([...Object.keys(demo), ...layoutNames])];

  for (const name of names) {
    if (!Object.prototype.hasOwnProperty.call(values, name)) continue;
    const value = values[name as FieldName];
    const kind = KIND[name as FieldName] ?? "text";
    if (!value && kind !== "text") continue; // no signature image yet, no QR target
    const box = mergeBox(demo[name as FieldName], layout[name]);
    if (!box) continue;
    schemas.push(fieldSchema(name, box));
    inputs[name] = value;
  }

  if (opts.watermark) {
    const w = certificate ? 230 : 180;
    schemas.push({
      ...textSchema("watermark", {
        x: (page.width - w) / 2,
        y: page.height / 2 - 12,
        width: w,
        height: 24,
        fontSize: certificate ? 40 : 34,
        alignment: "center",
        fontColor: "#d92d20",
      }),
      rotate: certificate ? 340 : 315,
      opacity: 0.22,
    } as Schema);
    inputs.watermark = opts.watermark;
  }

  const tpl: Template = {
    basePdf: background ?? { width: page.width, height: page.height, padding: [0, 0, 0, 0] },
    schemas: [schemas],
  } as Template;

  return generate({
    template: tpl,
    inputs: [inputs],
    plugins: { text, image, qrcode: barcodes.qrcode, line, rectangle },
    options: { title: `${values.title}${doc.number ? ` ${doc.number}` : ""}`, author: values.org, creator: "Quellflow Internship Portal" },
  });
}
