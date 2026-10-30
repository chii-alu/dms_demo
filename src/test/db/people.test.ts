// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN, HENT_STAFF, asAnon, asUser, setupDb } from "./harness";

let db: PGlite;

const ivId = async (name: string) =>
  (await db.query<{ id: string }>("select id from interventions where name = $1", [name])).rows[0].id;

async function session(name: string, rubric: boolean, as = ADMIN, capacity: number | null = null) {
  const r = await asUser(
    db,
    as,
    `select public.create_session($1, 'P', '{2026-11-12}'::date[], 'Online', null, null, $2, null, '[]', '[]', $3::jsonb) as id`,
    [await ivId(name), capacity, rubric ? JSON.stringify([{ name: "Impact", weight: 60 }, { name: "Fit", weight: 40 }]) : null],
  );
  const sid = r.rows[0].id as string;
  await db.exec(`update forms set status = 'open' where session_id = '${sid}'`);
  const intake = (await db.query<{ code: string }>("select code from forms where session_id = $1 and kind = 'intake'", [sid])).rows[0].code;
  return { sid, intake };
}

const apply = (code: string, email: string) =>
  asAnon(db, "select public.submit_intake($1, $2::jsonb, '{}'::jsonb) as r", [
    code,
    JSON.stringify({ name: email.split("@")[0], email, consent: "yes" }),
  ]);

const entryIds = async (sid: string) =>
  (await db.query<{ id: string }>("select id from entries where session_id = $1 order by submitted_at, id", [sid])).rows.map((r) => r.id);

beforeAll(async () => {
  db = await setupDb();
});

describe("set_entry_statuses (SPEC §4.15, §7 bulk status)", () => {
  it("rejects a selection status on an open session", async () => {
    const { sid, intake } = await session("Masterclass", false);
    await apply(intake, "reg@example.org");
    const [id] = await entryIds(sid);
    await expect(asUser(db, ADMIN, "select public.set_entry_statuses($1, $2, 'shortlisted')", [sid, [id]])).rejects.toThrow(/not used/);
  });

  it("rejects a registration status on a selective session", async () => {
    const { sid, intake } = await session("Ventures", true);
    await apply(intake, "app@example.org");
    const [id] = await entryIds(sid);
    await expect(asUser(db, ADMIN, "select public.set_entry_statuses($1, $2, 'registered')", [sid, [id]])).rejects.toThrow(/not used/);
  });

  it("bulk-updates applications and writes one history row per real change", async () => {
    const { sid, intake } = await session("Ventures", true);
    for (const e of ["b1@example.org", "b2@example.org", "b3@example.org"]) await apply(intake, e);
    const ids = await entryIds(sid);
    const n = await asUser(db, ADMIN, "select public.set_entry_statuses($1, $2, 'selected') as n", [sid, ids.slice(0, 2)]);
    expect(n.rows[0].n).toBe(2);
    const h = await db.query<{ n: number }>(
      "select count(*)::int n from status_history where entry_id = any ($1::uuid[]) and to_status = 'selected' and changed_by = $2",
      [ids.slice(0, 2), ADMIN],
    );
    expect(h.rows[0].n).toBe(2);
  });

  it("does not let pillar staff change another pillar's entries", async () => {
    const { sid, intake } = await session("Public Sector Fellowship", true);
    await apply(intake, "fellow@example.org");
    const [id] = await entryIds(sid);
    const r = await asUser(db, HENT_STAFF, "select public.set_entry_statuses($1, $2, 'rejected') as n", [sid, [id]]).catch((e) => e);
    // Either an access error, or zero rows changed. Both mean nothing was written.
    const changed = r instanceof Error ? 0 : r.rows[0].n;
    expect(changed).toBe(0);
    const st = await db.query<{ status: string }>("select status from entries where id = $1", [id]);
    expect(st.rows[0].status).toBe("applied");
  });
});

describe("save_scores (SPEC §4.13)", () => {
  it("saves the reviewer's criterion scores and replaces them on a second save", async () => {
    const { sid, intake } = await session("Ventures", true);
    await apply(intake, "scored@example.org");
    const [id] = await entryIds(sid);
    const crit = (await db.query<{ id: string; name: string }>("select id, name from rubric_criteria where session_id = $1 order by position", [sid])).rows;
    const payload = (a: number, b: number) =>
      JSON.stringify([{ criterion_id: crit[0].id, score: a }, { criterion_id: crit[1].id, score: b }]);
    await asUser(db, ADMIN, "select public.save_scores($1, $2::jsonb)", [id, payload(4, 3)]);
    await asUser(db, ADMIN, "select public.save_scores($1, $2::jsonb)", [id, payload(5, 5)]);
    const r = await db.query<{ score: number }>("select score from scores where entry_id = $1 order by score", [id]);
    expect(r.rows.map((x) => x.score)).toEqual([5, 5]);
  });

  it("refuses to score an open registration", async () => {
    const { sid, intake } = await session("Masterclass", false);
    await apply(intake, "noscore@example.org");
    const [id] = await entryIds(sid);
    await expect(asUser(db, ADMIN, "select public.save_scores($1, '[]'::jsonb)", [id])).rejects.toThrow(/Only applications/);
  });

  it("ignores criteria from another session", async () => {
    const a = await session("Ventures", true);
    const b = await session("Hackathon", true);
    await apply(a.intake, "cross@example.org");
    const [id] = await entryIds(a.sid);
    const other = (await db.query<{ id: string }>("select id from rubric_criteria where session_id = $1 limit 1", [b.sid])).rows[0].id;
    await asUser(db, ADMIN, "select public.save_scores($1, $2::jsonb)", [id, JSON.stringify([{ criterion_id: other, score: 5 }])]);
    const r = await db.query("select 1 from scores where entry_id = $1", [id]);
    expect(r.rows).toHaveLength(0);
  });
});

describe("staff_add_entry (SPEC §4.6–4.8, 'Add manually')", () => {
  const add = (sid: string, email: string) =>
    asUser(db, ADMIN, "select public.staff_add_entry($1, $2::jsonb) as r", [sid, JSON.stringify({ name: "Manual", email, consent: "yes" })]);

  it("adds a registration with source 'staff'", async () => {
    const { sid } = await session("Masterclass", false, ADMIN, 10);
    const r = await add(sid, "manual@example.org");
    expect(r.rows[0].r.status).toBe("registered");
    const src = await db.query<{ source: string }>("select source from entries where session_id = $1", [sid]);
    expect(src.rows[0].source).toBe("staff");
  });

  it("refuses a second entry for the same person", async () => {
    const { sid } = await session("Masterclass", false);
    await add(sid, "twice@example.org");
    await expect(add(sid, "TWICE@example.org")).rejects.toThrow(/already registered/);
  });

  it("applies capacity to manual registrations", async () => {
    const { sid } = await session("Masterclass", false, ADMIN, 1);
    expect((await add(sid, "first@example.org")).rows[0].r.status).toBe("registered");
    expect((await add(sid, "second@example.org")).rows[0].r.status).toBe("waitlisted");
  });
});
