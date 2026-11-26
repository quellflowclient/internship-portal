import { z } from "zod";

/**
 * Public env (safe in the browser). Supabase now issues "publishable" keys;
 * the legacy "anon" key name is accepted as a fallback.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
});

export function publicEnv() {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });
}

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  IMPORT_SECRET: z.string().min(32, "IMPORT_SECRET must be at least 32 characters"),
});

/** Server-only secrets. Never import from client components. */
export function serverEnv() {
  return serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    IMPORT_SECRET: process.env.IMPORT_SECRET,
  });
}
