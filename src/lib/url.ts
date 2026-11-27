/** URL state helpers: filters, tab, page and the open panel all live in the query string (docs/19 DB-13). */

export type SearchParams = Record<string, string | string[] | undefined>;

export function sp(params: SearchParams, key: string): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v || undefined;
}

/** Builds `path?…` from the current params plus changes (null/undefined/"" removes a key). */
export function hrefWith(
  path: string,
  params: SearchParams,
  changes: Record<string, string | number | null | undefined> = {},
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) q.set(k, s);
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === undefined || v === "") q.delete(k);
    else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** Params that open a panel; a filter change always closes the panel. */
const PANEL_PARAMS = { open: null, new: null, lost: null, panel: null, e: null, lead: null } as const;

/** Same as hrefWith but resets paging and closes any panel – use for every filter change. */
export function filterHref(path: string, params: SearchParams, changes: Record<string, string | number | null | undefined>) {
  return hrefWith(path, params, { ...PANEL_PARAMS, page: null, show: null, ...changes });
}

export const PAGE_SIZE = 10;

/**
 * Desktop pages with ?page=N; phones append with "View more" (?show=20, 30 …).
 * Returns the range to fetch.
 */
export function paging(params: SearchParams, per = PAGE_SIZE) {
  const show = Math.min(Math.max(Number(sp(params, "show")) || 0, 0), 500);
  const page = Math.max(Number(sp(params, "page")) || 1, 1);
  if (show > 0) return { page: 1, show, from: 0, to: show - 1, per };
  return { page, show: 0, from: (page - 1) * per, to: page * per - 1, per };
}
