import { describe, expect, it } from "vitest";
import { splitRegistration } from "./registration";

describe("splitRegistration", () => {
  it("keeps the person's details on their record, and the rest with the registration", () => {
    const { profile, registration } = splitRegistration({
      institution: "ALU",
      student_email: "a@alustudent.com",
      personal_email: "a@example.org",
      whatsapp: "+250784650219",
      residence: "Urban",
      consent: "yes",
      sessions: ["Budgeting"],
      knowledge: "Beginner",
      hope: "Budget better",
    });
    expect(profile).toEqual({
      institution: "ALU",
      student_email: "a@alustudent.com",
      email: "a@example.org",
      phone: "+250784650219",
      residence: "Urban",
      consent: "yes",
    });
    expect(registration).toEqual({ sessions: ["Budgeting"], knowledge: "Beginner", hope: "Budget better" });
  });

  it("skips answers that were not given", () => {
    const { profile } = splitRegistration({ institution: "ALU", student_email: undefined });
    expect(profile).toEqual({ institution: "ALU" });
  });
});
