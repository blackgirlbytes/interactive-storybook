import { DEFAULT_LANGUAGE, LANGUAGES, languageName, type LanguageCode } from "@/lib/languages";

export type Gender = "female" | "male";

export interface Voice {
  name: string;
  language: LanguageCode;
  gender: Gender;
  desc: string;
}

/** Deepgram Flux TTS English voices, with a short description the story creator can match to characters. */
export const FLUX_VOICES = [
  { name: "hannah", gender: "female", desc: "young American woman, clear and pleasant, storyteller" },
  { name: "kit", gender: "male", desc: "young British man, friendly and energetic" },
  { name: "alexis", gender: "female", desc: "American woman, calm and caring" },
  { name: "cliff", gender: "male", desc: "older American man, deep and raspy" },
  { name: "sienna", gender: "female", desc: "young American woman, warm and calm" },
  { name: "cole", gender: "male", desc: "young American man, energetic and engaging" },
  { name: "brooke", gender: "female", desc: "young American woman, fast and energetic" },
  { name: "colin", gender: "male", desc: "British man, warm and authoritative" },
  { name: "gemma", gender: "female", desc: "young British woman, kind and happy" },
  { name: "haley", gender: "female", desc: "young American woman, caring and calm" },
  { name: "heather", gender: "female", desc: "young American woman, bright and friendly" },
  { name: "miles", gender: "male", desc: "American man, calm and sincere" },
  { name: "sean", gender: "male", desc: "older British man, kind and calming" },
  { name: "bree", gender: "female", desc: "older American woman, sweet and kind" },
  { name: "brittany", gender: "female", desc: "older American woman, soft and kind" },
  { name: "bruce", gender: "male", desc: "American man, friendly and natural" },
  { name: "conor", gender: "male", desc: "older British man, deep and relaxed" },
  { name: "donovan", gender: "male", desc: "American man, calm and thoughtful" },
  { name: "drew", gender: "male", desc: "American man, soft and relaxed" },
  { name: "elise", gender: "female", desc: "American woman, calm and caring" },
  { name: "jack", gender: "male", desc: "British man, thoughtful storyteller" },
  { name: "kai", gender: "male", desc: "young Singaporean man, calm and caring" },
  { name: "kelsey", gender: "female", desc: "young American woman, caring and calm" },
  { name: "maeve", gender: "female", desc: "Irish woman, gentle and energetic" },
  { name: "marcelo", gender: "male", desc: "young Filipino man, calm and caring" },
  { name: "marcus", gender: "male", desc: "American man, smooth and friendly" },
  { name: "meena", gender: "female", desc: "Indian woman, calm and reassuring" },
  { name: "meghan", gender: "female", desc: "American woman, friendly and energetic" },
  { name: "naveen", gender: "male", desc: "Indian man, clear and caring" },
  { name: "paige", gender: "female", desc: "young American woman, calm and comfortable" },
  { name: "priya", gender: "female", desc: "Indian woman, confident and reassuring" },
  { name: "rufus", gender: "male", desc: "British man, gentle and enthusiastic storyteller" },
  { name: "sharon", gender: "female", desc: "young Australian woman, calm and relaxed" },
  { name: "tanner", gender: "male", desc: "British man, calm and confident" },
  { name: "wade", gender: "male", desc: "American man, warm and enthusiastic" },
  { name: "wes", gender: "male", desc: "American man, thoughtful and warm" },
] as const satisfies readonly { name: string; gender: Gender; desc: string }[];

/**
 * Flux TTS voices for the other fully supported languages (normalization on), from
 * https://developers.deepgram.com/docs/flux-tts/voices. Deepgram lists only gender for these,
 * so descriptions note the regional accent where the catalog groups one.
 */
const OTHER_VOICES: Record<Exclude<LanguageCode, "en">, { female: string[]; male: string[]; regions?: Record<string, string> }> = {
  es: {
    female: ["valentina", "carmen", "cecilia", "fernanda", "fiorella", "patricia", "pilar", "aina", "ysabel"],
    male: ["tomas", "alfredo", "duvan", "eduardo", "ernesto", "gustavo", "jaime", "martin", "mauricio", "rafael"],
  },
  fr: {
    female: ["camille", "chloe", "brigitte", "veronique", "yasmine"],
    male: ["julien", "arnaud", "benoit", "florian", "mathieu", "pierre", "thierry"],
  },
  de: {
    female: ["janine", "magdalena", "nadine", "sonja", "verena", "leonie"],
    male: ["tobias", "benjamin", "christian", "moritz", "rolf", "sven", "yannick"],
    regions: { leonie: "Swiss", yannick: "Swiss" },
  },
  it: {
    female: ["sofia", "angela", "chiara", "paola"],
    male: ["matteo", "federico", "giorgio", "rocco", "stefano", "vincenzo", "vito"],
  },
  pt: {
    female: ["mariana", "bianca", "claudia", "marcia", "marta", "benedita", "catarina"],
    male: ["bruno", "leandro", "mateus", "miguel", "renato", "roberto", "rodrigo", "artur", "hugo", "pedro", "ricardo"],
    regions: { artur: "Portugal", benedita: "Portugal", catarina: "Portugal", hugo: "Portugal", pedro: "Portugal", ricardo: "Portugal" },
  },
  nl: {
    female: ["fleur", "anouk", "irene", "monique", "sanne", "yvonne", "lotte", "veerle"],
    male: ["bram", "luuk", "ruben", "dirk", "niels"],
    regions: { dirk: "Flemish", lotte: "Flemish", niels: "Flemish", veerle: "Flemish" },
  },
  hi: {
    female: ["anjali", "divya", "jyoti", "pallavi", "prachi", "ritu", "shreya", "sunita"],
    male: ["arjun", "ajay", "nikhil", "rahul", "rajesh", "vikram"],
  },
  ja: { female: ["ayumi", "nozomi", "sayaka"], male: ["hayato"] },
  ru: {
    female: ["natalia", "olga", "polina"],
    male: ["andrei", "kirill", "maxim", "mikhail", "nikolai", "vladimir"],
  },
};

