import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeSignature } from "@/lib/hmac";
import { MAX_IMPORT_BATCH, parseImportBody, safeCvUrl, safeWebUrl, toUpsertArgs, type Application } from "@/lib/leads/import";
import { answerRows, daysAgoText, isDue, prettySummary, searchTerm } from "@/lib/leads/view";

/** Same shape as recToPayload_ in scripts/apps-script/portal_sync.gs */
const payload = (over: Record<string, unknown> = {}) => ({
  candidate_code: "QF-INT-0007",
  form_response_id: "2_ABaOnudABC",
  submitted_at: "2026-11-27T10:15:00.000Z",
  email: "  Riya.Shah@Example.COM ",
  full_name: "  Riya Shah ",
  phone: "98765 43210",
  city: "Rajkot",
  college: "Marwadi University",
  degree: "B.Tech CE",
  year_of_study: "3",
  role_label: "AI Automation",
  skills: "Python, n8n",
  portfolio_url: "https://github.com/riya",
  prev_internship: "",
  cv_url: "https://drive.google.com/open?id=abc\nhttps://drive.google.com/open?id=second",
  can_start: "Immediately",
  hours_per_week: "20",
  work_mode: "Remote",
  extra: "",
  ...over,
});

function one(over: Record<string, unknown> = {}): Application {
  const r = parseImportBody(payload(over));
  if (!r.ok) throw new Error(r.issues.join("; "));
  expect(r.items).toHaveLength(1);
  return r.items[0];
}

