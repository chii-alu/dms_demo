import { z } from "zod";

// Custom question JSON (SPEC §5). Only custom questions are stored in forms.questions.
export const QUESTION_TYPES = [
  "text",
  "long",
  "email",
  "number",
  "date",
  "single",
  "multi",
  "rating",
  "scale10",
  "yesno",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: "Short answer",
  long: "Paragraph",
  email: "Email",
  number: "Number",
  date: "Date",
  single: "Single choice",
  multi: "Multiple choice",
  rating: "Rating 1–5",
  scale10: "Scale 0–10",
  yesno: "Yes / No",
};

const CHOICE_TYPES: QuestionType[] = ["single", "multi"];

export const questionSchema = z
  .object({
    id: z.string().min(1).max(64),
    label: z.string().trim().min(1, "Question text is required").max(300),
    type: z.enum(QUESTION_TYPES),
    options: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
    required: z.boolean(),
    // Shown only when the answer to question `id` is one of `equals`.
    showWhen: z.object({ id: z.string().min(1).max(64), equals: z.array(z.string().min(1)).min(1) }).optional(),
  })
  .superRefine((q, ctx) => {
    if (CHOICE_TYPES.includes(q.type) && (!q.options || q.options.length === 0)) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Add at least one option" });
    }
  });

export const questionsSchema = z.array(questionSchema).max(50);

export type Question = z.infer<typeof questionSchema>;
