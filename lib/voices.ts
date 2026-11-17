/** Deepgram Flux TTS English voices, with a short description the story creator can match to characters. */
export const FLUX_VOICES = [
  { name: "hannah", desc: "young American woman, clear and pleasant, storyteller" },
  { name: "kit", desc: "young British man, friendly and energetic" },
  { name: "alexis", desc: "American woman, calm and caring" },
  { name: "cliff", desc: "older American man, deep and raspy" },
  { name: "sienna", desc: "young American woman, warm and calm" },
  { name: "cole", desc: "young American man, energetic and engaging" },
  { name: "brooke", desc: "young American woman, fast and energetic" },
  { name: "colin", desc: "British man, warm and authoritative" },
  { name: "gemma", desc: "young British woman, kind and happy" },
  { name: "haley", desc: "young American woman, caring and calm" },
  { name: "heather", desc: "young American woman, bright and friendly" },
  { name: "miles", desc: "American man, calm and sincere" },
  { name: "sean", desc: "older British man, kind and calming" },
  { name: "bree", desc: "older American woman, sweet and kind" },
  { name: "brittany", desc: "older American woman, soft and kind" },
  { name: "bruce", desc: "American man, friendly and natural" },
  { name: "conor", desc: "older British man, deep and relaxed" },
  { name: "donovan", desc: "American man, calm and thoughtful" },
  { name: "drew", desc: "American man, soft and relaxed" },
  { name: "elise", desc: "American woman, calm and caring" },
  { name: "jack", desc: "British man, thoughtful storyteller" },
  { name: "kai", desc: "young Singaporean man, calm and caring" },
  { name: "kelsey", desc: "young American woman, caring and calm" },
  { name: "maeve", desc: "Irish woman, gentle and energetic" },
  { name: "marcelo", desc: "young Filipino man, calm and caring" },
  { name: "marcus", desc: "American man, smooth and friendly" },
  { name: "meena", desc: "Indian woman, calm and reassuring" },
  { name: "meghan", desc: "American woman, friendly and energetic" },
  { name: "naveen", desc: "Indian man, clear and caring" },
  { name: "paige", desc: "young American woman, calm and comfortable" },
  { name: "priya", desc: "Indian woman, confident and reassuring" },
  { name: "rufus", desc: "British man, gentle and enthusiastic storyteller" },
  { name: "sharon", desc: "young Australian woman, calm and relaxed" },
  { name: "tanner", desc: "British man, calm and confident" },
  { name: "wade", desc: "American man, warm and enthusiastic" },
  { name: "wes", desc: "American man, thoughtful and warm" },
] as const;

export const VOICE_NAMES = FLUX_VOICES.map((v) => v.name);

export const voiceModel = (name: string) => `flux-${name}-en`;

export const ALLOWED_VOICE_MODELS: ReadonlySet<string> = new Set(VOICE_NAMES.map(voiceModel));

export const DEFAULT_NARRATOR = voiceModel("hannah");

// Stories saved or created before the Flux switch store Aura-2 voices. Each maps to a different
// Flux voice so characters that sounded different still do.
const LEGACY_AURA: Record<string, string> = {
  amalthea: "alexis", andromeda: "sienna", apollo: "wes", arcas: "miles", aries: "cole", asteria: "haley",
  athena: "hannah", atlas: "sean", aurora: "heather", callista: "kelsey", cora: "maeve", cordelia: "gemma",
  delia: "brooke", draco: "cliff", electra: "meghan", harmonia: "paige", helena: "bree", hera: "brittany",
  hermes: "marcus", hyperion: "jack", iris: "elise", janus: "sharon", juno: "meena", jupiter: "conor",
  luna: "priya", mars: "bruce", minerva: "kit", neptune: "wade",
};

export function isAllowedVoice(model: string | undefined): boolean {
  return !!model && ALLOWED_VOICE_MODELS.has(model);
}

/** Accepts a Flux model, a bare voice name, or a legacy Aura-2 voice, and returns a Flux model. */
export function normalizeVoice(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const lower = v.trim().toLowerCase();
  if (isAllowedVoice(lower)) return lower;
  const name = lower.match(/^aura-2-([a-z]+)-en$/)?.[1] ?? lower;
  const model = voiceModel(LEGACY_AURA[name] ?? name);
  return isAllowedVoice(model) ? model : undefined;
}

export function pickUnusedVoice(used: Iterable<string>): string {
  const taken = new Set([...used].map((v) => normalizeVoice(v) ?? v));
  const free = VOICE_NAMES.map(voiceModel).find((v) => !taken.has(v));
  return free ?? voiceModel("kit");
}
