// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN, HENT_STAFF, asAnon, asUser, setupDb } from "./harness";

let db: PGlite;

beforeAll(async () => {
  db = await setupDb();
  const iv = (await db.query<{ id: string }>("select id from interventions where name = 'Masterclass'")).rows[0].id;
  const r = await asUser(
    db,
    ADMIN,
    "select public.create_session($1, 'Priv', '{2099-01-01}'::date[], 'Online', null, null, null, null, '[]', '[]', null) as id",
    [iv],
  );
  const sid = r.rows[0].id as string;
  await db.exec(`update forms set status = 'open' where session_id = '${sid}'`);
  const code = (await db.query<{ code: string }>("select code from forms where session_id = $1 and kind = 'intake'", [sid])).rows[0].code;
  await asAnon(db, "select public.submit_intake($1, $2::jsonb, '{}'::jsonb)", [
    code,
    JSON.stringify({ name: "Forget Me", email: "forget@example.org", phone: "+250 1", gender: "Female", age: "18–24", country: "Rwanda", affiliation: "Student", disability: "No", consent: "yes" }),
  ]);
});

describe("anonymise_participant (SPEC §8)", () => {
  it("refuses non-admins", async () => {
    const pid = (await db.query<{ pid: string }>("select pid from participants where email = 'forget@example.org'")).rows[0].pid;
    await expect(asUser(db, HENT_STAFF, "select public.anonymise_participant($1)", [pid])).rejects.toThrow(/Only admins/);
  });

  it("removes personal fields but keeps the record and its links", async () => {
    const before = await db.query<{ pid: string; id: string }>("select pid, id from participants where email = 'forget@example.org'");
    const { pid, id } = before.rows[0];
    const entriesBefore = (await db.query<{ n: number }>("select count(*)::int n from entries where participant_id = $1", [id])).rows[0].n;

    await asUser(db, ADMIN, "select public.anonymise_participant($1)", [pid]);

    const after = await db.query<Record<string, unknown>>(
      "select pid, name, email, phone, gender, country, consent_at from participants where id = $1",
      [id],
    );
    expect(after.rows[0]).toEqual({
      pid,
      name: "Anonymised participant",
      email: `anonymised+${pid}@invalid.local`,
      phone: null,
      gender: null,
      country: null,
      consent_at: null,
    });
    const entriesAfter = (await db.query<{ n: number }>("select count(*)::int n from entries where participant_id = $1", [id])).rows[0].n;
    expect(entriesAfter).toBe(entriesBefore);
  });

  it("fails for an unknown PID", async () => {
    await expect(asUser(db, ADMIN, "select public.anonymise_participant('MELA-9999')")).rejects.toThrow(/not found/);
  });
});

describe("email_log (SPEC §9)", () => {
  it("lets staff record a send for an entry in their own pillar only", async () => {
    const entry = (await db.query<{ id: string; pid: string; participant_id: string }>(
      "select e.id, p.pid, e.participant_id from entries e join participants p on p.id = e.participant_id limit 1",
    )).rows[0];
    const insert = (uid: string) =>
      asUser(db, uid, "insert into email_log (entry_id, participant_id, to_email, subject, body, status, sent_by) values ($1, $2, 'x@example.org', 's', 'b', 'not_configured', $3)", [
        entry.id,
        entry.participant_id,
        uid,
      ]);
    // The fixture session is HENT (Masterclass), so pillar staff can write to it.
    await expect(insert(HENT_STAFF)).resolves.toBeDefined();
  });

  it("denies a pillar staff member a log entry for another pillar", async () => {
    // A HECO session with one entry, created by the admin.
    const heco = (await db.query<{ id: string }>("select id from interventions where pillar = 'HECO' and name = 'Executive Courses'")).rows[0].id;
    const sid = (await asUser(
      db,
      ADMIN,
      "select public.create_session($1, 'HECO', '{2099-02-01}'::date[], 'Online', null, null, null, null, '[]', '[]', $2::jsonb) as id",
      [heco, JSON.stringify([{ name: "Impact", weight: 100 }])],
    )).rows[0].id as string;
    const code = (await db.query<{ code: string }>("select code from forms where session_id = $1 and kind = 'intake'", [sid])).rows[0].code;
    await db.exec(`update forms set status = 'open' where session_id = '${sid}'`);
    await asAnon(db, "select public.submit_intake($1, $2::jsonb, '{}'::jsonb)", [
      code,
      JSON.stringify({ name: "Heco Person", email: "heco@example.org", consent: "yes" }),
    ]);
    const entryId = (await db.query<{ id: string }>("select id from entries where session_id = $1", [sid])).rows[0].id;

    // HENT staff may not log an email against a HECO entry.
    await expect(
      asUser(db, HENT_STAFF, "insert into email_log (entry_id, to_email, subject, body, status) values ($1, 'y@example.org', 's', 'b', 'not_configured')", [entryId]),
    ).rejects.toThrow(/row-level security/);
  });
});
