import { z } from "zod";
import { toE164India } from "@/lib/phone";

/** Shared zod building blocks for server actions. Domain schemas live next to their actions. */
export const uuid = z.uuid();

export const requiredText = (max = 200, label = "This field") =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullish();

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.email("Enter a valid email address").nullable())
  .nullish();

/** Indian mobile → +91XXXXXXXXXX */
export const indianPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const e = toE164India(v);
    if (!e) {
      ctx.addIssue({ code: "custom", message: "Enter a 10-digit Indian mobile number" });
      return z.NEVER;
    }
    return e;
  });

export const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.iso.date("Enter a valid date").nullable())
  .nullish();

export const rupees = z.coerce.number().int("Whole rupees only").min(0).max(10_000_000);

export const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : /^https?:\/\//i.test(v) ? v : `https://${v}`))
  .pipe(z.url("Enter a valid link").nullable())
  .nullish();

/** FormData → plain object (last value wins; checkboxes give "on"). */
export function formToObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  fd.forEach((v, k) => {
    if (typeof v === "string") out[k] = v;
  });
  return out;
}
