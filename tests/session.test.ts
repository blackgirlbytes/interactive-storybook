import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLASSIC_STORIES } from "@/lib/stories";
const mocks = vi.hoisted(() => ({ post:vi.fn(), speech:vi.fn(), playBlob:vi.fn(), speechAudio:vi.fn(), streamTurn:vi.fn(), animateScene:vi.fn() }));
vi.mock("@/lib/audio/client", () => ({ ...mocks, Microphone: class { stop() {} } }));
import { StorySession } from "@/lib/audio/session";
const story = CLASSIC_STORIES[2];
const reply = { segments:[{speaker:"narrator",text:"Once upon a time."}],stateChanges:{},advanceBeat:false,awaitChild:true,isEnding:false };
beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks();
  mocks.streamTurn.mockImplementation(async (_state, _signal, onSegment) => { reply.segments.forEach(onSegment); return reply; });
  mocks.speech.mockResolvedValue(new Blob(["audio"]));
  mocks.playBlob.mockResolvedValue(undefined);
  mocks.speechAudio.mockImplementation((text, voice, signal) => {
    const blob = mocks.speech(text, voice, signal);
    void blob.catch(() => {});
    return { blob, play: async () => mocks.playBlob(await blob, signal) };
  });
});
afterEach(() => vi.useRealTimers());
describe("session lifecycle", () => {
  it("ignores a turn response that arrives after interruption", async () => {
    let resolve!: (value: unknown) => void;
    mocks.streamTurn.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const s = new StorySession(story,()=>{});
    const old = s.turn();
    await s.turn("The tortoise has roller skates!");
    resolve({ ...reply,segments:[{speaker:"narrator",text:"Old stale narration."}] });
    await old;
    expect(s.view.pages).toHaveLength(1);
    expect(s.view.state.log.some(l => l.text === "Old stale narration.")).toBe(false);
    expect(s.view.state.log[0].text).toContain("roller skates");
    s.close();
  });
  it("automatically progresses in listen mode and stops on pause", async () => {
    const s = new StorySession(story,()=>{});
    await s.turn();
    await vi.advanceTimersByTimeAsync(1200);
    expect(s.view.pages).toHaveLength(2);
    expect(mocks.streamTurn).toHaveBeenCalledTimes(3);
    s.pause();
    await vi.advanceTimersByTimeAsync(3000);
    expect(mocks.streamTurn).toHaveBeenCalledTimes(3);
    s.close();
  });
  it("replays an interrupted page instead of silently skipping it", async () => {
    mocks.playBlob.mockImplementationOnce((_blob,signal: AbortSignal) => new Promise((_,reject) => { signal.addEventListener("abort",()=>reject(new DOMException("Stopped","AbortError"))); }));
    const s = new StorySession(story,()=>{});
    const pending = s.turn();
    await vi.waitFor(() => expect(mocks.playBlob).toHaveBeenCalledOnce());
    s.pause(); await pending;
    await s.turn();
    expect(s.view.pages).toHaveLength(1);
    expect(mocks.playBlob).toHaveBeenCalledTimes(2);
    s.close();
  });
  it("completes missing audio for saved interrupted pages", async () => {
    mocks.speech.mockImplementationOnce((_t,_v,signal:AbortSignal) => new Promise((_,reject) => { signal.addEventListener("abort",()=>reject(new DOMException("Stopped","AbortError"))); }));
    const s = new StorySession(story,()=>{});
    const pending = s.turn();
    await vi.waitFor(() => expect(mocks.speech).toHaveBeenCalledOnce());
    const snapshot = await s.snapshot(); await pending;
    expect(snapshot.pages[0].audio[0]).toBeInstanceOf(Blob);
    expect(mocks.speech).toHaveBeenCalledTimes(2);
    s.close();
  });
  it("voices the first streamed line before the final turn arrives", async () => {
    let resolve!: (value: unknown) => void;
    mocks.streamTurn.mockImplementationOnce((_state, _signal, onSegment) => {
      onSegment(reply.segments[0]);
      return new Promise(r => { resolve = r; });
    });
    const s = new StorySession(story, () => {});
    const pending = s.turn();
    await vi.waitFor(() => expect(mocks.playBlob).toHaveBeenCalledOnce());
    expect(s.view.pages[0].segments[0].text).toBe("Once upon a time.");
    resolve(reply);
    await pending;
    expect(mocks.playBlob).toHaveBeenCalledOnce();
    s.close();
  });
  it("uses the warmed opening and discards a stale next page for a child's idea", async () => {
    const s = new StorySession(story, () => {});
    s.warmup();
    await s.turn();
    expect(mocks.streamTurn).toHaveBeenCalledTimes(2); // opening + one page ahead
    const unused = mocks.streamTurn.mock.calls[1][1] as AbortSignal;
    await s.turn("Give the tortoise roller skates");
    expect(unused.aborted).toBe(true);
    expect(mocks.streamTurn.mock.calls[2][0].log.at(-1).text).toContain("roller skates");
    s.close();
  });
  it("animates a new picture and shares the clip with pages that reuse it", async () => {
    const image = new Blob(["image"], { type: "image/jpeg" });
    const video = new Blob(["video"], { type: "video/mp4" });
    const fetchMock = vi.fn(async () => new Response(image));
    vi.stubGlobal("fetch", fetchMock);
    mocks.post.mockResolvedValue({ url: "https://v3.fal.media/files/scene.jpg", dataUri: "data:image/jpeg;base64,aW1hZ2U=" });
    let finish!: (blob: Blob) => void;
    mocks.animateScene.mockImplementation(() => new Promise(r => { finish = r; }));
    mocks.streamTurn.mockImplementationOnce(async (_state, _signal, onSegment) => { reply.segments.forEach(onSegment); return { ...reply, imagePrompt: "Hare naps under a tree" }; });
    const s = new StorySession(story, () => {});
    await s.turn();
    await vi.waitFor(() => expect(mocks.animateScene).toHaveBeenCalledOnce());
    expect(mocks.animateScene.mock.calls[0].slice(0, 2)).toEqual(["https://v3.fal.media/files/scene.jpg", "Hare naps under a tree"]);
    expect(s.view.videoBusy).toBe(true);
    await s.turn("The hare wakes up");
    expect(s.view.pages).toHaveLength(2);
    finish(video);
    await vi.waitFor(() => expect(s.view.videoBusy).toBe(false));
    expect(s.view.pages.map(p => p.video)).toEqual([video, video]);
    s.close();
    vi.unstubAllGlobals();
  });
});
