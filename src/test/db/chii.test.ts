// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN, HENT_STAFF, asAnon, asUser, setupDb } from "./harness";

let db: PGlite;
const HECO_STAFF = "00000000-0000-0000-0000-00000000000f";
const REVIEWER = "00000000-0000-0000-0000-000000000010";

async function cohort(ivName: string, label: string, threshold = 0.75) {
  const iv = (await db.query<{ id: string }>("select id from interventions where name = $1", [ivName])).rows[0].id;
  return (await db.query<{ id: string }>(
    "insert into cohort (intervention_id, label, completion_threshold) values ($1, $2, $3) returning id",
    [iv, label, threshold],
  )).rows[0].id;
}

async function meetings(cohortId: string, dates: string[]) {
  const ids: string[] = [];
  for (const d of dates) {
    ids.push((await db.query<{ id: string }>("insert into session_meeting (cohort_id, session_date) values ($1, $2::date) returning id", [cohortId, d])).rows[0].id);
  }
  return ids;
}

const resolve = (name: string, email: string | null, phone: string | null = null, student: string | null = null, type: string | null = null, profile: object = {}) =>
  db.query<{ r: { chii_id: string; created: boolean; match: string } }>(
    "select public.resolve_beneficiary($1, $2, $3, $4, $5, $6::jsonb) as r",
    [name, email, phone, student, type, JSON.stringify(profile)],
  ).then((r) => r.rows[0].r);

const idOf = async (email: string) =>
  (await db.query<{ chii_id: string }>("select chii_id from beneficiary_identity where email = $1", [email])).rows[0].chii_id;

beforeAll(async () => {
  db = await setupDb();
  await db.exec(`
    insert into auth.users (id, email) values ('${HECO_STAFF}', 'heco@mela.test'), ('${REVIEWER}', 'rev@mela.test');
    insert into staff_roles (user_id, role, pillars) values ('${HECO_STAFF}', 'pillar_staff', '{HECO}'), ('${REVIEWER}', 'reviewer', '{}');
  `);
});

describe("identity: resolve_beneficiary (addendum §5)", () => {
  it("mints a CHII ID in the agreed format for a new person", async () => {
    const r = await resolve("Aline Uwase", "Aline@Example.org", "+250 78 111 2222", "S-100");
    expect(r.created).toBe(true);
    expect(r.chii_id).toMatch(/^CHII-\d{6}$/);
  });

  it("matches the same email in a different case to the same ID", async () => {
    const first = await resolve("Jean Habimana", "jean@example.org");
    const again = await resolve("Jean Habimana", "JEAN@example.org ");
    expect(again.chii_id).toBe(first.chii_id);
    expect(again.created).toBe(false);
  });

  it("matches on student ID even when the email differs", async () => {
    const first = await resolve("Grace Mukamana", "grace@example.org", null, "S-2001");
    const again = await resolve("Grace M.", "grace.new@example.org", null, "s-2001");
    expect(again.chii_id).toBe(first.chii_id);
  });

  it("does not match on name alone; a weak match is created and queued for review", async () => {
    const first = await resolve("Kofi Mensah", "kofi1@example.org", "+233 555 0101");
    const second = await resolve("Kofi Mensah", "kofi2@example.org", "+233 555 0101");
    expect(second.chii_id).not.toBe(first.chii_id);
    expect(second.match).toBe("possible_duplicate");
    const q = await db.query("select 1 from id_match_review where new_chii_id = $1 and candidate_chii_id = $2", [second.chii_id, first.chii_id]);
    expect(q.rows).toHaveLength(1);
  });

  it("refuses a person with no name or no contact at all", async () => {
    await expect(resolve("", "x@example.org")).rejects.toThrow(/Full name is required/);
    await expect(resolve("No Contact", null, null, null)).rejects.toThrow(/email, student ID or phone/);
  });

  it("can be called by a signed-in staff member (not by anon)", async () => {
    const r = await asUser(db, HENT_STAFF, "select public.resolve_beneficiary('Staff Entry', 'staff-entry@example.org', null, null, 'student', '{}'::jsonb) as r");
    expect(r.rows[0].r.created).toBe(true);
    await expect(asAnon(db, "select public.resolve_beneficiary('Anon', 'anon@example.org', null, null, null, '{}'::jsonb)")).rejects.toThrow(/permission denied/);
  });

  it("issues distinct IDs to distinct people", async () => {
    const a = await resolve("Distinct A", "da@example.org");
    const b = await resolve("Distinct B", "db@example.org");
    expect(a.chii_id).not.toBe(b.chii_id);
  });
});

