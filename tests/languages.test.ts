import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLASSIC_STORIES } from "@/lib/stories";
import { LANGUAGES, listenParams, storyLanguage } from "@/lib/languages";
import { ALL_VOICES, isAllowedVoice, localizeStory, narratorFor, normalizeVoice, pickUnusedVoice, voiceInfo, voicesFor } from "@/lib/voices";
import { buildEngineUser, createSystem } from "@/lib/engine/prompts";
import { initialState, slugify } from "@/lib/engine/reducer";
import { isLikelyEcho } from "@/lib/engine/echo";
import { tokenize, wordList } from "@/lib/text/words";
import { WordClock } from "@/lib/text/wordClock";
import { POST as tts } from "@/app/api/tts/route";

const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal("fetch", fetchMock); vi.stubEnv("DEEPGRAM_API_KEY", "test-key"); fetchMock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("languages", () => {
  it("has Flux voices of both genders in every supported language", () => {
    for (const { code } of LANGUAGES) {
      const voices = voicesFor(code);
      expect(voices.some(v => v.gender === "female")).toBe(true);
      expect(voices.some(v => v.gender === "male")).toBe(true);
      expect(isAllowedVoice(narratorFor(code))).toBe(true);
    }
    expect(new Set(ALL_VOICES.map(v => `${v.name}-${v.language}`)).size).toBe(ALL_VOICES.length);
  });

  it("keeps English on the English model and hints other languages to Flux Multilingual", () => {
    expect(listenParams("en").toString()).toBe("model=flux-general-en&eot_threshold=0.7&eot_timeout_ms=3000");
    const es = listenParams("es");
    expect(es.get("model")).toBe("flux-general-multi");
    expect(es.getAll("language_hint")).toEqual(["es"]);
  });

  it("only accepts a language's own voices", () => {
    expect(normalizeVoice("valentina", "es")).toBe("flux-valentina-es");
    expect(normalizeVoice("flux-valentina-es", "es")).toBe("flux-valentina-es");
    expect(normalizeVoice("flux-hannah-en", "es")).toBeUndefined();
    expect(normalizeVoice("valentina")).toBeUndefined();
    expect(pickUnusedVoice(["flux-ayumi-ja"], "ja", "female")).toBe("flux-nozomi-ja");
  });

  it("recasts classic stories with same-gender voices in the chosen language", () => {
    for (const story of CLASSIC_STORIES) {
      for (const { code } of LANGUAGES) {
        const localized = localizeStory(story, code);
        expect(storyLanguage(localized)).toBe(code);
        const roles = [localized.narratorVoice, ...localized.characters.map(c => c.voice)];
        expect(roles.every(v => voiceInfo(v)?.language === code)).toBe(true);
        // Japanese has four voices, so only languages with enough voices must keep every role distinct.
        if (voicesFor(code).length > roles.length) expect(new Set(roles).size).toBe(roles.length);
      }
    }
    const pigs = localizeStory(CLASSIC_STORIES[1], "es");
    expect(voiceInfo(pigs.characters.find(c => c.id === "wolf")!.voice)!.gender).toBe("male");
    expect(voiceInfo(pigs.characters.find(c => c.id === "penny")!.voice)!.gender).toBe("female");
    expect(localizeStory(CLASSIC_STORIES[0], "en")).toBe(CLASSIC_STORIES[0]);
  });

  it("tells the story engine and the guide which language to speak", () => {
    const state = initialState(localizeStory(CLASSIC_STORIES[2], "fr"), "listen");
    expect(buildEngineUser(state)).toContain("STORY LANGUAGE: French");
    expect(buildEngineUser(initialState(CLASSIC_STORIES[2], "listen"))).toContain("STORY LANGUAGE: English");
    const guide = createSystem("ja");
    expect(guide).toContain("Speak only in Japanese");
    expect(guide).toContain("- hayato: man, Japanese speaker");
    expect(guide).not.toContain("hannah");
  });

  it("recognises echoes and makes ids in every script", () => {
    expect(isLikelyEcho("うさぎは ねむりました", "うさぎは ねむりました。")).toBe(true);
    expect(isLikelyEcho("Маша пошла в лес", "Заяц уснул под дубом.")).toBe(false);
    expect(isLikelyEcho("el niño corre", "El niño corre muy rápido.")).toBe(true);
    expect(slugify("Маша")).toBe("маша");
    expect(slugify("ゆき")).not.toBe(slugify("はな"));
    expect(slugify("Ellie the Elephant")).toBe("ellie-the-elephant");
  });
});

describe("read-along words", () => {
  it("splits words in spaced and unspaced scripts", () => {
    expect(wordList("Hello, little fox!")).toEqual(["Hello", "little", "fox"]);
    expect(tokenize("Hi, fox.").map(t => t.text).join("")).toBe("Hi, fox.");
    expect(wordList("うさぎがはしった").length).toBeGreaterThan(1);
  });

  it("moves through the words over the length of the recording", () => {
    const clock = new WordClock("Once upon a time, there was a fox.");
    clock.duration = 3;
    expect(clock.words).toBe(8);
    expect(clock.wordAt(0)).toBe(0);
    expect(clock.wordAt(1.5)).toBeGreaterThan(2);
    expect(clock.wordAt(3)).toBe(7);
    const seen = [0, 0.5, 1, 1.5, 2, 2.5, 2.9].map(t => clock.wordAt(t));
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });
});

describe("TTS voices and expressivity", () => {
  it("speaks other languages' voices with story expressivity, and phonics plainly", async () => {
    fetchMock.mockResolvedValue(new Response("audio"));
    const res = await tts(new Request("http://localhost/api/tts", { method: "POST", body: JSON.stringify({ text: "Hola.", voice: "flux-valentina-es" }) }));
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.deepgram.com/v2/speak?model=flux-valentina-es&encoding=mp3&expressivity=1");
    await tts(new Request("http://localhost/api/tts", { method: "POST", body: JSON.stringify({ text: "kuh", voice: "flux-hannah-en", style: "clear" }) }));
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.deepgram.com/v2/speak?model=flux-hannah-en&encoding=mp3");
  });

  it("turns expressivity off when configured", async () => {
    vi.stubEnv("DEEPGRAM_TTS_EXPRESSIVITY", "0");
    fetchMock.mockResolvedValue(new Response("audio"));
    await tts(new Request("http://localhost/api/tts", { method: "POST", body: JSON.stringify({ text: "Hi.", voice: "flux-hannah-en" }) }));
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.deepgram.com/v2/speak?model=flux-hannah-en&encoding=mp3");
  });
});
