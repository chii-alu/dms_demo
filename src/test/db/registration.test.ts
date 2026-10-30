// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, setupDb } from "./harness";

let db: PGlite;
let CODE: string;

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
  return asAnon(db, "select public.submit_session_registration($1, $2::jsonb, $3::jsonb) as r", [code, JSON.stringify(profile), JSON.stringify(answers)]);
}

beforeAll(async () => {
  db = await setupDb();
  CODE = (await db.query<{ code: string }>("select code from forms where template = 'masterclass_series'")).rows[0].code;
});

describe("masterclass session in the platform", () => {
  it("is a HENT Masterclass session with its intake, attendance and feedback forms", async () => {
    const r = await db.query<{ pillar: string; intervention: string; title: string; dates: string[]; codes: string[] }>(
      `select s.pillar::text, i.name as intervention, s.title, s.dates::text[] as dates, array_agg(f.code order by f.kind::text) as codes
       from sessions s join interventions i on i.id = s.intervention_id join forms f on f.session_id = s.id
       where s.cohort_id is not null group by s.id, i.name, s.title, s.dates`,
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].pillar).toBe("HENT");
    expect(r.rows[0].intervention).toBe("Masterclass");
    expect(r.rows[0].dates).toEqual(["2026-10-30", "2026-11-06", "2026-11-13", "2026-11-20"]);
    expect(CODE).toMatch(/^HENT-M-\d{3}-REG$/);
    expect(r.rows[0].codes).toHaveLength(3);
  });

  it("is served through the public form lookup, with its template and questions", async () => {
    const r = await asAnon(db, "select public.get_public_form($1) as f", [CODE]);
    const f = r.rows[0].f;
    expect(f.status).toBe("open");
    expect(f.template).toBe("masterclass_series");
    expect(f.questions.map((q: { id: string }) => q.id)).toContain("student_email");
    const student = f.questions.find((q: { id: string }) => q.id === "student_email");
    expect(student.emailDomains).toEqual(["alustudent.com", "alumni.alustudent.com"]);
  });

  it("does not reveal registrants through the public lookup", async () => {
    await submit(alu({ student_email: "reveal.check@alustudent.com", email: "reveal@example.org" }));
    const r = await asAnon(db, "select public.get_public_form($1)::text as f", [CODE]);
    expect(r.rows[0].f).not.toMatch(/reveal/);
  });

  it("returns nothing for an unknown form", async () => {
    const r = await asAnon(db, "select public.get_public_form('HENT-X-999-REG') as f");
    expect(r.rows[0].f).toBeNull();
  });

  it("anonymous visitors cannot read anyone's identity or call the internal registration", async () => {
    await expect(asAnon(db, "select * from public.beneficiary_identity")).rejects.toThrow(/permission denied/);
    await expect(asAnon(db, "select public.register_for_cohort(gen_random_uuid(), '{}'::jsonb, '{}'::jsonb)")).rejects.toThrow(/permission denied/);
  });

  it("registers a new ALU student: creates the person, the application and the registration", async () => {
    const r = await submit(alu());
    expect(r.rows[0].r).toEqual({ registered: true });
    const who = await db.query<{ chii_id: string; email: string; residence_area: string }>(
      "select i.chii_id, i.email::text, b.residence_area from beneficiary_identity i join beneficiary b on b.chii_id = i.chii_id where i.student_email = 'amina.k@alustudent.com'",
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
    // A second session with its own cohort and intake form, so the same student can register again.
    await db.exec(`
      insert into cohort (intervention_id, label, mode)
        select id, 'Startup Finance Second Run', 'Online' from interventions where name = 'Masterclass' and pillar = 'HENT';
      insert into sessions (intervention_id, pillar, kind, title, dates, mode, cohort_id)
        select i.id, i.pillar, 'registration', 'Second run', array['2026-12-01']::date[], 'Online', c.id
        from interventions i, cohort c where i.name = 'Masterclass' and c.label = 'Startup Finance Second Run';
      insert into forms (session_id, kind, code, status, questions, template)
        select s.id, 'intake', 'HENT-M-099-REG', 'open', '[]', 'masterclass_series' from sessions s where s.title = 'Second run';
    `);
    const before = await db.query<{ chii_id: string; n: number }>(
      "select i.chii_id, (select count(*)::int from beneficiary) as n from beneficiary_identity i where i.student_email = 'amina.k@alustudent.com'",
    );
    await submit(alu({ email: "amina.other@example.org", phone: "+250700000000", residence: "Rural" }), "HENT-M-099-REG");
    const after = await db.query<{ chii_id: string; n: number; email: string; phone: string; residence_area: string }>(
      "select i.chii_id, (select count(*)::int from beneficiary) as n, i.email::text, i.phone, b.residence_area from beneficiary_identity i join beneficiary b on b.chii_id = i.chii_id where i.student_email = 'amina.k@alustudent.com'",
    );
    expect(after.rows[0].chii_id).toBe(before.rows[0].chii_id);
    expect(after.rows[0].n).toBe(before.rows[0].n);
    expect(after.rows[0].email).toBe("amina.personal@example.org");
    expect(after.rows[0].phone).toBe("+250784650219");
    expect(after.rows[0].residence_area).toBe("Urban");
  });

  it("registers a student from another institution with the full About you answers", async () => {
    await submit({
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
    });
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
    await db.exec(`update forms set status = 'closed' where code = '${CODE}'`);
    await expect(submit(alu({ student_email: "closed.test@alustudent.com", email: "closed@example.org" }))).rejects.toThrow(/not accepting responses/);
    await db.exec(`update forms set status = 'open' where code = '${CODE}'`);
  });

  it("refuses a form that is not a masterclass registration", async () => {
    await db.exec("update forms set template = null where code = '" + CODE + "'");
    await expect(submit(alu({ student_email: "plain.form@alustudent.com", email: "plain@example.org" }))).rejects.toThrow(/not a masterclass registration/);
    await db.exec("update forms set template = 'masterclass_series' where code = '" + CODE + "'");
  });
});
