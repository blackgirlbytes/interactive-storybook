import { z } from "zod";

const Character = z.object({
  id: z.string().max(60),
  name: z.string().max(60),
  personality: z.string().max(400),
  look: z.string().max(400),
  voice: z.string().max(40),
  invented: z.boolean().optional(),
});

const Story = z.object({
  id: z.string().max(80),
  title: z.string().max(100),
  emoji: z.string().max(16),
  blurb: z.string().max(400),
  category: z.enum(["fairy-tale", "bible", "fable", "custom"]),
  setting: z.string().max(500),
  artStyle: z.string().max(500),
  narratorVoice: z.string().max(40),
  characters: z.array(Character).max(12),
  beats: z.array(z.object({ title: z.string().max(100), goal: z.string().max(400) })).min(1).max(10),
});

export const StoryStateSchema = z.object({
  story: Story,
  mode: z.enum(["listen", "play"]),
  beatIndex: z.number().int().min(0),
  turnsInBeat: z.number().int().min(0),
  characters: z.array(Character).max(12),
  objects: z.array(z.string().max(200)).max(30),
  plotNotes: z.array(z.string().max(400)).max(40),
  log: z
    .array(
      z.object({
        kind: z.enum(["narration", "dialogue", "child"]),
        speaker: z.string().max(80),
        text: z.string().max(1000),
        beatIndex: z.number().int(),
      }),
    )
    .max(400),
  ended: z.boolean(),
}).refine(s => s.beatIndex < s.story.beats.length, { message: "Beat index is out of bounds", path: ["beatIndex"] });
