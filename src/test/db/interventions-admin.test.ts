// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN, HENT_STAFF, asUser, setupDb } from "./harness";

let db: PGlite;
beforeAll(async () => {
  db = await setupDb();
});

describe("adding interventions (SPEC §7 '+ Add intervention')", () => {
  it("lets an admin add an intervention to a pillar", async () => {
    await asUser(db, ADMIN, "insert into interventions (pillar, name, type) values ('HENT', 'Pitch Night', 'open')");
    const r = await db.query<{ n: number }>("select count(*)::int n from interventions where name = 'Pitch Night'");
    expect(r.rows[0].n).toBe(1);
  });

  it("refuses the same name twice in one pillar", async () => {
    await expect(
      asUser(db, ADMIN, "insert into interventions (pillar, name, type) values ('HENT', 'Pitch Night', 'selective')"),
    ).rejects.toThrow(/duplicate key|unique/);
  });

  it("refuses pillar staff (only admins write interventions)", async () => {
    await expect(
      asUser(db, HENT_STAFF, "insert into interventions (pillar, name, type) values ('HENT', 'Sneaky', 'open')"),
    ).rejects.toThrow(/row-level security/);
  });
});
