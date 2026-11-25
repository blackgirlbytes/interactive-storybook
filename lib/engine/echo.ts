import { wordList } from "@/lib/text/words";

const words = (s: string) => wordList(s.toLowerCase());

/**
 * Speakers can leak narration back into the microphone even with echo
 * cancellation on, so a transcript made mostly of words the app just spoke is
 * treated as echo rather than the child talking.
 */
export function isLikelyEcho(transcript: string, recentlySpoken: string): boolean {
  const heard = words(transcript);
  if (heard.length === 0) return true;
  const spoken = new Set(words(recentlySpoken));
  if (spoken.size === 0) return false;
  const overlap = heard.filter((w) => spoken.has(w)).length / heard.length;
  return heard.length >= 2 ? overlap >= 0.75 : overlap === 1;
}