describe("parseImportBody", () => {
  it("accepts a single application and trims text", () => {
    const a = one();
    expect(a.full_name).toBe("Riya Shah");
    expect(a.form_response_id).toBe("2_ABaOnudABC");
  });

  it("accepts a batch", () => {
    const r = parseImportBody({ applicants: [payload(), payload({ form_response_id: "r2", full_name: "Aman" })] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.items.map((i) => i.form_response_id)).toEqual(["2_ABaOnudABC", "r2"]);
  });

  it("rejects an empty batch (testPortalConnection relies on this 422)", () => {
    const r = parseImportBody({ applicants: [] });
    expect(r.ok).toBe(false);
  });

  it("rejects a batch over the limit", () => {
    const r = parseImportBody({ applicants: Array.from({ length: MAX_IMPORT_BATCH + 1 }, (_, i) => payload({ form_response_id: `r${i}` })) });
    expect(r.ok).toBe(false);
  });

  it("requires form_response_id and full_name", () => {
    const r = parseImportBody(payload({ form_response_id: "  ", full_name: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.join(" ")).toMatch(/form_response_id/);
      expect(r.issues.join(" ")).toMatch(/full_name/);
    }
  });

  it("reports the item index for batch errors", () => {
    const r = parseImportBody({ applicants: [payload(), payload({ full_name: "" })] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]).toMatch(/^applicants\.1\.full_name/);
  });

  it("treats missing and null fields as empty, numbers as text", () => {
    const a = one({ city: null, extra: undefined, year_of_study: 3, hours_per_week: 20 });
    expect(a.city).toBe("");
    expect(a.extra).toBe("");
    expect(a.year_of_study).toBe("3");
  });

  it("rejects non-objects and over-long text", () => {
    expect(parseImportBody(null).ok).toBe(false);
    expect(parseImportBody("hello").ok).toBe(false);
    expect(parseImportBody([payload()]).ok).toBe(false);
    expect(parseImportBody(payload({ skills: "x".repeat(2001) })).ok).toBe(false);
  });
});

describe("toUpsertArgs", () => {
  it("maps the form to upsert_form_lead arguments", () => {
    const args = toUpsertArgs(one());
    expect(args).toMatchObject({
      p_form_response_id: "2_ABaOnudABC",
      p_full_name: "Riya Shah",
      p_email: "riya.shah@example.com",
      p_phone: "+919876543210",
      p_college: "Marwadi University",
      p_course: "B.Tech CE",
      p_year: "3",
      p_track: "AI Automation",
      p_submitted_at: "2026-11-27T10:15:00.000Z",
    });
  });

  it("keeps the form's own ID and drops empty answers", () => {
    const { p_answers } = toUpsertArgs(one());
    expect(p_answers.form_candidate_id).toBe("QF-INT-0007");
    expect(p_answers.city).toBe("Rajkot");
    expect(p_answers.cv_url).toBe("https://drive.google.com/open?id=abc");
    expect("prev_internship" in p_answers).toBe(false);
    expect("extra" in p_answers).toBe(false);
    // stored in their own columns, not repeated in answers
    expect("degree" in p_answers).toBe(false);
    expect("full_name" in p_answers).toBe(false);
  });

  it("keeps only safe links", () => {
    const { p_answers } = toUpsertArgs(one({ cv_url: "http://drive.google.com/x", portfolio_url: "javascript:alert(1)" }));
    expect(p_answers.cv_url).toBeUndefined();
    expect(p_answers.portfolio_url).toBeUndefined();
    expect(toUpsertArgs(one({ portfolio_url: "http://riya.dev" })).p_answers.portfolio_url).toBe("http://riya.dev");
  });

  it("stores bad phone/email as null and keeps what was typed", () => {
    const args = toUpsertArgs(one({ phone: "12345", email: "not-an-email" }));
    expect(args.p_phone).toBeNull();
    expect(args.p_email).toBeNull();
    expect(args.p_answers.phone_as_typed).toBe("12345");
    expect(args.p_answers.email_as_typed).toBe("not-an-email");
  });

  it("normalises phone formats and empty optional columns", () => {
    const args = toUpsertArgs(one({ phone: "+91 98765-43210", college: "", degree: "", role_label: "", submitted_at: "garbage" }));
    expect(args.p_phone).toBe("+919876543210");
    expect(args.p_college).toBeNull();
    expect(args.p_course).toBeNull();
    expect(args.p_track).toBeNull();
    expect(args.p_submitted_at).toBeNull();
  });
});

describe("link guards", () => {
  it.each([
    ["https://drive.google.com/a", "https://drive.google.com/a"],
    ["  https://x.com/a  \nmore", "https://x.com/a"],
    ["http://x.com/a", null],
    ["drive.google.com/a", null],
    ["", null],
  ])("cv %j -> %j", (input, expected) => expect(safeCvUrl(input)).toBe(expected));

  it.each([
    ["https://github.com/a", "https://github.com/a"],
    ["http://a.dev", "http://a.dev"],
    ["github.com/a", null],
    ["javascript:alert(1)", null],
    ["https://has space.com", null],
  ])("web %j -> %j", (input, expected) => expect(safeWebUrl(input)).toBe(expected));
});

describe("lead view helpers", () => {
  it("due only for open stages on or before today", () => {
    expect(isDue("2026-11-27", "new", "2026-11-27")).toBe(true);
    expect(isDue("2026-11-20", "counselling", "2026-11-27")).toBe(true);
    expect(isDue("2026-11-28", "new", "2026-11-27")).toBe(false);
    expect(isDue("2026-11-20", "lost", "2026-11-27")).toBe(false);
    expect(isDue(null, "new", "2026-11-27")).toBe(false);
  });

  it("age in IST calendar days", () => {
    expect(daysAgoText("2026-11-27T05:00:00Z", "2026-11-27")).toBe("today");
    expect(daysAgoText("2026-11-26T20:00:00Z", "2026-11-27")).toBe("today"); // 01:30 IST on the 27th
    expect(daysAgoText("2026-11-26T10:00:00Z", "2026-11-27")).toBe("yesterday");
    expect(daysAgoText("2026-11-22T10:00:00Z", "2026-11-27")).toBe("5 days ago");
    expect(daysAgoText(null, "2026-11-27")).toBe("");
  });

  it("answer rows skip empty values and link only http(s)", () => {
    const rows = answerRows({ city: "Rajkot", extra: "", cv_url: "https://drive.google.com/x", portfolio_url: "javascript:x", tags: ["a", "b"], n: null });
    expect(rows.map((r) => r.key)).toEqual(["city", "cv_url", "portfolio_url", "tags"]);
    expect(rows.find((r) => r.key === "cv_url")?.href).toBe("https://drive.google.com/x");
    expect(rows.find((r) => r.key === "portfolio_url")?.href).toBeUndefined();
    expect(rows.find((r) => r.key === "tags")?.text).toBe("a, b");
    expect(rows[0].label).toBe("City");
  });

  it("prettifies stage-change summaries only", () => {
    expect(prettySummary("Stage changed from new to contacted")).toBe("Stage changed from New to Contacted");
    expect(prettySummary("Told them about the new batch")).toBe("Told them about the new batch");
  });

  it("search term drops filter syntax and finds phone digits", () => {
    expect(searchTerm("  ")).toBeNull();
    expect(searchTerm("Riya, (x)")?.text).toBe("Riya x");
    expect(searchTerm("98765 43210")?.digits).toBe("9876543210");
    expect(searchTerm("QF-2627-0012")?.digits).toBe("26270012");
    expect(searchTerm("ab")?.digits).toBe("");
  });
});

/* ---------- the route itself (Supabase mocked) ---------- */
const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

describe("POST /api/leads/import", () => {
  const secret = "s".repeat(40);
  beforeEach(() => {
    process.env.IMPORT_SECRET = secret;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "k".repeat(40);
    rpc.mockReset();
    let n = 0;
    rpc.mockImplementation(async () => ({ data: `QF-2627-${String(++n).padStart(4, "0")}`, error: null }));
  });

  async function post(body: string, opts: { sign?: boolean; ts?: string } = {}) {
    const { POST } = await import("@/app/api/leads/import/route");
    const ts = opts.ts ?? String(Math.floor(Date.now() / 1000));
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (opts.sign !== false) {
      headers["x-qf-timestamp"] = ts;
      headers["x-qf-signature"] = "sha256=" + computeSignature(secret, ts, body);
    }
    return POST(new Request("http://localhost/api/leads/import", { method: "POST", body, headers }));
  }

  it("401 without a valid signature", async () => {
    expect((await post(JSON.stringify(payload()), { sign: false })).status).toBe(401);
    expect((await post(JSON.stringify(payload()), { ts: "1000000000" })).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("413 over 2 MB", async () => {
    expect((await post("x".repeat(2 * 1024 * 1024 + 1))).status).toBe(413);
  });

  it("422 for bad JSON or an empty batch", async () => {
    expect((await post("{nope")).status).toBe(422);
    expect((await post(JSON.stringify({ applicants: [] }))).status).toBe(422);
  });

  it("200 with the portal codes, one upsert per item", async () => {
    const res = await post(JSON.stringify({ applicants: [payload(), payload({ form_response_id: "r2" })] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      codes: [
        { form_response_id: "2_ABaOnudABC", code: "QF-2627-0001" },
        { form_response_id: "r2", code: "QF-2627-0002" },
      ],
    });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][0]).toBe("upsert_form_lead");
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_phone: "+919876543210", p_email: "riya.shah@example.com" });
  });

  it("500 when a row fails, still reporting the saved ones", async () => {
    rpc.mockImplementationOnce(async () => ({ data: null, error: { message: "boom" } }));
    const res = await post(JSON.stringify({ applicants: [payload(), payload({ form_response_id: "r2" })] }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.failed).toEqual([{ form_response_id: "2_ABaOnudABC", error: "boom" }]);
    expect(body.codes).toHaveLength(1);
  });

  it("the old /api/applicants/import URL is the same handler", async () => {
    const oldRoute = await import("@/app/api/applicants/import/route");
    const newRoute = await import("@/app/api/leads/import/route");
    expect(oldRoute.POST).toBe(newRoute.POST);
  });
});
