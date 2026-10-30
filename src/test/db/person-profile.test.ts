// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN, HENT_STAFF, asUser, setupDb } from "./harness";

const HECO_STAFF = "00000000-0000-0000-0000-00000000000f";
const REVIEWER = "00000000-0000-0000-0000-000000000010";
let db: PGlite;
let person: string;
let hentCohort: string;
let hecoCohort: string;

beforeAll(async () => {
  db = await setupDb();
  await db.exec(`
    insert into auth.users (id, email) values ('${HECO_STAFF}', 'heco@mela.test'), ('${REVIEWER}', 'rev@mela.test');
    insert into staff_roles (user_id, role, pillars) values ('${HECO_STAFF}', 'pillar_staff', '{HECO}'), ('${REVIEWER}', 'reviewer', '{}');
  `);
  const iv = async (n: string) => (await db.query<{ id: string }>("select id from interventions where name = $1", [n])).rows[0].id;
  hentCohort = (await db.query<{ id: string }>("insert into cohort (intervention_id, label) values ($1, 'Profile HENT') returning id", [await iv("Masterclass")])).rows[0].id;
  hecoCohort = (await db.query<{ id: string }>("insert into cohort (intervention_id, label) values ($1, 'Profile HECO') returning id", [await iv("Public Sector Fellowship")])).rows[0].id;
  const r = await db.query<{ r: { chii_id: string } }>(
    "select public.resolve_beneficiary('Profile Person', 'profile@example.org', null, 'P-77', 'student', '{\"gender\":\"Female\",\"residence_country\":\"Rwanda\"}'::jsonb) as r");
  person = r.rows[0].r.chii_id;
  await db.exec(`insert into student_profile (chii_id, enrolment_status, year_group) values ('${person}', 'Enrolled', '2024 May')`);
  await db.exec(`insert into student_standing (chii_id, financial_status) values ('${person}', 'Good Standing')`);
  await db.exec(`insert into participation (chii_id, cohort_id, status) values ('${person}', '${hentCohort}', 'registered')`);
});

describe("participant profile by CHII ID", () => {
  it("returns the full profile for the CHII ID, with identity for admins", async () => {
    const r = await asUser(db, ADMIN, "select public.person_profile($1) as p", [person]);
    const p = r.rows[0].p;
    expect(p.person.chii_id).toBe(person);
    expect(p.person.residence_country).toBe("Rwanda");
    expect(p.identity.full_name).toBe("Profile Person");
    expect(p.identity_visible).toBe(true);
    expect(p.student.year_group).toBe("2024 May");
    expect(p.standing.financial).toBe("Good Standing");
    expect(p.types[0].type).toBe("student");
    expect(p.journey).toHaveLength(1);
    expect(p.journey[0].cohort).toBe("Profile HENT");
  });

  it("shows the name to pillar staff of the person's pillar, but not to other pillars", async () => {
    const own = await asUser(db, HENT_STAFF, "select public.person_profile($1) as p", [person]);
    expect(own.rows[0].p.identity.full_name).toBe("Profile Person");
    expect(own.rows[0].p.identity_visible).toBe(true);
    const other = await asUser(db, HECO_STAFF, "select public.person_profile($1) as p", [person]);
    expect(other.rows[0].p.identity_visible).toBe(false);
    expect(other.rows[0].p.identity.full_name).toBeUndefined();
    // Standing and the rest are still visible to every registry staff member.
    expect(other.rows[0].p.standing.financial).toBe("Good Standing");
  });

  it("refuses reviewers, and bad or unknown IDs", async () => {
    await expect(asUser(db, REVIEWER, "select public.person_profile($1)", [person])).rejects.toThrow(/Not allowed/);
    await expect(asUser(db, ADMIN, "select public.person_profile('MELA-0001')")).rejects.toThrow(/CHII ID looks like/);
    const none = await asUser(db, ADMIN, "select public.person_profile('CHII-999999') as p");
    expect(none.rows[0].p).toBeNull();
  });

  it("opens the surviving profile when an old ID has been merged", async () => {
    const other = (await db.query<{ r: { chii_id: string } }>(
      "select public.resolve_beneficiary('Merged Away', 'away@example.org', null, null, null, '{}'::jsonb) as r")).rows[0].r.chii_id;
    await asUser(db, ADMIN, "select public.merge_beneficiary($1, $2)", [other, person]);
    const r = await asUser(db, ADMIN, "select public.person_profile($1) as p", [other]);
    expect(r.rows[0].p.person.chii_id).toBe(person);
    expect(r.rows[0].p.person.merged_from_requested).toBe(true);
  });
});
