// Shared database harness: real migrations and seed in PGlite, with Supabase-style
// stubs for the auth schema and default grants. RLS is the real gate.
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");

export const ADMIN = "00000000-0000-0000-0000-00000000000a";
export const HENT_STAFF = "00000000-0000-0000-0000-00000000000b";

export async function setupDb() {
  const db = await PGlite.create({ extensions: { citext } });
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  // Mirror Supabase's default privileges: objects created by the migrations are granted to
  // anon and authenticated automatically, so the migrations' own REVOKEs must take effect.
  await db.exec(`
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant usage, select on sequences to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
  `);
  const dir = path.join(ROOT, "supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(dir, file), "utf8"));
  }
  await db.exec(readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8"));
  await db.exec(`
    insert into auth.users values ('${ADMIN}'), ('${HENT_STAFF}');
    insert into staff_roles (user_id, role, pillars) values
      ('${ADMIN}', 'admin', '{}'), ('${HENT_STAFF}', 'pillar_staff', '{HENT}');
  `);
  return db;
}

// Runs SQL as an authenticated user (RLS applies), then restores the session.
// Rows are loosely typed: tests assert on known shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function asUser<T = any>(db: PGlite, uid: string, sql: string, params: unknown[] = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false)`);
  try {
    return await db.query<T>(sql, params);
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false)");
  }
}

// Runs SQL as anonymous (the public forms' role).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function asAnon<T = any>(db: PGlite, sql: string, params: unknown[] = []) {
  await db.exec("set role anon; select set_config('request.jwt.claim.sub', '', false)");
  try {
    return await db.query<T>(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
