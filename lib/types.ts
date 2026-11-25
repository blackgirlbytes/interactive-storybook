import type { LanguageCode } from "@/lib/languages";
import type { Mood } from "@/lib/audio/expression";

export type Category = "fairy-tale" | "bible" | "fable" | "custom";

export interface CharacterCard {
  id: string;
  name: string;
  personality: string;
  look: string;
  voice: string;
  invented?: boolean;
}

export interface Beat {
  title: string;
  goal: string;
}

export interface StoryDef {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
  category: Category;
  setting: string;
  artStyle: string;
  narratorVoice: string;
  characters: CharacterCard[];
  beats: Beat[];
  /** Spoken language of the story. Missing means English (stories saved before languages existed). */
  language?: LanguageCode;
}

export type LogKind = "narration" | "dialogue" | "child";

export interface LogEntry {
  kind: LogKind;
  speaker: string;
  text: string;
  beatIndex: number;
}

export type Mode = "listen" | "play";

export interface StoryState {
  story: StoryDef;
  mode: Mode;
  beatIndex: number;
  turnsInBeat: number;
  characters: CharacterCard[];
  objects: string[];
  plotNotes: string[];
  log: LogEntry[];
  ended: boolean;
}

export interface SpokenSegment {
  speakerId: string;
  speakerName: string;
  voice: string;
  text: string;
  /** How the line was performed; missing on pages saved before moods existed. */
  mood?: Mood;
}
