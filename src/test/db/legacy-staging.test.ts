// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN, HENT_STAFF, asUser, setupDb } from "./harness";

let db: PGlite;
beforeAll(async () => {
  db = await setupDb();
  await db.exec(`insert into legacy_import_batches (source_file_name, file_sha256) values ('sheet.csv', 'abc')`);
});

describe("legacy import staging (admin only)", () => {
  it("lets the admin read and write staged rows", async () => {
    const b = (await db.query<{ id: string }>("select id from legacy_import_batches")).rows[0].id;
    await asUser(db, ADMIN, "insert into legacy_import_rows (batch_id, row_no, raw) values ($1, 1, '{\"Email \": \"a@x.org\"}'::jsonb)", [b]);
    const r = await asUser(db, ADMIN, "select count(*)::int n from legacy_import_rows");
    expect(r.rows[0].n).toBe(1);
  });

  it("hides staged personal data from pillar staff", async () => {
    const r = await asUser(db, HENT_STAFF, "select count(*)::int n from legacy_import_rows");
    expect(r.rows[0].n).toBe(0);
  });
});
