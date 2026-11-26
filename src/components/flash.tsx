import { Notice } from "@/components/ui";

/** Shows ?ok= / ?error= messages set by server actions (see server/guard.ts back()). */
export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return <div className="mb-4">{error ? <Notice tone="error">{error}</Notice> : <Notice tone="success">{ok}</Notice>}</div>;
}
