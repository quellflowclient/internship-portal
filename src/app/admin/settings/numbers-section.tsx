import { Card, CardHeader, Notice } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { DOC_TYPE_LABEL } from "@/lib/labels";
import type { DocType } from "@/lib/types";

type Scheme = { kind: string; pattern: string };

const PROJECT_LABEL: Record<string, string> = { client: "Client project", college: "College project", internal: "Internal project" };

function kindLabel(kind: string): string {
  if (kind === "lead") return "Lead code";
  if (kind === "batch") return "Batch code";
  const [group, sub] = kind.split(":");
  if (group === "doc" && sub) return DOC_TYPE_LABEL[sub as DocType] ?? sub;
  if (group === "project" && sub) return PROJECT_LABEL[sub] ?? sub;
  return kind;
}

/** Sample values used for the preview (docs/19 DB-2). */
function sampleTokens(kind: string): Record<string, string> {
  if (kind === "batch") return { TRACK: "AA", DUR: "30", YYMM: "2612" };
  if (kind.startsWith("doc:")) return { TRACK: "AA" };
  return {};
}

const ORDER = (k: string) => (k === "lead" ? 0 : k === "batch" ? 1 : k.startsWith("doc:") ? 2 : 3);

export async function NumbersSection() {
  const supabase = await createClient();
  const { data } = await supabase.from("numbering_schemes").select("kind, pattern");
  const schemes = ((data ?? []) as Scheme[]).sort((a, b) => ORDER(a.kind) - ORDER(b.kind) || a.kind.localeCompare(b.kind));
  const previews = await Promise.all(
    schemes.map(async (s) => {
      const { data: code } = await supabase.rpc("preview_code", { p_kind: s.kind, p_tokens: sampleTokens(s.kind) });
      return typeof code === "string" ? code : null;
    }),
  );

  return (
    <>
      <Notice tone="info">
        Read-only for now. Sample values: track AA, 30 days, December 2026. Numbers are given out in order and never reused.
      </Notice>
      <Card>
        <CardHeader title="Document numbers" info="How codes for leads, batches, documents and projects are built. {AY} is the academic year, {SEQ} the running number." />
        {schemes.length ? (
          <ul>
            {schemes.map((s, i) => (
              <li key={s.kind} className="flex flex-col gap-1 border-t border-line px-4 py-3 first:border-t-0 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)] md:items-center md:gap-3">
                <b className="text-sm font-semibold">{kindLabel(s.kind)}</b>
                <code className="truncate font-mono text-xs text-fg-2">{s.pattern}</code>
                <span className="text-sm">
                  <span className="text-fg-3 md:hidden">Next: </span>
                  <b className="font-semibold tabular-nums">{previews[i] ?? "—"}</b>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-fg-3">No numbering rules yet. Run the seed once on this database.</p>
        )}
      </Card>
    </>
  );
}
