import { TurnSchema, type Turn } from "@/lib/engine/schema";

export interface StreamedSegment {
  speaker: string;
  text: string;
}

export type TurnEvent =
  | ({ type: "segment" } & StreamedSegment)
  | { type: "turn"; turn: Turn }
  | { type: "error"; error: string };

const SEGMENT = /\{(?:[^{}"]|"(?:[^"\\]|\\.)*")*\}/g;

/** Segments whose JSON objects are fully written in a partial model reply. */
export function completedSegments(partial: string): StreamedSegment[] {
  const start = /"segments"\s*:\s*\[/.exec(partial);
  if (!start) return [];
  let region = partial.slice(start.index + start[0].length);
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < region.length; i++) {
    const char = region[i];
    if (escaped) { escaped = false; continue; }
    if (quoted && char === "\\") { escaped = true; continue; }
    if (char === '"') quoted = !quoted;
    if (!quoted && char === "]") { region = region.slice(0, i); break; }
  }
  const out: StreamedSegment[] = [];
  for (const m of region.matchAll(SEGMENT)) {
    try {
      const segment = TurnSchema.shape.segments.element.safeParse(JSON.parse(m[0]));
      if (segment.success) out.push(segment.data);
    } catch {
      // A malformed escape sequence; the final validated turn still covers it.
    }
    if (out.length === 6) break;
  }
  return out;
}
