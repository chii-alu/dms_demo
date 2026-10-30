// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN, HENT_STAFF, asUser, setupDb } from "./harness";

let db: PGlite;
const NEWCOMER = "00000000-0000-0000-0000-00000000000e";

beforeAll(async () => {
  db = await setupDb();
  await db.exec(`insert into auth.users (id, email) values ('${NEWCOMER}', 'new@mela.test')`);
});

describe("staff administration (admin only)", () => {
  it("lists staff with emails for admins", async () => {
    const r = await asUser(db, ADMIN, "select email, role from list_staff() order by email");
    expect(r.rows.map((x: { email: string }) => x.email)).toEqual(["admin@mela.test", "hent@mela.test"]);
  });

  it("refuses the list to pillar staff", async () => {
    await expect(asUser(db, HENT_STAFF, "select * from list_staff()")).rejects.toThrow(/Only admins/);
  });

  it("grants a role to an existing account by email, with pillars", async () => {
    await asUser(db, ADMIN, "select public.set_staff_role('NEW@mela.test', 'reviewer', '{}')");
    const r = await db.query<{ role: string }>("select role from staff_roles where user_id = $1", [NEWCOMER]);
    expect(r.rows[0].role).toBe("reviewer");
  });

  it("changes an existing role", async () => {
    await asUser(db, ADMIN, "select public.set_staff_role('new@mela.test', 'pillar_staff', '{HEMP}')");
    const r = await db.query<{ role: string; pillars: string[] }>("select role, pillars::text[] as pillars from staff_roles where user_id = $1", [NEWCOMER]);
    expect(r.rows[0]).toEqual({ role: "pillar_staff", pillars: ["HEMP"] });
  });

  it("refuses an account that does not exist yet", async () => {
    await expect(asUser(db, ADMIN, "select public.set_staff_role('nobody@mela.test', 'reviewer', '{}')")).rejects.toThrow(/No account exists/);
  });

  it("removes access, but never the caller's own admin access", async () => {
    await asUser(db, ADMIN, "select public.remove_staff($1)", [NEWCOMER]);
    const gone = await db.query("select 1 from staff_roles where user_id = $1", [NEWCOMER]);
    expect(gone.rows).toHaveLength(0);
    await expect(asUser(db, ADMIN, "select public.remove_staff($1)", [ADMIN])).rejects.toThrow(/own admin access/);
  });
});
