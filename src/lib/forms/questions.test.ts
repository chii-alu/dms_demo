import { describe, expect, it } from "vitest";
import { questionSchema, questionsSchema } from "./questions";
import { defaultFeedbackQuestions, defaultIntakeQuestions, DEFAULT_RUBRIC } from "./defaults";
import { rubricWeightWarning } from "../rules/rubric";

describe("questionSchema", () => {
  it("accepts a text question", () => {
    expect(questionSchema.safeParse({ id: "q1", label: "Venture name", type: "text", required: false }).success).toBe(true);
  });
  it("requires options for single and multi choice", () => {
    const r = questionSchema.safeParse({ id: "q1", label: "Stage", type: "single", options: [], required: true });
    expect(r.success).toBe(false);
  });
  it("rejects an empty label", () => {
    expect(questionSchema.safeParse({ id: "q1", label: "  ", type: "text", required: false }).success).toBe(false);
  });
  it("rejects unknown answer types", () => {
    expect(questionsSchema.safeParse([{ id: "q1", label: "x", type: "file", required: false }]).success).toBe(false);
  });
});

describe("pillar defaults (SPEC §5)", () => {
  it("application forms add motivation, goals (required) and a CV link", () => {
    const qs = defaultIntakeQuestions("HENT", "application");
    expect(qs.slice(-3).map((x) => [x.label, x.required])).toEqual([
      ["Why do you want to join this programme?", true],
      ["What do you hope to achieve by the end?", true],
      ["Link to CV or portfolio", false],
    ]);
  });
  it("every default question passes the schema", () => {
    for (const p of ["HENT", "HEMP", "HECO"] as const) {
      expect(questionsSchema.safeParse(defaultIntakeQuestions(p, "registration")).success).toBe(true);
      expect(questionsSchema.safeParse(defaultFeedbackQuestions(p)).success).toBe(true);
    }
  });
  it("default rubric weights add to 100", () => {
    expect(rubricWeightWarning(DEFAULT_RUBRIC.map((r) => r.weight))).toBeNull();
  });
  it("warns when rubric weights do not add to 100", () => {
    expect(rubricWeightWarning([30, 30])).toBe("Weights add up to 60%, not 100%.");
  });
});
