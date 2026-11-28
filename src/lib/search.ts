/** Search helpers shared by list screens (pure functions, safe in server and client code). */

/** Strips characters that would break a PostgREST `or=(…)` filter, and caps the length. */
export function safeSearch(q: string | undefined): string {
  return (q ?? "").replace(/[,()*%\\:"']/g, " ").trim().slice(0, 60);
}
