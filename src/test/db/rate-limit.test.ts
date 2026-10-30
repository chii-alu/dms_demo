// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, setupDb } from "./harness";

let db: PGlite;
beforeAll(async () => {
  db = await setupDb();
});

const hit = async (key: string, limit = 2) =>
  (await asAnon(db, "select public.consume_rate_limit($1, $2, 60) as ok", [key, limit])).rows[0].ok as boolean;

describe("consume_rate_limit (SPEC §8)", () => {
  it("allows up to the limit in a window, then refuses", async () => {
    expect([await hit("1.2.3.4:CODE"), await hit("1.2.3.4:CODE"), await hit("1.2.3.4:CODE")]).toEqual([true, true, false]);
  });

  it("counts each key separately", async () => {
    expect(await hit("5.6.7.8:CODE")).toBe(true);
  });

  it("anonymous callers see none of the counts (RLS with no policy)", async () => {
    const r = await asAnon(db, "select count(*)::int n from rate_limits");
    expect(r.rows[0].n).toBe(0);
  });
});
