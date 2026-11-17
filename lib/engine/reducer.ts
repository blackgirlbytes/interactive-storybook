import type { CharacterCard, LogEntry, Mode, SpokenSegment, StoryDef, StoryState } from "@/lib/types";
import type { Turn } from "@/lib/engine/schema";
import { normalizeVoice, pickUnusedVoice } from "@/lib/voices";

const MAX_NOTES = 30;
const MAX_OBJECTS = 20;
const MAX_CHARACTERS = 12;

export function initialState(story: StoryDef, mode: Mode): StoryState {
  return {
    story,
    mode,
    beatIndex: 0,
    turnsInBeat: 0,
    characters: story.characters.map((c) => ({ ...c })),
    objects: [],
    plotNotes: [],
    log: [],
    ended: false,
  };
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "friend"
  );
}

export function findCharacter(characters: CharacterCard[], speaker: string): CharacterCard | undefined {
  const s = speaker.trim().toLowerCase();
  if (!s || s === "narrator") return undefined;
  return (
    characters.find((c) => c.id === s) ??
    characters.find((c) => c.name.toLowerCase() === s) ??
    characters.find((c) => slugify(c.name) === slugify(s)) ??
    characters.find((c) => c.name.toLowerCase().includes(s) || s.includes(c.name.toLowerCase()))
  );
}

export function addChildUtterance(state: StoryState, text: string): StoryState {
  const entry: LogEntry = { kind: "child", speaker: "child", text, beatIndex: state.beatIndex };
  return { ...state, log: [...state.log, entry] };
}

function mergeCharacters(state: StoryState, turn: Turn): CharacterCard[] {
  const characters = [...state.characters];
  for (const add of turn.stateChanges.addCharacters ?? []) {
    if (characters.length >= MAX_CHARACTERS) break;
    if (findCharacter(characters, add.name)) continue;
    let id = slugify(add.name);
    while (characters.some((c) => c.id === id)) id += "-2";
    const used = [state.story.narratorVoice, ...characters.map((c) => c.voice)];
    const requested = normalizeVoice(add.voice);
    const voice = requested && !used.includes(requested) ? requested : pickUnusedVoice(used);
    characters.push({ id, name: add.name, personality: add.personality, look: add.look, voice, invented: true });
  }
  return characters;
}

function dedupe(list: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(-max);
}

export interface AppliedTurn {
  state: StoryState;
  spoken: SpokenSegment[];
}

export function applyTurn(state: StoryState, turn: Turn): AppliedTurn {
  const characters = mergeCharacters(state, turn);
  const lastBeat = state.story.beats.length - 1;

  const spoken: SpokenSegment[] = turn.segments.map((seg) => {
    const ch = findCharacter(characters, seg.speaker);
    return ch
      ? { speakerId: ch.id, speakerName: ch.name, voice: ch.voice, text: seg.text }
      : { speakerId: "narrator", speakerName: "Narrator", voice: state.story.narratorVoice, text: seg.text };
  });

  const newEntries: LogEntry[] = spoken.map((s) => ({
    kind: s.speakerId === "narrator" ? "narration" : "dialogue",
    speaker: s.speakerName,
    text: s.text,
    beatIndex: state.beatIndex,
  }));

  const ended = turn.isEnding && state.beatIndex >= lastBeat;
  const advance = turn.advanceBeat && state.beatIndex < lastBeat;

  return {
    spoken,
    state: {
      ...state,
      characters,
      objects: dedupe([...state.objects, ...(turn.stateChanges.addObjects ?? [])], MAX_OBJECTS),
      plotNotes: dedupe([...state.plotNotes, ...(turn.stateChanges.plotNotes ?? [])], MAX_NOTES),
      log: [...state.log, ...newEntries],
      beatIndex: advance ? state.beatIndex + 1 : state.beatIndex,
      turnsInBeat: advance ? 0 : state.turnsInBeat + 1,
      ended,
    },
  };
}
