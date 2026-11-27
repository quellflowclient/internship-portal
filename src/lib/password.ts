/** Password policy shared by sign-up, reset and change-password forms. */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72; // bcrypt limit used by Supabase Auth

export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (pw.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "Use letters and at least one number.";
  return null;
}
