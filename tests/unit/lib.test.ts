import { describe, expect, it } from "vitest";
import { formatPhone, toE164India } from "@/lib/phone";
import { passwordProblem } from "@/lib/password";
import { computeSignature, verifySignature } from "@/lib/hmac";
import { importBodySchema, resolveRoleCode, toApplicantRow } from "@/lib/applicants/import";
import { batchSchema, convertSchema, numberingSchema } from "@/lib/validators";

describe("phone", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["+919876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["91-98765-43210", "+919876543210"],
    ["5876543210", null],
    ["12345", null],
    ["", null],
  ])("%s -> %s", (input, expected) => expect(toE164India(input)).toBe(expected));

  it("formats for display", () => {
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
    expect(formatPhone(null)).toBe("—");
  });
});

describe("password policy", () => {
  it.each([
    ["short1", false],
    ["onlyletterslong", false],
    ["1234567890123", false],
    ["Quellflow2026", true],
    ["a".repeat(70) + "12", true],
    ["a".repeat(72) + "1", false],
  ])("%s -> ok=%s", (pw, ok) => expect(passwordProblem(pw) === null).toBe(ok));
});

describe("hmac", () => {
  const secret = "x".repeat(40);
  const body = '{"a":1}';
  const now = 1_800_000_000;
  const ts = String(now);
  const sig = computeSignature(secret, ts, body);

  it("accepts a valid signature", () => {
    expect(verifySignature({ secret, timestamp: ts, signature: `sha256=${sig}`, rawBody: body, nowSeconds: now })).toEqual({ ok: true });
  });
  it("rejects tampered body, wrong secret, old timestamp, missing headers", () => {
    expect(verifySignature({ secret, timestamp: ts, signature: sig, rawBody: '{"a":2}', nowSeconds: now }).ok).toBe(false);
    expect(verifySignature({ secret: "y".repeat(40), timestamp: ts, signature: sig, rawBody: body, nowSeconds: now }).ok).toBe(false);
    expect(verifySignature({ secret, timestamp: ts, signature: sig, rawBody: body, nowSeconds: now + 301 }).ok).toBe(false);
    expect(verifySignature({ secret, timestamp: null, signature: sig, rawBody: body }).ok).toBe(false);
    expect(verifySignature({ secret, timestamp: ts, signature: "abc", rawBody: body, nowSeconds: now }).ok).toBe(false);
  });
});

describe("applicant import mapping", () => {
  const labels = new Map([
    ["ai automation developer", "AA"],
    ["full stack developer", "FS"],
  ]);
  const base = {
    candidate_code: "QF-2627-0001",
    form_response_id: "2_ABaOnudlYHaMp_rm6ugXKL",
    submitted_at: "2026-11-26T10:40:45.000Z",
    email: "  Riya@Gmail.com ",
    full_name: "Riya Shah",
    phone: "+91 98765 43210",
    role_label: "AI Automation Developer",
    cv_url: "https://drive.google.com/open?id=abc",
    portfolio_url: "javascript:alert(1)",
  };

  it("maps a single payload and normalises fields", () => {
    const parsed = importBodySchema.parse(base);
    expect(parsed).toHaveLength(1);
    const row = toApplicantRow(parsed[0], labels);
    expect(row.email).toBe("riya@gmail.com");
    expect(row.phone_e164).toBe("+919876543210");
    expect(row.role_code).toBe("AA");
    expect(row.cv_url).toBe("https://drive.google.com/open?id=abc");
    expect(row.portfolio_url).toBeNull(); // non-http URLs dropped
    expect(row).not.toHaveProperty("status"); // re-imports never reset reviews
  });

  it("accepts a batch and keeps 'Other' roles unmapped", () => {
    const parsed = importBodySchema.parse({ applicants: [{ ...base, role_label: "Other: Blockchain Developer" }] });
    expect(resolveRoleCode(parsed[0].role_label, labels)).toBeNull();
  });

  it("requires the Google response id", () => {
    expect(importBodySchema.safeParse({ ...base, form_response_id: "" }).success).toBe(false);
  });

  it("rejects an empty batch", () => {
    expect(importBodySchema.safeParse({ applicants: [] }).success).toBe(false);
  });
});

describe("validators", () => {
  const ids = {
    applicant_id: "11111111-1111-4111-8111-111111111111",
    batch_id: "22222222-2222-4222-8222-222222222222",
    mentor_id: "33333333-3333-4333-8333-333333333333",
  };

  it("stipend needs amount + frequency", () => {
    expect(convertSchema.safeParse({ ...ids, engagement_type: "stipend", stipend_amount_inr: "", stipend_frequency: "" }).success).toBe(false);
    expect(convertSchema.safeParse({ ...ids, engagement_type: "stipend", stipend_amount_inr: "5000", stipend_frequency: "monthly" }).success).toBe(true);
  });
  it("paid needs a fee; free must not carry a stipend", () => {
    expect(convertSchema.safeParse({ ...ids, engagement_type: "paid", fee_amount_inr: "" }).success).toBe(false);
    expect(convertSchema.safeParse({ ...ids, engagement_type: "paid", fee_amount_inr: "4999" }).success).toBe(true);
    expect(convertSchema.safeParse({ ...ids, engagement_type: "free", stipend_amount_inr: "100" }).success).toBe(false);
  });
  it("numbering pattern must contain {SEQ} and only known tokens", () => {
    const id = "44444444-4444-4444-8444-444444444444";
    expect(numberingSchema.safeParse({ id, pattern: "QF/OFR/{AY}/{SEQ:4}" }).success).toBe(true);
    expect(numberingSchema.safeParse({ id, pattern: "QF-C-{AY}-{ROLE}-{SEQ}" }).success).toBe(true);
    expect(numberingSchema.safeParse({ id, pattern: "QF/OFR/{AY}" }).success).toBe(false);
    expect(numberingSchema.safeParse({ id, pattern: "QF/{FOO}/{SEQ:4}" }).success).toBe(false);
  });
  it("batch end date must be after start", () => {
    const b = { program_id: ids.batch_id, code: "aa-2701", name: "AI Jan", start_date: "2027-01-10", end_date: "2027-01-01" };
    expect(batchSchema.safeParse(b).success).toBe(false);
    const ok = batchSchema.safeParse({ ...b, end_date: "2027-02-25" });
    expect(ok.success && ok.data.code).toBe("AA-2701");
  });
});
