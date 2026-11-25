import { tokenize } from "./words";

const CHARS_PER_SECOND = 14;
// Kana, kanji, hangul and Devanagari each take longer to say than one Latin letter.
const DENSE = /[ऀ-ॿ぀-ヿ㐀-鿿가-힯]/u;

/**
 * Estimates when each word is spoken. Deepgram's TTS returns audio without word timings, so words
 * are spread over the recording in proportion to their length, with extra time after punctuation
 * where a reader naturally pauses. Set `duration` once the recording's real length is known.
 */
export class WordClock {
  private ends: number[] = [];
  private total = 0;
  duration?: number;

  constructor(text: string) {
    let at = 0;
    for (const token of tokenize(text)) {
      const weight = [...token.text].reduce((sum, ch) => sum + (DENSE.test(ch) ? 2.5 : 1), 0);
      if (token.word >= 0) {
        at += Math.max(2, weight);
        this.ends.push(at);
      } else if (/…|\.\.\./u.test(token.text)) at += 12; // a held, suspenseful pause
      else if (/[.!?。！？]/u.test(token.text)) at += 6;
      else if (/[,;:、—–-]/u.test(token.text)) at += 3;
      else at += Math.min(weight, 1);
    }
    this.total = Math.max(at, 1);
  }

  get words() { return this.ends.length; }

  /** Index of the word being spoken at `seconds` into the recording. */
  wordAt(seconds: number): number {
    if (!this.ends.length) return -1;
    const length = this.duration ?? this.total / CHARS_PER_SECOND;
    const position = (seconds / length) * this.total;
    const index = this.ends.findIndex((end) => position < end);
    return index === -1 ? this.ends.length - 1 : index;
  }
}
