"use client";
import { Fragment } from "react";
import type { SpokenSegment } from "@/lib/types";
import { tokenize } from "@/lib/text/words";

interface Props {
  segments: SpokenSegment[];
  /** The segment and word being read aloud now. */
  reading?: { segment: number; word: number };
  /** When set, every word is a button that asks for that word to be sounded out. */
  onWord?: (word: string) => void;
}

/** Story text that lights up word by word as it is read, and lets children tap words in phonics mode. */
export default function ReadAlong({ segments, reading, onWord }: Props) {
  return <>{segments.map((s, i) => <div key={i} className={reading?.segment === i ? "reading-segment" : undefined}>
    <span className="speaker">{s.speakerName}</span>
    <p>{tokenize(s.text).map((t, j) => {
      if (t.word < 0) return <Fragment key={j}>{t.text}</Fragment>;
      const current = reading?.segment === i && reading.word === t.word;
      const className = `word${current ? " reading-word" : ""}`;
      return onWord
        ? <button type="button" key={j} className={`${className} tappable`} onClick={() => onWord(t.text)} aria-label={`Sound out ${t.text}`}>{t.text}</button>
        : <span key={j} className={className} aria-current={current || undefined}>{t.text}</span>;
    })}</p>
  </div>)}</>;
}
