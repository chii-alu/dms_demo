import { describe, expect, it } from "vitest";
import { buildValuesSchema, publicFields, type FieldSpec } from "./fields";
import { INTAKE_CORE, FEEDBACK_CORE } from "./core-questions";

const fields: FieldSpec[] = [
  { id: "name", label: "Name", type: "text", required: true },
  { id: "note", label: "Note", type: "long", required: false },
  { id: "stage", label: "Stage", type: "single", required: true, options: ["Idea", "Scaling"] },
  { id: "tags", label: "Tags", type: "multi", required: false, options: ["a", "b"] },
  { id: "sat", label: "Satisfaction", type: "rating", required: true },
  { id: "consent", label: "Consent", type: "consent", required: true },
];

const good = { name: "Aline", stage: "Idea", sat: 4, consent: "yes" };

describe("buildValuesSchema", () => {
  it("accepts a complete, valid answer set and drops empty optional answers", () => {
    const r = buildValuesSchema(fields).safeParse({ ...good, note: "", tags: [] });
    expect(r.success).toBe(true);
    expect(r.success && r.data).not.toHaveProperty("note");
  });

  it("reports a plain message for an empty required text answer", () => {
    const r = buildValuesSchema(fields).safeParse({ ...good, name: "   " });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].message).toBe("This question is required.");
  });

  it("asks for consent with its own message", () => {
    const r = buildValuesSchema(fields).safeParse({ ...good, consent: undefined });
    expect(!r.success && r.error.issues.find((i) => i.path[0] === "consent")?.message).toBe("Consent is needed to continue.");
  });

  it("keeps ratings within 1 to 5", () => {
    expect(buildValuesSchema(fields).safeParse({ ...good, sat: 6 }).success).toBe(false);
    expect(buildValuesSchema(fields).safeParse({ ...good, sat: 0 }).success).toBe(false);
  });

  it("only accepts listed options for single choice", () => {
    expect(buildValuesSchema(fields).safeParse({ ...good, stage: "Other" }).success).toBe(false);
  });
});

describe("publicFields", () => {
  it("intake: standard fields first, then the session's custom questions", () => {
    const f = publicFields("intake", [{ id: "q1", label: "Venture", type: "text", required: false }], []);
    expect(f.slice(0, INTAKE_CORE.length).map((x) => x.id)).toEqual(INTAKE_CORE.map((x) => x.id));
    expect(f.at(-1)?.id).toBe("q1");
  });

  it("feedback: standard fields then custom questions", () => {
    const f = publicFields("feedback", [], []);
    expect(f.map((x) => x.id)).toEqual(FEEDBACK_CORE.map((x) => x.id));
  });

  it("attendance: email and a session date from the session's dates", () => {
    const f = publicFields("attendance", [], ["2026-11-12", "2026-11-13"]);
    expect(f.map((x) => x.id)).toEqual(["email", "day"]);
    expect(f[1].options).toEqual(["2026-11-12", "2026-11-13"]);
  });

  it("the whole intake core validates with a sample participant", () => {
    const schema = buildValuesSchema(publicFields("intake", [], []));
    const r = schema.safeParse({
      name: "Aline", email: "aline@example.org", phone: "+250 78", gender: "Female", age: "18–24",
      country: "Rwanda", affiliation: "Student", disability: "No", consent: "yes",
    });
    expect(r.success).toBe(true);
  });
});
