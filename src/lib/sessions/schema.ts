import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { questionsSchema } from "@/lib/forms/questions";

const isoDate = z.string().refine(isIsoDate, "Use a real date in YYYY-MM-DD form");

export const MODES = ["In person", "Online", "Hybrid"] as const;

// Shared by the New session dialog and the Details tab (SPEC §7 modal fields).
export const sessionInputSchema = z.object({
  title: z.string().trim().min(1, "Give the session a title.").max(200),
  dates: z
    .array(isoDate)
    .min(1, "Add at least one date.")
    .transform((ds) => [...new Set(ds)].sort()),
  mode: z.enum(MODES),
  capacity: z.number().int("Capacity must be a whole number.").min(0).nullable(),
  venue: z.string().trim().max(200),
  facilitator: z.string().trim().max(200),
  applicationDeadline: isoDate.nullable(),
});
export type SessionInput = z.input<typeof sessionInputSchema>;
export type SessionValues = z.output<typeof sessionInputSchema>;

export const rubricSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1, "Name the criterion.").max(120),
      weight: z.number().int().min(0, "0 to 100").max(100, "0 to 100"),
    }),
  )
  .min(1, "Add at least one criterion.")
  .max(10);

export const formKindSchema = z.enum(["intake", "feedback"]);
export const formStatusSchema = z.enum(["draft", "open", "closed"]);

export { questionsSchema };
