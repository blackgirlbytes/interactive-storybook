export interface Token {
  text: string;
  /** Index among the word tokens, or -1 for spaces and punctuation. */
  word: number;
}

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "word" }) : undefined;

/**
 * Splits text into words and the spaces/punctuation between them, in every script. Intl.Segmenter
 * finds word boundaries in languages written without spaces, such as Japanese.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let word = 0;
  if (segmenter) {
    for (const s of segmenter.segment(text)) tokens.push({ text: s.segment, word: s.isWordLike ? word++ : -1 });
    return tokens;
  }
  for (const part of text.split(/([\p{L}\p{M}\p{N}'’]+)/u)) {
    if (part) tokens.push({ text: part, word: /[\p{L}\p{N}]/u.test(part) ? word++ : -1 });
  }
  return tokens;
}

export function wordList(text: string): string[] {
  return tokenize(text).filter((t) => t.word >= 0).map((t) => t.text);
}
