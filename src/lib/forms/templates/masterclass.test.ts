import { describe, expect, it } from "vitest";
import { MASTERCLASS_TEMPLATE, MASTERCLASS_SESSIONS } from "./masterclass";
import { validateAnswers, visibleFields } from "../fields";

const session = [MASTERCLASS_SESSIONS[0]];
const sectionB = { sessions: session, knowledge: "Beginner: I understand the basics", hope: "Learn to budget", consent: "yes" };
const aluAnswers = { institution: "ALU", student_email: "a.student@alustudent.com", personal_email: "a@example.org", whatsapp: "+250784650219", residence: "Urban", ...sectionB };
const fullAnswers = {
  institution: "Other",
  institution_other: "University of Rwanda",
  full_name: "Aline Uwase",
  personal_email: "aline@example.org",
  gender: "Female",
  year_of_birth: 1999,
  enrolment_status: "Current student",
  programme: "Economics",
  enrolment_year: 2024,
  nationality: "Rwandan",
  country_of_residence: "Rwanda",
  disability: "No",
  humanitarian: "None",
  current_status: "Student",
  whatsapp: "+250784650219",
  residence: "Rural",
  ...sectionB,
};

describe("masterclass template branching", () => {
  it("an ALU student is asked for the student email, personal email, WhatsApp and residence, then the masterclass", () => {
    const ids = visibleFields(MASTERCLASS_TEMPLATE, { institution: "ALU" }).map((f) => f.id);
    expect(ids).toEqual(["institution", "student_email", "personal_email", "whatsapp", "residence", "consent", "sessions", "knowledge", "hope"]);
  });

  it("an ALX or Other student is asked all of About you, and not the student email", () => {
    const ids = visibleFields(MASTERCLASS_TEMPLATE, { institution: "Other" }).map((f) => f.id);
    expect(ids).toContain("full_name");
    expect(ids).toContain("whatsapp");
    expect(ids).toContain("institution_other");
    expect(ids).not.toContain("student_email");
    const alx = visibleFields(MASTERCLASS_TEMPLATE, { institution: "ALX" }).map((f) => f.id);
    expect(alx).toContain("full_name");
    expect(alx).not.toContain("institution_other");
  });

  it("nothing about the About you questions is asked before an institution is chosen", () => {
    const ids = visibleFields(MASTERCLASS_TEMPLATE, {}).map((f) => f.id);
    expect(ids).toEqual(["institution", "personal_email", "whatsapp", "residence", "consent", "sessions", "knowledge", "hope"]);
  });

  it("accepts a complete ALU registration and drops the answers that were not asked", () => {
    const r = validateAnswers(MASTERCLASS_TEMPLATE, { ...aluAnswers, full_name: "should be dropped" });
    expect(r.success).toBe(true);
    expect(r.success && r.data).not.toHaveProperty("full_name");
    expect(r.success && r.data.student_email).toBe("a.student@alustudent.com");
  });

  it("asks ALU students for their WhatsApp number", () => {
    const r = validateAnswers(MASTERCLASS_TEMPLATE, { ...aluAnswers, whatsapp: undefined });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues.map((i) => i.path[0])).toContain("whatsapp");
  });

  it("asks ALU students for an ALU student email address, and does not ask for their name", () => {
    const ids = visibleFields(MASTERCLASS_TEMPLATE, { institution: "ALU" }).map((f) => f.id);
    expect(ids).not.toContain("full_name");
    const wrong = validateAnswers(MASTERCLASS_TEMPLATE, { ...aluAnswers, student_email: "amina@gmail.com" });
    expect(wrong.success).toBe(false);
    expect(!wrong.success && wrong.error.issues.map((i) => i.path[0])).toContain("student_email");
    expect(validateAnswers(MASTERCLASS_TEMPLATE, { ...aluAnswers, student_email: "amina@alustudent.com" }).success).toBe(true);
    expect(validateAnswers(MASTERCLASS_TEMPLATE, { ...aluAnswers, student_email: "amina@alumni.alustudent.com" }).success).toBe(true);
    expect(validateAnswers(MASTERCLASS_TEMPLATE, { ...aluAnswers, student_email: "s.babalola@alumni.alustudent.com" }).success).toBe(true);
  });

  it("requires the student email for ALU students", () => {
    const r = validateAnswers(MASTERCLASS_TEMPLATE, { ...aluAnswers, student_email: undefined });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues.map((i) => i.path[0])).toContain("student_email");
  });

  it("accepts a complete registration from another institution, and drops the student email", () => {
    const r = validateAnswers(MASTERCLASS_TEMPLATE, { ...fullAnswers, student_email: "x@alustudent.com" });
    expect(r.success).toBe(true);
    expect(r.success && r.data).not.toHaveProperty("student_email");
    expect(r.success && r.data.whatsapp).toBe("+250784650219");
  });

  it("asks every About you question from another institution", () => {
    const missingPhone: Record<string, unknown> = { ...fullAnswers, whatsapp: undefined };
    const r = validateAnswers(MASTERCLASS_TEMPLATE, missingPhone);
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues.map((i) => i.path[0])).toContain("whatsapp");
  });

  it("requires at least one masterclass", () => {
    const r = validateAnswers(MASTERCLASS_TEMPLATE, { ...aluAnswers, sessions: [] });
    expect(r.success).toBe(false);
  });
});
