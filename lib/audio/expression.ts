/**
 * How a line should be performed. The story engine tags each segment with a mood, and the TTS
 * route turns it into a Flux TTS `expressivity` value (beta, -2 calm to 2 animated).
 */
export const MOODS = ["hushed", "gentle", "lively", "excited"] as const;
export type Mood = (typeof MOODS)[number];

/** Each mood shifts the story's baseline expressivity; the result is clamped to Deepgram's -2..2. */
const SHIFT: Record<Mood, number> = { hushed: -3, gentle: -1, lively: 0, excited: 1 };

export function expressivityFor(baseline: number, mood?: Mood): number {
  return Math.max(-2, Math.min(2, baseline + (mood ? SHIFT[mood] : 0)));
}

// Flux TTS allows at most 8 inline pauses per request, each with text on both sides.
const MAX_PAUSES = 8;
const PAUSE = "\\{pause:600ms\\}";

/**
 * Adds a short held pause after each mid-sentence ellipsis ("And then... a tiny knock!"), so
 * suspense lands. Inline pause control is batch-only and English-only on Flux TTS; other languages
 * reject it. Any control markup already in the text is removed so it can't be injected.
 */
export function withStoryPauses(text: string): string {
  let count = 0;
  return stripControls(text).replace(/(\.\.\.|…)(?=\s+\S)/g, (ellipsis) => (++count <= MAX_PAUSES ? `${ellipsis}${PAUSE}` : ellipsis));
}

export function stripControls(text: string): string {
  return text.replace(/\\\{[^}]*\}/g, "");
}
