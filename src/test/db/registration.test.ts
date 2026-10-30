// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN, asAnon, asUser, setupDb } from "./harness";

let db: PGlite;
const CODE = "startup-finance-2026";

const alu = (over: Record<string, unknown> = {}) => ({
  institution: "ALU",
  student_email: "amina.k@alustudent.com",
  email: "amina.personal@example.org",
  phone: "+250784650219",
  residence: "Urban",
  consent: "yes",
  ...over,
});
const answers = { sessions: ["Budgeting, Cash Flow & Startup Finance (Fri 30 Oct)"], knowledge: "Beginner", hope: "Budget better" };

async function submit(profile: Record<string, unknown>, code = CODE) {
  return asAnon(db, "select public.submit_registration($1, $2::jsonb, $3::jsonb) as r", [code, JSON.stringify(profile), JSON.stringify(answers)]);
}

beforeAll(async () => {
  db = await setupDb();
});

describe("masterclass registration form", () => {
  it("is open, with its questions and the four session dates, and reveals no registrants", async () => {
    const r = await asAnon(db, "select public.get_registration_form($1) as f", [CODE]);
    const f = r.rows[0].f;
    expect(f.status).toBe("open");
    expect(f.dates).toEqual(["2026-10-30", "2026-11-06", "2026-11-13", "2026-11-20"]);
    expect(f.questions.map((q: { id: string }) => q.id)).toContain("student_email");
    expect(JSON.stringify(f)).not.toMatch(/amina/);
  });

  it("asks for the ALU student email only on the ALU domains", async () => {
    const r = await asAnon(db, "select public.get_registration_form($1) as f", [CODE]);
    const student = r.rows[0].f.questions.find((q: { id: string }) => q.id === "student_email");
    expect(student.emailDomains).toEqual(["alustudent.com", "alumni.alustudent.com"]);
  });

  it("returns nothing for an unknown form", async () => {
    const r = await asAnon(db, "select public.get_registration_form('no-such-form') as f");
    expect(r.rows[0].f).toBeNull();
  });

  it("anonymous visitors cannot read the registration forms or anyone's identity", async () => {
    expect((await asAnon(db, "select * from public.registration_form")).rows).toHaveLength(0);
    await expect(asAnon(db, "select * from public.beneficiary_identity")).rejects.toThrow(/permission denied/);
  });

  it("registers a new ALU student: creates the person, the application and the registration", async () => {
    const r = await submit(alu({ full_name: undefined }));
    expect(r.rows[0].r).toEqual({ registered: true });
    const who = await db.query<{ chii_id: string; student_email: string; email: string; phone: string; residence_area: string }>(
      "select i.chii_id, i.student_email::text, i.email::text, i.phone, b.residence_area from beneficiary_identity i join beneficiary b on b.chii_id = i.chii_id where i.student_email = 'amina.k@alustudent.com'",
    );
    expect(who.rows).toHaveLength(1);
    expect(who.rows[0].email).toBe("amina.personal@example.org");
    expect(who.rows[0].residence_area).toBe("Urban");
    const p = await db.query<{ status: string }>("select status from participation where chii_id = $1", [who.rows[0].chii_id]);
    expect(p.rows[0].status).toBe("registered");
  });

  it("refuses a second registration for the same person in the same series, without saying who they are", async () => {
    await expect(submit(alu())).rejects.toThrow(/already registered for this masterclass series/);
  });

  it("a returning student keeps their existing record and fills in only what is missing", async () => {
    // A second series, so the same student can register again.
    await db.exec(`
      insert into cohort (intervention_id, label, mode)
        select id, 'Startup Finance Second Run', 'Online' from interventions where name = 'Masterclass' and pillar = 'HENT';
      insert into registration_form (code, title, cohort_id, questions, status)
        select 'startup-finance-second', 'Second run', c.id, '[]'::jsonb, 'open' from cohort c where c.label = 'Startup Finance Second Run';
    `);
    const before = await db.query<{ chii_id: string; n: number }>(
      "select i.chii_id, (select count(*)::int from beneficiary) as n from beneficiary_identity i where i.student_email = 'amina.k@alustudent.com'",
    );
    await submit(alu({ email: "amina.other@example.org", phone: "+250700000000", residence: "Rural" }), "startup-finance-second");
    const after = await db.query<{ chii_id: string; n: number; email: string; phone: string; residence_area: string }>(
      "select i.chii_id, (select count(*)::int from beneficiary) as n, i.email::text, i.phone, b.residence_area from beneficiary_identity i join beneficiary b on b.chii_id = i.chii_id where i.student_email = 'amina.k@alustudent.com'",
    );
    expect(after.rows[0].chii_id).toBe(before.rows[0].chii_id);
    expect(after.rows[0].n).toBe(before.rows[0].n);
    // Existing details stay as they were.
    expect(after.rows[0].email).toBe("amina.personal@example.org");
    expect(after.rows[0].phone).toBe("+250784650219");
    expect(after.rows[0].residence_area).toBe("Urban");
  });

  it("registers a student from another institution with the full About you answers", async () => {
    const profile = {
      institution: "Other",
      full_name: "Jean Claude Habimana",
      email: "jc.habimana@example.org",
      phone: "+250788000111",
      gender: "Male",
      nationality: "Rwandan",
      country_of_residence: "Rwanda",
      disability: "No",
      humanitarian: "None",
      residence: "Peri Urban",
      enrolment_status: "Graduate",
      programme: "Engineering",
      consent: "yes",
    };
    await submit(profile);
    const who = await db.query<{ full_name: string; student_email: string | null; gender: string; nationality: string; academic_programme: string }>(
      "select i.full_name, i.student_email::text, b.gender, b.nationality, sp.academic_programme from beneficiary_identity i join beneficiary b on b.chii_id = i.chii_id left join student_profile sp on sp.chii_id = i.chii_id where i.email = 'jc.habimana@example.org'",
    );
    expect(who.rows[0].full_name).toBe("Jean Claude Habimana");
    expect(who.rows[0].student_email).toBeNull();
    expect(who.rows[0].gender).toBe("Male");
    expect(who.rows[0].nationality).toBe("Rwandan");
    expect(who.rows[0].academic_programme).toBe("Engineering");
  });

  it("asks for the student email from ALU students, and the consent", async () => {
    await expect(submit(alu({ student_email: "" }))).rejects.toThrow(/student email address is needed/);
    await expect(submit(alu({ consent: "no" }))).rejects.toThrow(/Consent is needed/);
  });

  it("refuses a closed form", async () => {
    await db.exec("update registration_form set status = 'closed' where code = 'startup-finance-2026'");
    await expect(submit(alu({ student_email: "closed.test@alustudent.com", email: "closed@example.org" }))).rejects.toThrow(/not accepting responses/);
    await db.exec("update registration_form set status = 'open' where code = 'startup-finance-2026'");
  });

  it("admins can see the registration forms", async () => {
    const r = await asUser(db, ADMIN, "select count(*)::int n from registration_form");
    expect(r.rows[0].n).toBeGreaterThan(0);
  });
});