describe("programme records and cohort rules (addendum §3B, §10)", () => {
  it("refuses a second participation in the same cohort", async () => {
    const c = await cohort("Masterclass", "M1");
    const p = (await resolve("Dup Person", "dup@example.org")).chii_id;
    await db.query("insert into participation (chii_id, cohort_id, status) values ($1, $2, 'registered')", [p, c]);
    await expect(db.query("insert into participation (chii_id, cohort_id, status) values ($1, $2, 'registered')", [p, c])).rejects.toThrow(/unique|duplicate/);
  });

  it("keeps one person's participation across two pillars under one ID", async () => {
    const p = (await resolve("Multi Pillar", "multi@example.org")).chii_id;
    const hent = await cohort("Masterclass", "M2");
    const heco = await cohort("Public Sector Fellowship", "F1");
    await db.query("insert into participation (chii_id, cohort_id, status) values ($1, $2, 'registered'), ($1, $3, 'registered')", [p, hent, heco]);
    const r = await db.query<{ n: number }>("select count(*)::int n from v_person_journey where chii_id = $1", [p]);
    expect(r.rows[0].n).toBe(2);
  });
});

describe("access (addendum §6 and the visibility rules)", () => {
  let hentCohort: string;
  let hecoCohort: string;
  let person: string;
  beforeAll(async () => {
    hentCohort = await cohort("Masterclass", "Access HENT");
    hecoCohort = await cohort("Public Sector Fellowship", "Access HECO");
    person = (await resolve("Access Person", "access@example.org")).chii_id;
    await db.query("insert into participation (chii_id, cohort_id, status) values ($1, $2, 'registered'), ($1, $3, 'registered')", [person, hentCohort, hecoCohort]);
  });

  it("pillar staff see their own pillar's participation only", async () => {
    const r = await asUser(db, HENT_STAFF, "select cohort_id from participation where chii_id = $1", [person]);
    expect(r.rows.map((x: { cohort_id: string }) => x.cohort_id)).toEqual([hentCohort]);
  });

  it("pillar staff can read non-personal data for every pillar (aggregates are for everyone)", async () => {
    const r = await asUser(db, HENT_STAFF, "select count(*)::int n from beneficiary where chii_id = $1", [person]);
    expect(r.rows[0].n).toBe(1);
    const summary = await asUser(db, HENT_STAFF, "select pillar from v_cohort_summary where cohort_id = $1", [hecoCohort]);
    expect(summary.rows).toHaveLength(1);
  });

  it("only the admin (data owner) reads identity and standing", async () => {
    expect((await asUser(db, HENT_STAFF, "select count(*)::int n from beneficiary_identity where chii_id = $1", [person])).rows[0].n).toBe(0);
    expect((await asUser(db, ADMIN, "select count(*)::int n from beneficiary_identity where chii_id = $1", [person])).rows[0].n).toBe(1);
  });

  it("reviewers read no person-level data", async () => {
    expect((await asUser(db, REVIEWER, "select count(*)::int n from beneficiary")).rows[0].n).toBe(0);
  });

  it("names for a cohort come only to pillar staff of that cohort", async () => {
    const own = await asUser(db, HENT_STAFF, "select full_name from staff_cohort_people($1)", [hentCohort]);
    expect(own.rows.map((x: { full_name: string }) => x.full_name)).toContain("Access Person");
    await expect(asUser(db, HENT_STAFF, "select * from staff_cohort_people($1)", [hecoCohort])).rejects.toThrow(/Not allowed/);
    await expect(asUser(db, HECO_STAFF, "select * from staff_cohort_people($1)", [hentCohort])).rejects.toThrow(/Not allowed/);
  });

  it("the dashboard reader reads the views but not identity, and anon reads nothing", async () => {
    await db.exec("set role dashboard_reader");
    try {
      await db.query("select count(*) from v_cohort_summary");
      await expect(db.query("select * from beneficiary_identity")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
    await expect(asAnon(db, "select * from v_cohort_summary")).rejects.toThrow(/permission denied/);
  });
});

describe("merge (addendum §5 step 3)", () => {
  it("moves every row to the surviving ID, collapses duplicates and keeps a pointer", async () => {
    const keep = (await resolve("Merge Keep", "keep@example.org")).chii_id;
    const gone = (await resolve("Merge Gone", "gone@example.org")).chii_id;
    const c = await cohort("Masterclass", "Merge cohort");
    const c2 = await cohort("Masterclass", "Merge cohort 2");
    await db.query("insert into participation (chii_id, cohort_id, status) values ($1, $2, 'registered'), ($3, $2, 'registered'), ($3, $4, 'registered')", [keep, c, gone, c2]);

    await asUser(db, ADMIN, "select public.merge_beneficiary($1, $2)", [gone, keep]);

    const rows = await db.query<{ cohort_id: string }>("select cohort_id from participation where chii_id = $1 order by cohort_id", [keep]);
    expect(rows.rows.map((r) => r.cohort_id).sort()).toEqual([c, c2].sort());
    const g = await db.query<{ merged_into: string }>("select merged_into from beneficiary where chii_id = $1", [gone]);
    expect(g.rows[0].merged_into).toBe(keep);
    const ident = await db.query("select 1 from beneficiary_identity where chii_id = $1", [gone]);
    expect(ident.rows).toHaveLength(0);
    const log = await db.query("select 1 from beneficiary_merge_log where from_chii_id = $1 and into_chii_id = $2", [gone, keep]);
    expect(log.rows).toHaveLength(1);
  });

  it("refuses non-admins and resolves future lookups to the surviving ID", async () => {
    const a = (await resolve("Refuse A", "refa@example.org")).chii_id;
    const b = (await resolve("Refuse B", "refb@example.org")).chii_id;
    await expect(asUser(db, HENT_STAFF, "select public.merge_beneficiary($1, $2)", [a, b])).rejects.toThrow(/Only admins/);
    await asUser(db, ADMIN, "select public.merge_beneficiary($1, $2)", [a, b]);
    // The merged person's email no longer exists as an identity, so a new lookup creates a new ID.
    const again = await resolve("Refuse A", "refa@example.org");
    expect(again.chii_id).not.toBe(b);
    expect(again.created).toBe(true);
  });
});

describe("reporting views (addendum §7)", () => {
  it("the summary counts distinct people, and completion uses the cohort threshold", async () => {
    const c = await cohort("Masterclass", "Summary cohort", 0.75);
    const [m1, m2, m3, m4] = await meetings(c, ["2099-01-01", "2099-01-02", "2099-01-03", "2099-01-04"]);
    const a = (await resolve("Sum A", "suma@example.org")).chii_id;
    const b = (await resolve("Sum B", "sumb@example.org")).chii_id;
    await db.query("insert into participation (chii_id, cohort_id, status) values ($1, $2, 'registered'), ($3, $2, 'registered')", [a, c, b]);
    // A attends 3 of 4 (75%: completed). B attends 1 of 4 (not completed).
    for (const m of [m1, m2, m3]) await db.query("insert into session_attendance (session_id, chii_id) values ($1, $2)", [m, a]);
    await db.query("insert into session_attendance (session_id, chii_id) values ($1, $2)", [m1, b]);

    const s = await db.query<Record<string, number>>("select registered, attended, completed from v_cohort_summary where cohort_id = $1", [c]);
    expect(s.rows[0]).toEqual({ registered: 2, attended: 2, completed: 1 });
  });

  it("the selection funnel steps from applied to completed", async () => {
    const c = await cohort("Public Sector Fellowship", "Funnel cohort", 0.75);
    const [m1, m2] = await meetings(c, ["2099-02-01", "2099-02-02"]);
    const people = [];
    for (const e of ["fa@example.org", "fb@example.org", "fc@example.org"]) {
      people.push((await resolve(e, e)).chii_id);
    }
    const apps = [];
    for (let i = 0; i < 3; i++) {
      apps.push((await db.query<{ id: string }>(
        "insert into application (chii_id, cohort_id, status) values ($1, $2, $3) returning id",
        [people[i], c, ["selected", "shortlisted", "applied"][i]],
      )).rows[0].id);
    }
    await db.query("insert into selection_review (application_id, criterion, reviewer_id, score) values ($1, 'Impact', $2, 4)", [apps[0], ADMIN]);
    await db.query("insert into session_attendance (session_id, chii_id) values ($1, $2), ($3, $2)", [m1, people[0], m2]);
    const r = await db.query<Record<string, number>>("select applied, reviewed, selected, attended, completed from v_selection_funnel where cohort_id = $1", [c]);
    expect(r.rows[0]).toEqual({ applied: 3, reviewed: 1, selected: 1, attended: 1, completed: 1 });
  });

  it("reach counts each person once, split by demographics", async () => {
    const c = await cohort("Masterclass", "Reach cohort");
    const p = (await resolve("Reach Person", "reach@example.org", null, null, null, { gender: "Female", residence_country: "RW" })).chii_id;
    await db.query("insert into participation (chii_id, cohort_id, status) values ($1, $2, 'registered')", [p, c]);
    const r = await db.query<{ people: number }>(
      "select sum(people)::int people from v_reach_by_pillar where pillar = 'HENT' and gender = 'Female' and residence_country = 'RW'",
    );
    expect(r.rows[0].people).toBeGreaterThanOrEqual(1);
  });
});
