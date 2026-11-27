/**
 * In-process Postgres (PGlite) with a minimal Supabase-compatible `auth` stub,
 * so migrations + RLS can be tested without Docker.
 * Supabase-specific pieces emulated: roles anon/authenticated/service_role,
 * auth.users, auth.uid(), auth.role() (read from request.jwt.claim.* settings).
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

const AUTH_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text not null,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant execute on function auth.role() to anon, authenticated, service_role;
`;

export async function createDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(AUTH_STUB);
  const migDir = join(ROOT, "supabase", "migrations");
  for (const f of readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(migDir, f), "utf8"));
  }
  await db.exec(readFileSync(join(ROOT, "supabase", "seed.sql"), "utf8"));
  return db;
}

/** Creates an auth user (fires handle_new_user) and returns its id. */
export async function createUser(db: PGlite, email: string, name = "Test User"): Promise<string> {
  const id = crypto.randomUUID();
  await db.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
    [id, email, JSON.stringify({ full_name: name })],
  );
  return id;
}

/** Superuser helper to set role/active/owner without going through RLS. */
export async function setRole(db: PGlite, id: string, role: "admin" | "student", active = true, owner = false) {
  await db.query(
    "update public.profiles set role = $2::public.user_role, is_active = $3, is_owner = $4 where id = $1",
    [id, role, active, owner],
  );
}

/** Run `fn` as the Supabase service role (import API, cron). */
export async function asService<T>(db: PGlite, fn: () => Promise<T>): Promise<T> {
  await db.exec("set role service_role");
  await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.role', '', false)");
  }
}

/** Run `fn` as an authenticated user (RLS applies), then reset to superuser. */
export async function asUser<T>(db: PGlite, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(userId ? "set role authenticated" : "set role anon");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  await db.query("select set_config('request.jwt.claim.role', $1, false)", [userId ? "authenticated" : "anon"]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
    await db.query("select set_config('request.jwt.claim.role', '', false)");
  }
}
