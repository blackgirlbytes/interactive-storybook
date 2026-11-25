import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expressivityFor, withStoryPauses } from "@/lib/audio/expression";
import { TurnSchema } from "@/lib/engine/schema";
import { completedSegments } from "@/lib/engine/streamSegments";
import { POST as tts } from "@/app/api/tts/route";

const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal("fetch", fetchMock); vi.stubEnv("DEEPGRAM_API_KEY", "test-key"); fetchMock.mockReset(); fetchMock.mockResolvedValue(new Response("audio")); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const speak = (body: object) => tts(new Request("http://localhost/api/tts", { method: "POST", body: JSON.stringify(body) }));
const sent = (call = 0) => ({ url: fetchMock.mock.calls[call][0] as string, text: JSON.parse(fetchMock.mock.calls[call][1].body).text as string });

describe("expressive reading", () => {
  it("maps moods onto the story baseline, clamped to Deepgram's range", () => {
    expect([undefined, "hushed", "gentle", "lively", "excited"].map(m => expressivityFor(1, m as never))).toEqual([1, -2, 0, 1, 2]);
    expect(expressivityFor(0, "excited")).toBe(1);
    expect(expressivityFor(2, "excited")).toBe(2);
  });

  it("holds a pause after mid-sentence ellipses, at most eight, and strips injected controls", () => {
    expect(withStoryPauses("And then... a tiny knock! Who is it…")).toBe("And then...\\{pause:600ms\\} a tiny knock! Who is it…");
    expect(withStoryPauses("Hi \\{pause:3000ms\\}there")).toBe("Hi there");
    expect(withStoryPauses(Array(10).fill("Oh... no").join(" ")).match(/pause/g)).toHaveLength(8);
  });

  it("sends each line's mood as expressivity and adds pauses for English only", async () => {
    await speak({ text: "Shh... listen.", voice: "flux-hannah-en", mood: "hushed" });
    expect(sent().url).toBe("https://api.deepgram.com/v2/speak?model=flux-hannah-en&encoding=mp3&expressivity=-2");
    expect(sent().text).toBe("Shh...\\{pause:600ms\\} listen.");
    await speak({ text: "Hooray!", voice: "flux-kit-en", mood: "excited" });
    expect(sent(1).url).toContain("expressivity=2");
    await speak({ text: "Y entonces... un golpe.", voice: "flux-valentina-es", mood: "gentle" });
    expect(sent(2).url).toBe("https://api.deepgram.com/v2/speak?model=flux-valentina-es&encoding=mp3");
    expect(sent(2).text).toBe("Y entonces... un golpe.");
    await speak({ text: "kuh...  ah", voice: "flux-hannah-en", style: "clear", mood: "excited" });
    expect(sent(3).url).toBe("https://api.deepgram.com/v2/speak?model=flux-hannah-en&encoding=mp3");
    expect(sent(3).text).toBe("kuh...  ah");
  });

  it("ignores an unknown mood instead of failing the line or the page", async () => {
    expect((await speak({ text: "Hi.", voice: "flux-hannah-en", mood: "furious" })).status).toBe(200);
    expect(sent().url).toContain("expressivity=1");
    const turn = TurnSchema.parse({ segments: [{ speaker: "narrator", text: "Hi.", mood: "furious" }, { speaker: "narrator", text: "Psst.", mood: "hushed" }] });
    expect(turn.segments.map(s => s.mood)).toEqual([undefined, "hushed"]);
    expect(completedSegments('{"segments":[{"speaker":"fox","text":"Wow!","mood":"excited"},').at(0)?.mood).toBe("excited");
  });
});
