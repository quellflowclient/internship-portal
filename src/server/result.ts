import type { ZodError } from "zod";

/**
 * What every server action returns to <ActionForm>.
 * ok   → toast `message`; if `undoId` is set the toast offers Undo; then the panel closes or `redirectTo` opens.
 * fail → errors shown at the top of the form (and next to fields when `fieldErrors` is set).
 */
export type ActionResult =
  | { ok: true; message: string; undoId?: string; redirectTo?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }
  | null;

export const done = (message: string, extra: { undoId?: string; redirectTo?: string } = {}): ActionResult => ({
  ok: true,
  message,
  ...extra,
});

export const fail = (message: string, fieldErrors?: Record<string, string>): ActionResult => ({
  ok: false,
  message,
  fieldErrors,
});

export function fromZod(err: ZodError): ActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fail("Please fix the highlighted fields.", fieldErrors);
}

/** Turns a Supabase/Postgres error into words a person can act on. */
export function fromDb(error: { message?: string; code?: string } | null | undefined): ActionResult {
  const msg = error?.message ?? "Something went wrong. Try again.";
  if (error?.code === "23505") return fail("This already exists. Check for a duplicate.");
  if (error?.code === "42501" || /not allowed|row-level security/i.test(msg)) return fail("You don’t have permission to do this.");
  if (error?.code === "23514") return fail("Some required information is missing for this change.");
  return fail(msg.replace(/^ERROR:\s*/i, ""));
}
