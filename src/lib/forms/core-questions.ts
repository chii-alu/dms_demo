// Standard (locked) questions, always rendered first (SPEC §5). Wording from the prototype.
export type CoreQuestion = { id: string; label: string; type: string; required: boolean };

export const INTAKE_CORE: CoreQuestion[] = [
  { id: "name", label: "Full name", type: "text", required: true },
  { id: "email", label: "Email address", type: "email", required: true },
  { id: "phone", label: "Phone number", type: "text", required: true },
  { id: "gender", label: "Gender", type: "single", required: true },
  { id: "age", label: "Age group", type: "single", required: true },
  { id: "country", label: "Country of residence", type: "text", required: true },
  { id: "affiliation", label: "Current affiliation", type: "single", required: true },
  { id: "disability", label: "Do you identify as a person with a disability?", type: "single", required: true },
  {
    id: "consent",
    label: "I consent to my information being used to run this programme and for monitoring, evaluation and learning.",
    type: "consent",
    required: true,
  },
];

export const FEEDBACK_CORE: CoreQuestion[] = [
  { id: "email", label: "Email you registered with", type: "email", required: true },
  { id: "sat", label: "Overall, how satisfied are you with this session?", type: "rating", required: true },
  { id: "rel", label: "How relevant was the content to your goals?", type: "rating", required: true },
  {
    id: "nps",
    label: "How likely are you to recommend this to a friend or colleague?",
    type: "scale10",
    required: true,
  },
  { id: "learn", label: "What is the most useful thing you took away?", type: "long", required: false },
  { id: "improve", label: "What should we improve next time?", type: "long", required: false },
];
