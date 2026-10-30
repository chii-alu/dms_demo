// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN, HENT_STAFF, asAnon, asUser, setupDb } from "./harness";

let db: PGlite;
const ivId = async (name: string) =>
  (await db.query<{ id: string }>("select id from interventions where name = $1", [name])).rows[0].id;

async function session(name: string, dates = ["2026-11-12", "2026-11-13"], capacity: number | null = null) {
  const r = await asUser(
    db,
    ADMIN,
    `select public.create_session($1, 'A', $2::date[], 'Online', null, null, $3, null, '[]', '[]', $4::jsonb) as id`,
    [await ivId(name), dates, capacity, name === "Masterclass" ? null : JSON.stringify([{ name: "Impact", weight: 100 }])],
  );
  const sid = r.rows[0].id as string;
  await db.exec(`update forms set status = 'open' where session_id = '${sid}'`);
  return sid;
}

const pid = async (email: string) =>
  (await db.query<{ id: string }>("select id from participants where email = $1", [email])).rows[0].id;

async function attendanceCount(sid: string) {
  return (await db.query<{ n: number }>("select count(*)::int n from attendance where session_id = $1", [sid])).rows[0].n;
}


// Submit an intake through the public RPC. The code is read as the owner, since anon cannot see forms.
async function register(sid: string, email: string, name = email) {
  const code = (await db.query<{ code: string }>("select code from forms where session_id = $1 and kind = 'intake'", [sid])).rows[0].code;
  return asAnon(db, "select public.submit_intake($1, $2::jsonb, '{}'::jsonb) as r", [
    code,
    JSON.stringify({ name, email, consent: "yes" }),
  ]);
}

beforeAll(async () => {
  db = await setupDb();
});

describe("set_attendance (SPEC §4.10 eligibility)", () => {
  it("marks an eligible participant present and back to absent", async () => {
    const sid = await session("Masterclass");
    await register(sid, "toggle@example.org", "Toggle");
    const p = await pid("toggle@example.org");
    await asUser(db, ADMIN, "select public.set_attendance($1, $2, '2026-11-12'::date, true)", [sid, p]);
    expect(await attendanceCount(sid)).toBe(1);
    await asUser(db, ADMIN, "select public.set_attendance($1, $2, '2026-11-12'::date, false)", [sid, p]);
    expect(await attendanceCount(sid)).toBe(0);
  });

  it("refuses to mark a pending applicant present", async () => {
    const sid = await session("Ventures");
    await register(sid, "pending2@example.org", "Pending");
    await expect(
      asUser(db, ADMIN, "select public.set_attendance($1, $2, '2026-11-12'::date, true)", [sid, await pid("pending2@example.org")]),
    ).rejects.toThrow(/Only eligible/);
  });

  it("refuses a date that is not a session date", async () => {
    const sid = await session("Masterclass");
    await expect(
      asUser(db, ADMIN, "select public.set_attendance($1, $2, '2030-01-01'::date, true)", [sid, await pid("toggle@example.org")]),
    ).rejects.toThrow(/session dates/);
  });
});

describe("mark_all_present", () => {
  it("marks every eligible participant once and reports the number newly marked", async () => {
    const sid = await session("Masterclass");
    for (const e of ["m1@example.org", "m2@example.org"]) {
      await register(sid, e);
    }
    const first = await asUser(db, ADMIN, "select public.mark_all_present($1, '2026-11-12'::date) as n", [sid]);
    expect(first.rows[0].n).toBe(2);
    const second = await asUser(db, ADMIN, "select public.mark_all_present($1, '2026-11-12'::date) as n", [sid]);
    expect(second.rows[0].n).toBe(0);
  });
});

describe("add_walkin (SPEC §4.11)", () => {
  const walkin = (sid: string, email: string, date = "2026-11-12") =>
    asUser(db, ADMIN, "select public.add_walkin($1, $2::jsonb, $3::date) as r", [
      sid,
      JSON.stringify({ name: "Walk In", email, consent: "yes" }),
      date,
    ]);

  it("creates a registered walk-in and marks them present", async () => {
    const sid = await session("Masterclass");
    await walkin(sid, "walk@example.org");
    const e = await db.query<{ status: string; source: string }>(
      "select status, source from entries where session_id = $1", [sid]);
    expect(e.rows).toEqual([{ status: "registered", source: "walkin" }]);
    expect(await attendanceCount(sid)).toBe(1);
  });

  it("ignores capacity: walk-ins are always registered", async () => {
    const sid = await session("Masterclass", ["2026-11-12"], 1);
    await walkin(sid, "w1@example.org");
    await walkin(sid, "w2@example.org");
    const s = await db.query<{ status: string }>("select status from entries where session_id = $1", [sid]);
    expect(s.rows.every((r) => r.status === "registered")).toBe(true);
  });

  it("refuses walk-ins at selective sessions", async () => {
    const sid = await session("Ventures");
    await expect(walkin(sid, "nope@example.org")).rejects.toThrow(/only for open sessions/);
  });

  it("refuses a second check-in for the same person on the same day", async () => {
    const sid = await session("Masterclass");
    await walkin(sid, "again@example.org");
    await expect(walkin(sid, "again@example.org")).rejects.toThrow(/already checked in/);
    await expect(walkin(sid, "again@example.org", "2026-11-13")).resolves.toBeDefined();
  });

  it("pillar staff cannot add walk-ins to another pillar's session", async () => {
    const sid = await session("Public Sector Fellowship");
    const r = await asUser(db, HENT_STAFF, "select public.add_walkin($1, $2::jsonb, '2026-11-12'::date) as r", [
      sid,
      JSON.stringify({ name: "X", email: "x@example.org", consent: "yes" }),
    ]).catch((e: Error) => e);
    expect(r).toBeInstanceOf(Error);
  });
});
