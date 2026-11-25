import { z } from "zod";

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const TurnSchema = z.object({
  segments: z
    .array(z.object({ speaker: shortText(60), text: shortText(600) }))
    .min(1)
    .max(6),
  stateChanges: z
    .object({
      addCharacters: z
        .array(
          z.object({
            name: shortText(60),
            personality: shortText(300),
            look: shortText(300),
            voice: z.string().optional(),
          }),
        )
        .max(3)
        .optional(),
      addObjects: z.array(shortText(120)).max(5).optional(),
      plotNotes: z.array(shortText(300)).max(5).optional(),
    })
    .prefault({}),
  advanceBeat: z.boolean().default(false),
  imagePrompt: z.string().trim().max(800).nullish(),
  motionPrompt: z.string().trim().max(300).nullish(),
  awaitChild: z.boolean().default(false),
  isEnding: z.boolean().default(false),
});

export type Turn = z.infer<typeof TurnSchema>;

const VoiceField = z.string().optional();

export const CreateReplySchema = z.object({
  say: shortText(600),
  done: z.boolean().default(false),
  story: z
    .object({
      title: shortText(80),
      emoji: z.string().max(8).optional(),
      blurb: shortText(300),
      setting: shortText(400),
      characters: z
        .array(
          z.object({
            name: shortText(60),
            personality: shortText(300),
            look: shortText(300),
            voice: VoiceField,
          }),
        )
        .min(1)
        .max(5),
      beats: z.array(z.object({ title: shortText(80), goal: shortText(300) })).min(3).max(7),
    })
    .nullish(),
});

export type CreateReply = z.infer<typeof CreateReplySchema>;

export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model output");
  return JSON.parse(body.slice(start, end + 1));
}
