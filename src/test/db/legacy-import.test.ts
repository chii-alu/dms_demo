// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN, HENT_STAFF, asUser, setupDb } from "./harness";

const BATCH = "00000000-0000-4000-8000-0000000000aa";
const row = (email: string, names: string, extra: Record<string, string> = {}) => ({
  Email: email, Names: names, "Enrollment Status": "Enrolled", "Gender Identity": "Male", "Year Group": "2024 May",
  "Primary Academic Program": "BSc (Hons) Entrepreneurial Leadership", Nationality: "Rwandan",
  "Primary Educational Institution": "African Leadership University (Rwanda)", "Country of Residence": "Rwanda",
  "City of Residence": "Kigali", "Student ID": "1819444634", Gender: "Man", "Financial Standing": "Good Standing",
  "Academic Standing": "Good Standing", "Disciplinary Standing": "Good Standing", "Country of Birth": "Nigeria",
  "Has Humanitarian Status": "0", "Disability Status": "0", ...extra,
});

let db: PGlite;
beforeAll(async () => {
  db = await setupDb();
  await db.exec(`insert into legacy_import_batches (id, source_file_name, file_sha256, row_count) values ('${BATCH}', 't.csv', 'x', 5)`);
  const rows = [
    row("a.adebayo@alustudent.com", "Adamu Itunu Adebayo"),
    row("a.adebayo@alustudent.com", "Adamu Itunu Adebayo"), // same email again: same person
    row("grad@alumni.alueducation.com", "Graduate Person", { "Enrollment Status": "Graduated", "Student ID": "1111" }),
    row("nameless@x.org", "", { "Student ID": "3333" }),  // no name: still imported, with a CHII ID
    row("one@x.org", "Angel Ingabire", { "Student ID": "2222" }),
    row("two@x.org", "Angel Ingabire", { "Student ID": "9999" }), // same name, different email: different person
    row("p1@x.org", "Placeholder One", { "Student ID": "Unreported" }), // placeholder IDs do not match anyone
    row("p2@x.org", "Placeholder Two", { "Student ID": "Unreported" }),
  ];
  for (const [i, r] of rows.entries()) {
    await db.query("insert into legacy_import_rows (batch_id, row_no, raw) values ($1, $2, $3::jsonb)", [BATCH, i + 1, JSON.stringify(r)]);
  }
  await db.exec(`update legacy_import_batches set status = 'staged' where id = '${BATCH}'`);
});

describe("legacy import (admin only, as the sheet is)", () => {
  it("imports the rows, reuses one person for a repeated email, and keeps same-name and placeholder-ID people apart", async () => {
    const r = await asUser(db, ADMIN, "select public.import_legacy_batch($1) as r", [BATCH]);
    expect(r.rows[0].r).toEqual({ imported: 8, rejected: 0, imported_without_name: 1 });

    const people = await db.query<{ n: number }>("select count(*)::int n from beneficiary");
    expect(people.rows[0].n).toBe(7); // adebayo, graduate, nameless, one, two, placeholder one, placeholder two
    const ch = await db.query<{ n: number }>("select count(distinct chii_id)::int n from legacy_import_rows where status = 'imported'");
    expect(ch.rows[0].n).toBe(7);
  });

  it("keeps the sheet's values as given: country names, year group, standing and institution", async () => {
    const r = await db.query<Record<string, string>>(`
      select b.nationality, b.birth_country, b.residence_country, sp.year_group, sp.enrolment_status,
             ss.financial_status, i.name as institution
      from beneficiary b
      join beneficiary_identity bi on bi.chii_id = b.chii_id
      join student_profile sp on sp.chii_id = b.chii_id
      join student_standing ss on ss.chii_id = b.chii_id
      join institution i on i.id = sp.institution_id
      where bi.email = 'a.adebayo@alustudent.com'`);
    expect(r.rows[0]).toEqual({
      nationality: "Rwandan", birth_country: "Nigeria", residence_country: "Rwanda", year_group: "2024 May",
      enrolment_status: "Enrolled", financial_status: "Good Standing", institution: "African Leadership University (Rwanda)",
    });
  });

  it("gives the graduate the alumni type, and gives the nameless person a CHII ID with a blank name flagged for completion", async () => {
    const t = await db.query<{ type: string }>(`select bt.type from beneficiary_type bt join beneficiary_identity bi on bi.chii_id = bt.chii_id where bi.email = 'grad@alumni.alueducation.com'`);
    expect(t.rows[0].type).toBe("alumni");
    const n = await db.query<{ chii_id: string; full_name: string; issue: string }>(
      `select r.chii_id, bi.full_name, r.issue from legacy_import_rows r join beneficiary_identity bi on bi.chii_id = r.chii_id where r.raw->>'Email' = 'nameless@x.org'`);
    expect(n.rows[0].chii_id).toMatch(/^CHII-\d{6}$/);
    expect(n.rows[0].full_name).toBe("");
    expect(n.rows[0].issue).toMatch(/name missing/);
  });

  it("is not available to pillar staff", async () => {
    await expect(asUser(db, HENT_STAFF, "select public.import_legacy_batch($1)", [BATCH])).rejects.toThrow(/Only admins/);
  });
});
