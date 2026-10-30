// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN, HENT_STAFF, asAnon, asUser, setupDb } from "./harness";

let db: PGlite;
const REVIEWER = "00000000-0000-0000-0000-00000000000c";
const OTHER_REVIEWER = "00000000-0000-0000-0000-00000000000d";

const ivId = async (name: string) =>
  (await db.query<{ id: string }>("select id from interventions where name = $1", [name])).rows[0].id;

async function application(email: string, title: string, rubric = true) {
  const r = await asUser(
    db,
    ADMIN,
    `select public.create_session($1, $2, '{2099-03-01}'::date[], 'Online', null, null, null, null, '[]', '[]', $3::jsonb) as id`,
    [await ivId("Ventures"), title, rubric ? JSON.stringify([{ name: "Impact", weight: 60 }, { name: "Fit", weight: 40 }]) : null],
  );
  const sid = r.rows[0].id as string;
  await db.exec(`update forms set status = 'open' where session_id = '${sid}'`);
  const code = (await db.query<{ code: string }>("select code from forms where session_id = $1 and kind = 'intake'", [sid])).rows[0].code;
  await asAnon(db, "select public.submit_intake($1, $2::jsonb, '{}'::jsonb)", [code, JSON.stringify({ name: email, email, consent: "yes" })]);
  return sid;
}

beforeAll(async () => {
  db = await setupDb();
  await db.exec(`
    insert into auth.users (id, email) values ('${REVIEWER}', 'reviewer@mela.test'), ('${OTHER_REVIEWER}', 'other@mela.test');
    insert into staff_roles (user_id, role, pillars) values
      ('${REVIEWER}', 'reviewer', '{}'), ('${OTHER_REVIEWER}', 'reviewer', '{}');
  `);
});

describe("reviewer access (SPEC §8)", () => {
  it("assigns a reviewer to a selective session and lets them see that session's applications", async () => {
    const assigned = await application("a1@example.org", "Assigned");
    const other = await application("a2@example.org", "Not assigned");
    await asUser(db, HENT_STAFF, "insert into session_reviewers (session_id, user_id) values ($1, $2)", [assigned, REVIEWER]);

    const sessions = await asUser(db, REVIEWER, "select id from sessions");
    expect(sessions.rows.map((r: { id: string }) => r.id)).toEqual([assigned]);
    const entries = await asUser(db, REVIEWER, "select session_id from entries");
    expect(entries.rows.every((r: { session_id: string }) => r.session_id === assigned)).toBe(true);
    expect(other).not.toBe(assigned);
  });

  it("shows a reviewer only the participants who applied to their sessions", async () => {
    const r = await asUser(db, REVIEWER, "select email from participants order by email");
    expect(r.rows.map((x: { email: string }) => x.email)).toEqual(["a1@example.org"]);
  });

  it("lets a reviewer score their own applications and no one else's", async () => {
    const assigned = (await db.query<{ session_id: string }>("select session_id from session_reviewers where user_id = $1", [REVIEWER])).rows[0].session_id;
    const entry = (await db.query<{ id: string }>("select id from entries where session_id = $1", [assigned])).rows[0].id;
    const crit = (await db.query<{ id: string }>("select id from rubric_criteria where session_id = $1 order by position", [assigned])).rows;
    const scores = JSON.stringify(crit.map((c) => ({ criterion_id: c.id, score: 4 })));
    await asUser(db, REVIEWER, "select public.save_scores($1, $2::jsonb)", [entry, scores]);
    const mine = await db.query<{ reviewer_id: string }>("select reviewer_id from scores where entry_id = $1", [entry]);
    expect(mine.rows.length).toBe(crit.length); // one row per criterion
    expect(new Set(mine.rows.map((x) => x.reviewer_id))).toEqual(new Set([REVIEWER]));

    const unassigned = await application("a3@example.org", "Unassigned");
    const otherEntry = (await db.query<{ id: string }>("select id from entries where session_id = $1", [unassigned])).rows[0].id;
    const otherCrit = (await db.query<{ id: string }>("select id from rubric_criteria where session_id = $1 order by position", [unassigned])).rows;
    // The reviewer cannot even see this entry, so the call is refused (or writes nothing).
    await asUser(db, REVIEWER, "select public.save_scores($1, $2::jsonb)", [otherEntry, JSON.stringify(otherCrit.map((c) => ({ criterion_id: c.id, score: 5 })))]).catch(() => undefined);
    const leaked = await db.query("select 1 from scores where entry_id = $1", [otherEntry]);
    expect(leaked.rows).toHaveLength(0);
  });

  it("does not let a reviewer change statuses or assign other reviewers", async () => {
    const assigned = (await db.query<{ session_id: string }>("select session_id from session_reviewers where user_id = $1", [REVIEWER])).rows[0].session_id;
    const entry = (await db.query<{ id: string }>("select id from entries where session_id = $1", [assigned])).rows[0].id;
    const changed = await asUser(db, REVIEWER, "select public.set_entry_statuses($1, $2, 'selected') as n", [assigned, [entry]]);
    expect(changed.rows[0].n).toBe(0);

    await expect(
      asUser(db, REVIEWER, "insert into session_reviewers (session_id, user_id) values ($1, $2)", [assigned, OTHER_REVIEWER]),
    ).rejects.toThrow(/row-level security/);
  });

  it("lists assignable staff only for people who can access the session", async () => {
    const assigned = (await db.query<{ session_id: string }>("select session_id from session_reviewers where user_id = $1", [REVIEWER])).rows[0].session_id;
    const asStaff = await asUser(db, HENT_STAFF, "select email from assignable_staff($1)", [assigned]);
    expect(asStaff.rows.length).toBeGreaterThan(0);
    const asReviewer = await asUser(db, OTHER_REVIEWER, "select email from assignable_staff($1)", [assigned]);
    expect(asReviewer.rows).toHaveLength(0);
  });

  it("refuses reviewers on an open (registration) session", async () => {
    const r = await asUser(db, ADMIN, "select public.create_session($1, 'Open', '{2099-03-02}'::date[], 'Online', null, null, null, null, '[]', '[]', null) as id", [await ivId("Masterclass")]);
    await expect(
      asUser(db, HENT_STAFF, "insert into session_reviewers (session_id, user_id) values ($1, $2)", [r.rows[0].id, REVIEWER]),
    ).rejects.toThrow(/row-level security/);
  });
});