function otherVoices(language: Exclude<LanguageCode, "en">): Voice[] {
  const { female, male, regions = {} } = OTHER_VOICES[language];
  const describe = (name: string, gender: Gender) =>
    `${gender === "female" ? "woman" : "man"}, ${regions[name] ? `${regions[name]} ` : ""}${languageName(language)} speaker`;
  return [
    ...female.map((name) => ({ name, language, gender: "female" as const, desc: describe(name, "female") })),
    ...male.map((name) => ({ name, language, gender: "male" as const, desc: describe(name, "male") })),
  ];
}

export const ALL_VOICES: readonly Voice[] = LANGUAGES.flatMap(({ code }) =>
  code === "en" ? FLUX_VOICES.map((v) => ({ ...v, language: "en" as const })) : otherVoices(code),
);

export function voicesFor(language: LanguageCode): Voice[] {
  return ALL_VOICES.filter((v) => v.language === language);
}

export const voiceModel = (name: string, language: LanguageCode = DEFAULT_LANGUAGE) => `flux-${name}-${language}`;

const BY_MODEL = new Map(ALL_VOICES.map((v) => [voiceModel(v.name, v.language), v]));

export const ALLOWED_VOICE_MODELS: ReadonlySet<string> = new Set(BY_MODEL.keys());

export const DEFAULT_NARRATOR = voiceModel("hannah");

/** A warm default storyteller for each language. */
export function narratorFor(language: LanguageCode): string {
  return voiceModel(voicesFor(language)[0].name, language);
}

export function voiceInfo(model: string | undefined): Voice | undefined {
  return model ? BY_MODEL.get(model) : undefined;
}

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

/**
 * Accepts a Flux model, a bare voice name, or (for English) a legacy Aura-2 voice, and returns a
 * Flux model in the given language, or undefined if it isn't one of that language's voices.
 */
export function normalizeVoice(v: string | undefined, language: LanguageCode = DEFAULT_LANGUAGE): string | undefined {
  if (!v) return undefined;
  const lower = v.trim().toLowerCase();
  if (isAllowedVoice(lower)) return voiceInfo(lower)!.language === language ? lower : undefined;
  const name = language === "en" ? (lower.match(/^aura-2-([a-z]+)-en$/)?.[1] ?? lower) : lower;
  const model = voiceModel(language === "en" ? (LEGACY_AURA[name] ?? name) : name, language);
  return isAllowedVoice(model) ? model : undefined;
}

/**
 * The first voice in the language nobody in the story uses yet, preferring the given gender.
 * Languages with few voices (Japanese has four) share voices once every one is taken.
 */
export function pickUnusedVoice(used: Iterable<string>, language: LanguageCode = DEFAULT_LANGUAGE, gender?: Gender): string {
  const taken = new Set([...used].map((v) => normalizeVoice(v, language) ?? v));
  const models = voicesFor(language)
    .filter((v) => !gender || v.gender === gender)
    .map((v) => voiceModel(v.name, language));
  const fallback = language === "en" ? voiceModel("kit") : models[0] ?? narratorFor(language);
  return models.find((v) => !taken.has(v)) ?? (gender ? pickUnusedVoice(used, language) : fallback);
}

/** Recasts a story's voices into another language, keeping each role's gender and keeping roles distinct. */
export function localizeStory<T extends { language?: LanguageCode; narratorVoice: string; characters: { voice: string }[] }>(
  story: T,
  language: LanguageCode,
): T {
  if ((story.language ?? DEFAULT_LANGUAGE) === language) return story;
  const used: string[] = [];
  const recast = (voice: string) => {
    const model = pickUnusedVoice(used, language, voiceInfo(normalizeVoice(voice) ?? voice)?.gender);
    used.push(model);
    return model;
  };
  const narratorVoice = recast(story.narratorVoice);
  return {
    ...story,
    language,
    narratorVoice,
    characters: story.characters.map((c) => ({ ...c, voice: recast(c.voice) })),
  };
}
