/**
 * Languages Deepgram supports end to end with full quality: Flux STT Multilingual understands them
 * and Flux TTS reads them with text normalization (numbers, dates). Early Access TTS languages are
 * left out on purpose.
 */
export const LANGUAGES = [
  { code: "en", name: "English", native: "English" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ru", name: "Russian", native: "Русский" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as [LanguageCode, ...LanguageCode[]];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function isLanguage(code: unknown): code is LanguageCode {
  return typeof code === "string" && (LANGUAGE_CODES as string[]).includes(code);
}

export function languageName(code: LanguageCode): string {
  return LANGUAGES.find((l) => l.code === code)!.name;
}

/** Stories saved before languages existed have no language and are English. */
export function storyLanguage(story: { language?: string }): LanguageCode {
  return isLanguage(story.language) ? story.language : DEFAULT_LANGUAGE;
}

/** The story guide's opening line on the create page, before the AI takes over. */
export const GREETINGS: Record<LanguageCode, string> = {
  en: "Let’s make a story that’s all yours. Who should our hero be?",
  es: "¡Vamos a crear un cuento que sea solo tuyo! ¿Quién será nuestro héroe?",
  fr: "Inventons une histoire rien qu’à toi ! Qui sera notre héros ?",
  de: "Lass uns eine Geschichte erfinden, die ganz dir gehört! Wer soll unser Held sein?",
  it: "Inventiamo una storia tutta tua! Chi sarà il nostro eroe?",
  pt: "Vamos criar uma história só sua! Quem vai ser o nosso herói?",
  nl: "Laten we een verhaal maken dat helemaal van jou is! Wie wordt onze held?",
  hi: "चलो, एक ऐसी कहानी बनाते हैं जो सिर्फ़ तुम्हारी हो! हमारा हीरो कौन होगा?",
  ja: "きみだけの おはなしを つくろう！ しゅじんこうは だれに する？",
  ru: "Давай придумаем сказку, которая будет только твоей! Кто будет нашим героем?",
};

/** Deepgram listen settings: English keeps the English-only model, everything else uses Flux Multilingual. */
export function listenParams(language: LanguageCode): URLSearchParams {
  // Children often pause mid-idea, so give Flux up to 3 s of silence before it must end the turn.
  const params = new URLSearchParams({
    model: language === "en" ? "flux-general-en" : "flux-general-multi",
    eot_threshold: "0.7",
    eot_timeout_ms: "3000",
  });
  // A hint biases recognition toward the story's language without blocking others.
  if (language !== "en") params.append("language_hint", language);
  return params;
}

const PREFERENCE_KEY = "onceupon.language";

export function savedLanguage(): LanguageCode {
  try {
    const value = localStorage.getItem(PREFERENCE_KEY);
    return isLanguage(value) ? value : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function saveLanguage(code: LanguageCode) {
  try { localStorage.setItem(PREFERENCE_KEY, code); } catch { /* storage disabled */ }
}
