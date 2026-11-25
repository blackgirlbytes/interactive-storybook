import { z } from "zod";

export const PhonicsSchema = z.object({
  parts: z
    .array(z.object({ letters: z.string().trim().min(1).max(12), say: z.string().trim().min(1).max(40) }))
    .min(1)
    .max(10),
});

export type Phonics = z.infer<typeof PhonicsSchema>;

/** Letters, lowercased, with apostrophes and marks normalized, for comparing a split with its word. */
export const spelling = (s: string) => s.normalize("NFC").toLowerCase().replace(/[’']/g, "");

/** Words a child can tap: letters only, short enough to sound out. */
export const PhonicsWord = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[\p{L}\p{M}'’-]+$/u, "Only single words can be sounded out");
