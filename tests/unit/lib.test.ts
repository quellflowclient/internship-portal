import { describe, expect, it } from "vitest";
import { formatPhone, toE164India } from "@/lib/phone";
import { passwordProblem } from "@/lib/password";
import { computeSignature, verifySignature } from "@/lib/hmac";
import { emailSchema, indianPhone, optionalUrl } from "@/lib/validators";
import { hrefWith, paging } from "@/lib/url";
import { inr, initials } from "@/lib/utils";

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

describe("validators", () => {
  it("normalises email and Indian mobile numbers", () => {
    expect(emailSchema.parse("  Riya@Gmail.com ")).toBe("riya@gmail.com");
    expect(indianPhone.parse("98765 43210")).toBe("+919876543210");
    expect(indianPhone.safeParse("12345").success).toBe(false);
  });
  it("adds https to bare links and drops empty ones", () => {
    expect(optionalUrl.parse("github.com/riya")).toBe("https://github.com/riya");
    expect(optionalUrl.parse("")).toBeNull();
  });
});

describe("url state", () => {
  it("keeps current params, applies changes and drops empty ones", () => {
    expect(hrefWith("/admin/students", { type: "paid", page: "2" }, { page: null, q: "riya" })).toBe("/admin/students?type=paid&q=riya");
  });
  it("pages on desktop and appends with show on phones", () => {
    expect(paging({ page: "3" })).toMatchObject({ from: 20, to: 29, page: 3 });
    expect(paging({ show: "20" })).toMatchObject({ from: 0, to: 19, show: 20 });
  });
});

describe("format", () => {
  it("uses Indian digit grouping and initials", () => {
    expect(inr(118999)).toBe("₹1,18,999");
    expect(initials("Riya  Shah")).toBe("RS");
  });
});
