import { z } from "zod";
import { DEFAULT_LANGUAGE, LANGUAGE_CODES, languageName, type LanguageCode } from "@/lib/languages";
import { PhonicsSchema, PhonicsWord, spelling, type Phonics } from "@/lib/phonics/schema";
import { errorResponse } from "@/lib/server/errors";
import { generateValid } from "@/lib/server/generate";

const Body = z.object({ word: PhonicsWord, language: z.enum(LANGUAGE_CODES).default(DEFAULT_LANGUAGE) });

const HOW: Record<LanguageCode, string> = {
  en: `Split into phonemes, one sound per part, keeping letter teams together (sh, ch, th, ck, ng, ee, ai, oa, igh, ar, er...). A silent e joins the part before it ("c", "a", "ke"). For words of three or more syllables, split into syllables instead. "say" spells the sound so a speech voice says the sound, not the letter name: "kuh", "ah", "tuh", "sss", "mmm", "shh", "ee". Never use letter names like "see" for c.`,
  es: "Split into syllables (ma-ri-po-sa). \"say\" is the syllable itself.",
  fr: "Split into spoken syllables, keeping sound spellings together (ou, eau, on, ch). Silent final letters join the last part. \"say\" spells the syllable so it is pronounced correctly on its own.",
  de: "Split into syllables, keeping sch, ch, ei, ie, au together. \"say\" is the syllable itself.",
  it: "Split into syllables (far-fal-la). \"say\" is the syllable itself.",
  pt: "Split into syllables (bor-bo-le-ta). \"say\" is the syllable itself.",
  nl: "Split into syllables, keeping ij, ui, oe, eu, sch together. \"say\" is the syllable itself.",
  hi: "Split into aksharas (each consonant with its vowel sign, e.g. क-म-ल). \"say\" is the akshara itself.",
  ja: "Split into morae, one kana per part (small ゃゅょっ join the kana before them). If the word has kanji, \"letters\" stays as written but \"say\" gives the kana reading of each part.",
  ru: "Split into syllables (ма-ши-на). \"say\" is the syllable itself.",
};

const system = (language: LanguageCode) => `You are a gentle phonics teacher for children aged 4 to 9. Break one ${languageName(language)} word into the parts a child sounds out before blending them.
${HOW[language]}
Rules: "letters" are consecutive pieces of the word exactly as written; joined together they must spell the whole word. Use at most 8 parts. If the word is not a real word, still split it as best you can.
Respond with ONLY JSON: {"parts": [{"letters": "...", "say": "..."}]}`;

// Sound-outs never change, so remember recent ones instead of asking the model again.
const cache = new Map<string, Phonics>();

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid word" }, { status: 400 });
    const { word, language } = parsed.data;
    const key = `${language}:${spelling(word)}`;
    const hit = cache.get(key);
    if (hit) return Response.json(hit);
    const schema = PhonicsSchema.refine((r) => spelling(r.parts.map((p) => p.letters).join("")) === spelling(word), {
      message: `the letters must join to spell "${word}" exactly`,
    });
    const phonics = await generateValid(schema, system(language), `Word: ${word}`, req.signal);
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    cache.set(key, phonics);
    return Response.json(phonics);
  } catch (err) {
    return errorResponse(err);
  }
}
