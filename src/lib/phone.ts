/**
 * Indian mobile numbers. Accepts what students type in the form
 * (9876543210, 98765 43210, +91 98765 43210, 09876543210, 91-98765-43210)
 * and stores E.164 (+919876543210). Returns null when it is not a valid Indian mobile.
 */
export function toE164India(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = String(input).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

/** +919876543210 -> +91 98765 43210 (other numbers returned unchanged) */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "—";
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}
