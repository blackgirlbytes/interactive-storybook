import { afterEach, describe, expect, it, vi } from "vitest";
import { completedSegments } from "@/lib/engine/streamSegments";
import { streamTurn, speechAudio } from "@/lib/audio/client";

afterEach(() => vi.unstubAllGlobals());

describe("incremental story segments", () => {
  it("extracts only completed objects, including fenced JSON and escaped text", () => {
    const segment = { speaker: "narrator", text: 'A "magic" ] { sign says stateChanges.\nHello!' };
    const json = '```json\n{"segments":[' + JSON.stringify(segment);
    expect(completedSegments(json.slice(0, -1))).toEqual([]);
    expect(completedSegments(json + ',{"speaker":"hare","text":"Half')).toEqual([segment]);
  });
  it("accepts either field order and ignores objects after the segments array", () => {
    expect(completedSegments('{"segments":[{"text":"Hello","speaker":"hare"}],"stateChanges":{"speaker":"bad","text":"not spoken"}}'))
      .toEqual([{ speaker: "hare", text: "Hello" }]);
  });
  it("rejects oversized and empty segments rather than voicing unvalidated text", () => {
    expect(completedSegments(JSON.stringify({ segments: [{speaker:"narrator",text:"x".repeat(601)}, {speaker:"",text:"hi"}] }))).toEqual([]);
  });
});

describe("turn transport", () => {
  it("decodes split UTF-8 chunks and a final event without a newline", async () => {
    const segment = { speaker: "narrator", text: "A café!" };
    const bytes = new TextEncoder().encode(JSON.stringify({type:"segment",...segment}) + "\n" + JSON.stringify({type:"turn",turn:{segments:[segment]}}));
    const stream = new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(new Uint8Array([byte])); c.close(); } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));
    const onSegment = vi.fn();
    const turn = await streamTurn({}, new AbortController().signal, onSegment);
    expect(onSegment).toHaveBeenCalledExactlyOnceWith(segment);
    expect(turn.segments).toEqual([segment]);
  });
  it("reports truncated streams and explicit provider failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response('{"type":"error","error":"Try again"}\n')).mockResolvedValueOnce(new Response("")));
    await expect(streamTurn({}, new AbortController().signal, () => {})).rejects.toThrow("Try again");
    await expect(streamTurn({}, new AbortController().signal, () => {})).rejects.toThrow("before the page was complete");
  });
  it("downloads a single audio response and retains its blob", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("mp3", {headers:{"Content-Type":"audio/mpeg"}}));
    vi.stubGlobal("fetch", fetch);
    const resource = speechAudio("Hello", "voice", new AbortController().signal);
    expect(await (await resource.blob).text()).toBe("mp3");
    expect(fetch).toHaveBeenCalledOnce();
  });
});
