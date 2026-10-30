// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN, asAnon, asUser, setupDb } from "./harness";

let db: PGlite;

// Dates far in the future keep the status assertions stable.
const FUTURE = ["2099-06-01", "2099-06-02"];

const ivId = async (name: string) =>
  (await db.query<{ id: string }>("select id from interventions where name = $1", [name])).rows[0].id;

async function session(name: string, rubric: boolean) {
  const r = await asUser(
    db,
    ADMIN,
    `select public.create_session($1, 'R', $2::date[], 'Online', null, null, null, null, '[]', '[]', $3::jsonb) as id`,
    [await ivId(name), FUTURE, rubric ? JSON.stringify([{ name: "Impact", weight: 100 }]) : null],
  );
  const sid = r.rows[0].id as string;
  await db.exec(`update forms set status = 'open' where session_id = '${sid}'`);
  const code = (await db.query<{ code: string }>("select code from forms where session_id = $1 and kind = 'intake'", [sid])).rows[0].code;
  return { sid, code };
}

const apply = (code: string, email: string) =>
  asAnon(db, "select public.submit_intake($1, $2::jsonb, '{}'::jsonb) as r", [
    code,
    JSON.stringify({ name: email, email, gender: "Female", age: "18–24", country: "Kenya", consent: "yes" }),
  ]);

beforeAll(async () => {
  db = await setupDb();
});

describe("v_session_summary", () => {
  it("counts intake, eligible, attendance and feedback for a selective session", async () => {
    const { sid, code } = await session("Venture Funding", true);
    for (const e of ["r1@example.org", "r2@example.org", "r3@example.org"]) await apply(code, e);
    // Select the first two, then mark one of them present.
    const ids = (await db.query<{ id: string }>("select id from entries where session_id = $1 order by submitted_at, id", [sid])).rows.map((r) => r.id);
    await asUser(db, ADMIN, "select public.set_entry_statuses($1, $2, 'selected')", [sid, ids.slice(0, 2)]);
    const p1 = (await db.query<{ participant_id: string }>("select participant_id from entries where id = $1", [ids[0]])).rows[0].participant_id;
    await asUser(db, ADMIN, "select public.set_attendance($1, $2, '2099-06-01'::date, true)", [sid, p1]);

    const r = await db.query<Record<string, unknown>>("select * from v_session_summary where session_id = $1", [sid]);
    const row = r.rows[0];
    // numeric columns come back as strings, so compare them as numbers
    expect({ ...row, attendance_rate: Number(row.attendance_rate) }).toMatchObject({
      status: "upcoming",
      intake_count: 3,
      eligible_count: 2,
      unique_attendees: 1,
      attendance_rate: 50,
    });
  });

  it("reports NPS and averages from feedback", async () => {
    const { sid, code } = await session("Masterclass", false);
    await apply(code, "fb1@example.org");
    await apply(code, "fb2@example.org");
    const attCode = (await db.query<{ code: string }>("select code from forms where session_id = $1 and kind = 'attendance'", [sid])).rows[0].code;
    for (const e of ["fb1@example.org", "fb2@example.org"]) {
      await asAnon(db, "select public.submit_checkin($1, $2, '2099-06-01'::date)", [attCode, e]);
    }
    const fbCode = (await db.query<{ code: string }>("select code from forms where session_id = $1 and kind = 'feedback'", [sid])).rows[0].code;
    await asAnon(db, "select public.submit_feedback($1, 'fb1@example.org', 5, 5, 10, null, null, '{}'::jsonb)", [fbCode]);
    await asAnon(db, "select public.submit_feedback($1, 'fb2@example.org', 3, 4, 3, null, null, '{}'::jsonb)", [fbCode]);
    const r = await db.query<{ feedback_count: number; avg_satisfaction: number; nps: number; response_rate: number }>(
      "select feedback_count, avg_satisfaction, nps, response_rate from v_session_summary where session_id = $1",
      [sid],
    );
    expect(r.rows[0].feedback_count).toBe(2);
    expect(Number(r.rows[0].avg_satisfaction)).toBeCloseTo(4, 2);
    expect(Number(r.rows[0].nps)).toBe(0); // one promoter (10), one detractor (3)
    expect(Number(r.rows[0].response_rate)).toBe(100);
  });
});

describe("reporting access (SPEC §8)", () => {
  it("dashboard_reader can read the views", async () => {
    await db.exec("set role dashboard_reader");
    try {
      const r = await db.query<{ n: number }>("select count(*)::int n from v_session_summary");
      expect(r.rows[0].n).toBeGreaterThan(0);
    } finally {
      await db.exec("reset role");
    }
  });

  it("anon cannot read the old session views", async () => {
    await expect(asAnon(db, "select * from v_session_summary")).rejects.toThrow(/permission denied/);
  });

  it("dashboard_reader cannot read the base tables", async () => {
    await db.exec("set role dashboard_reader");
    try {
      await expect(db.query("select * from participants")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});
