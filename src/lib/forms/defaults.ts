// Default custom questions and rubric per pillar (SPEC §5). Used when a session is not copied from another.
import type { Question } from "./questions";

export type Pillar = "HENT" | "HEMP" | "HECO";
export type SessionKind = "registration" | "application";

export type RubricDraft = { name: string; weight: number };

const q = (label: string, type: Question["type"], options?: string[], required = false): Question => ({
  id: crypto.randomUUID(),
  label,
  type,
  options,
  required,
});

const PILLAR_QUESTIONS: Record<Pillar, Question[]> = {
  HENT: [q("Venture name (if any)", "text"), q("Venture stage", "single", ["Idea", "Prototype / MVP", "Early revenue", "Scaling"])],
  HEMP: [
    q("Field of study or career interest", "text"),
    q("Current employment status", "single", ["Studying", "Employed", "Self-employed", "Looking for work"]),
  ],
  HECO: [q("Organisation or institution", "text"), q("Current role or position", "text")],
};

const PILLAR_FEEDBACK: Record<Pillar, string> = {
  HENT: "How confident do you feel applying this to your venture?",
  HEMP: "How much did this improve your career readiness?",
  HECO: "How applicable is this to your work in the public or health sector?",
};

export function defaultIntakeQuestions(pillar: Pillar, kind: SessionKind): Question[] {
  const base = PILLAR_QUESTIONS[pillar];
  if (kind === "application") {
    return [
      ...base,
      q("Why do you want to join this programme?", "long", undefined, true),
      q("What do you hope to achieve by the end?", "long", undefined, true),
      q("Link to CV or portfolio", "text"),
    ];
  }
  return [
    ...base,
    q("How did you hear about this session?", "single", ["Social media", "Email", "Friend or colleague", "Campus or office notice", "Other"]),
  ];
}

export function defaultFeedbackQuestions(pillar: Pillar): Question[] {
  return [q(PILLAR_FEEDBACK[pillar], "rating", undefined, true)];
}

export const DEFAULT_RUBRIC: RubricDraft[] = [
  { name: "Motivation and commitment", weight: 30 },
  { name: "Fit with eligibility criteria", weight: 30 },
  { name: "Potential for impact", weight: 40 },
];
