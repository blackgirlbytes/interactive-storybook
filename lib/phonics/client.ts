import { playBlob, post, speech } from "@/lib/audio/client";
import type { LanguageCode } from "@/lib/languages";
import type { Phonics } from "./schema";

/** Which part of the word is being said: the whole word, one part, or every part blended. */
export type PhonicsStep = { kind: "word" } | { kind: "part"; index: number } | { kind: "blend" } | { kind: "done" };

const splits = new Map<string, Promise<Phonics>>();
const recordings = new Map<string, Promise<Blob>>();

export function splitWord(word: string, language: LanguageCode): Promise<Phonics> {
  const key = `${language}:${word.toLowerCase()}`;
  let split = splits.get(key);
  if (!split) {
    split = post<Phonics>("/api/phonics", { word, language }).catch(() => {
      splits.delete(key);
      // Without a split the child still hears the word, slowly and on its own.
      return { parts: [{ letters: word, say: word }] };
    });
    splits.set(key, split);
  }
  return split;
}

function say(text: string, voice: string): Promise<Blob> {
  const key = `${voice}:${text}`;
  let recording = recordings.get(key);
  if (!recording) {
    // Phonics uses the voice's neutral delivery: clarity matters more than drama here.
    recording = speech(text, voice, new AbortController().signal, "clear");
    recording.catch(() => recordings.delete(key));
    recordings.set(key, recording);
  }
  return recording;
}

const gap = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Stopped", "AbortError")); }, { once: true });
  });

/** Says the word, then each part with a short pause, then blends the word again. */
export async function soundOut(word: string, phonics: Phonics, voice: string, signal: AbortSignal, onStep: (step: PhonicsStep) => void) {
  const whole = say(word, voice);
  const parts = phonics.parts.map((p) => say(p.say, voice));
  [whole, ...parts].forEach((r) => { void r.catch(() => {}); });
  onStep({ kind: "word" });
  await playBlob(await whole, signal);
  if (phonics.parts.length > 1) {
    for (let i = 0; i < parts.length; i++) {
      await gap(350, signal);
      onStep({ kind: "part", index: i });
      await playBlob(await parts[i], signal);
    }
    await gap(500, signal);
    onStep({ kind: "blend" });
    await playBlob(await whole, signal);
  }
  onStep({ kind: "done" });
}
