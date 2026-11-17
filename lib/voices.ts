export const AURA_VOICES = [
  "amalthea", "andromeda", "apollo", "arcas", "aries", "asteria", "athena",
  "atlas", "aurora", "callista", "cora", "cordelia", "delia", "draco",
  "electra", "harmonia", "helena", "hera", "hermes", "hyperion", "iris",
  "janus", "juno", "jupiter", "luna", "mars", "minerva", "neptune",
] as const;

export const voiceModel = (name: string) => `aura-2-${name}-en`;

export const ALLOWED_VOICE_MODELS: ReadonlySet<string> = new Set(AURA_VOICES.map(voiceModel));

export const DEFAULT_NARRATOR = voiceModel("athena");

export function isAllowedVoice(model: string | undefined): model is string {
  return !!model && ALLOWED_VOICE_MODELS.has(model);
}

export function normalizeVoice(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const lower = v.trim().toLowerCase();
  if (isAllowedVoice(lower)) return lower;
  const asModel = voiceModel(lower);
  return isAllowedVoice(asModel) ? asModel : undefined;
}

export function pickUnusedVoice(used: Iterable<string>): string {
  const taken = new Set(used);
  const free = AURA_VOICES.map(voiceModel).find((v) => !taken.has(v));
  return free ?? voiceModel("iris");
}
