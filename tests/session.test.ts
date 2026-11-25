import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLASSIC_STORIES } from "@/lib/stories";
const mocks = vi.hoisted(() => ({ post:vi.fn(), speech:vi.fn(), playBlob:vi.fn(), speechAudio:vi.fn(), streamTurn:vi.fn(), animateScene:vi.fn(), audioDuration:vi.fn(), micStart:vi.fn(), micStop:vi.fn(), micFinish:vi.fn() }));
vi.mock("@/lib/audio/client", () => ({ ...mocks, Microphone: class { start = mocks.micStart; stop = mocks.micStop; finish = mocks.micFinish; } }));
import { StorySession } from "@/lib/audio/session";
const story = CLASSIC_STORIES[2];
const reply = { segments:[{speaker:"narrator",text:"Once upon a time."}],stateChanges:{},advanceBeat:false,awaitChild:true,isEnding:false };
beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks();
  mocks.streamTurn.mockImplementation(async (_state, _signal, onSegment) => { reply.segments.forEach(onSegment); return reply; });
  mocks.speech.mockResolvedValue(new Blob(["audio"]));
  mocks.playBlob.mockResolvedValue(undefined);
  mocks.micStart.mockResolvedValue(undefined);
  mocks.micFinish.mockImplementation(async () => { mocks.micStop(); return ""; });
  mocks.speechAudio.mockImplementation((text, voice, signal) => {
    const blob = mocks.speech(text, voice, signal);
    void blob.catch(() => {});
    return { blob, play: async () => mocks.playBlob(await blob, signal) };
  });
});
afterEach(() => vi.useRealTimers());
describe("session lifecycle", () => {
  it("keeps only completed narration in memory when a child interrupts", async () => {
    const segments = [
      { speaker: "narrator", text: "The dragon found a silver key." },
      { speaker: "narrator", text: "She opened the garden gate." },
      { speaker: "narrator", text: "A tiny fox ran out." },
    ];
    mocks.streamTurn.mockImplementationOnce(async (_state, _signal, onSegment) => {
      segments.forEach(onSegment);
      return { ...reply, segments, stateChanges: { addObjects: ["a tiny fox"] }, advanceBeat: true };
    });
    let plays = 0;
    mocks.playBlob.mockImplementation((_blob, signal: AbortSignal) => {
      if (++plays !== 2) return Promise.resolve();
      return new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Stopped", "AbortError")), { once: true }));
    });
    const s = new StorySession(story, () => {});
    await s.mode("play");
    const firstTurn = s.turn();
    await vi.waitFor(() => expect(mocks.playBlob).toHaveBeenCalledTimes(2));
    const onInterim = mocks.micStart.mock.calls[0][0] as (text: string) => void;
    onInterim("Give the dragon a balloon instead");
    await firstTurn;
    await s.turn("Give the dragon a balloon instead");
    const nextState = mocks.streamTurn.mock.calls.find(([state]) => state.log.at(-1)?.kind === "child")![0];
    expect(nextState.log.map((entry: { text: string }) => entry.text)).toEqual([
      "The dragon found a silver key.",
      "Give the dragon a balloon instead",
    ]);
    expect(nextState.objects).not.toContain("a tiny fox");
    expect(nextState.beatIndex).toBe(0);
    expect(s.view.pages[0].segments.map(segment => segment.text)).toEqual(["The dragon found a silver key."]);
    s.close();
  });
  it("forgets a page when the child interrupts before its first line finishes", async () => {
    mocks.playBlob.mockImplementationOnce((_blob, signal: AbortSignal) =>
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Stopped", "AbortError")), { once: true }))
    );
    const s = new StorySession(story, () => {});
    await s.mode("play");
    const firstTurn = s.turn();
    await vi.waitFor(() => expect(mocks.playBlob).toHaveBeenCalledOnce());
    const onInterim = mocks.micStart.mock.calls[0][0] as (text: string) => void;
    onInterim("Make the hero a dragon");
    await firstTurn;
    await s.turn("Make the hero a dragon");
    const nextState = mocks.streamTurn.mock.calls.find(([state]) => state.log.at(-1)?.kind === "child")![0];
    expect(nextState.log.map((entry: { text: string }) => entry.text)).toEqual(["Make the hero a dragon"]);
    expect(s.view.pages).toHaveLength(1);
    s.close();
  });
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
    await vi.advanceTimersByTimeAsync(500);
    expect(s.view.pages).toHaveLength(2);
    expect(mocks.streamTurn).toHaveBeenCalledTimes(3);
    s.pauseNarrator();
    await vi.advanceTimersByTimeAsync(3000);
    expect(mocks.streamTurn).toHaveBeenCalledTimes(3);
    s.close();
  });
  it("moves on after eight seconds when nobody answers in Play & talk", async () => {
    const s = new StorySession(story, () => {});
    await s.mode("play");
    await s.turn();
    expect(s.view.status).toBe("What happens next? Tell me!");
    await vi.advanceTimersByTimeAsync(7999);
    expect(mocks.streamTurn).toHaveBeenCalledTimes(2); // the next page is ready in the background
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.streamTurn).toHaveBeenCalledTimes(3); // only the following page needs a new request
    expect(s.view.pages).toHaveLength(2);
    s.close();
  });
  it("keeps waiting when speech begins and uses the child's answer", async () => {
    const s = new StorySession(story, () => {});
    await s.mode("play");
    await s.turn();
    const onInterim = mocks.micStart.mock.calls[0][0] as (text: string) => void;
    onInterim("The tortoise finds a bicycle");
    await vi.advanceTimersByTimeAsync(8000);
    expect(mocks.streamTurn).toHaveBeenCalledTimes(2);
    const onFinal = mocks.micStart.mock.calls[0][1] as (text: string) => void;
    onFinal("The tortoise finds a bicycle");
    await vi.waitFor(() => expect(mocks.streamTurn.mock.calls.some(([state]) => state.log.at(-1)?.text === "The tortoise finds a bicycle")).toBe(true));
    s.close();
  });
  it("does not interrupt narration or its next-page timer for microphone echo", async () => {
    const s = new StorySession(story, () => {});
    await s.mode("play");
    let finishPlayback!: () => void;
    mocks.playBlob.mockImplementationOnce(() => new Promise<void>(resolve => { finishPlayback = resolve; }));
    const opening = s.turn();
    await vi.waitFor(() => expect(mocks.playBlob).toHaveBeenCalledOnce());
    const signal = mocks.streamTurn.mock.calls[0][1] as AbortSignal;
    const onInterim = mocks.micStart.mock.calls[0][0] as (text: string) => void;
    const onFinal = mocks.micStart.mock.calls[0][1] as (text: string) => void;
    onInterim("Once upon a time.");
    onFinal("Once upon a time.");
    expect(signal.aborted).toBe(false);
    finishPlayback();
    await opening;
    await vi.advanceTimersByTimeAsync(8000);
    expect(s.view.pages).toHaveLength(2);
    expect(s.view.state.log.some(entry => entry.kind === "child" && entry.text === "Once upon a time.")).toBe(false);
    s.close();
  });
  it("discards the prepared page when a child answers just before the timeout", async () => {
    const s = new StorySession(story, () => {});
    await s.mode("play");
    await s.turn();
    const unused = mocks.streamTurn.mock.calls[1][1] as AbortSignal;
    await vi.advanceTimersByTimeAsync(7999);
    const onInterim = mocks.micStart.mock.calls[0][0] as (text: string) => void;
    onInterim("The hare finds a bicycle");
    const onFinal = mocks.micStart.mock.calls[0][1] as (text: string) => void;
    onFinal("The hare finds a bicycle");
    await vi.waitFor(() => expect(mocks.streamTurn.mock.calls.some(([state]) =>
      state.log.at(-1)?.text === "The hare finds a bicycle")).toBe(true));
    expect(unused.aborted).toBe(true);
    expect(s.view.state.log.some(entry => entry.kind === "child" && entry.text === "The hare finds a bicycle")).toBe(true);
    s.close();
  });
  it("cancels the unanswered question timer when paused", async () => {
    const s = new StorySession(story, () => {});
    await s.mode("play");
    await s.turn();
    s.pauseNarrator();
    await vi.advanceTimersByTimeAsync(8000);
    expect(mocks.streamTurn).toHaveBeenCalledTimes(2);
    s.close();
  });
  it("uses the shorter automatic wait when switching from Play & talk to Listen", async () => {
    const s = new StorySession(story, () => {});
    await s.mode("play");
    await s.turn();
    await s.mode("listen");
    await vi.advanceTimersByTimeAsync(500);
    expect(s.view.pages).toHaveLength(2);
    s.close();
  });
  it("replays an interrupted page instead of silently skipping it", async () => {
    mocks.playBlob.mockImplementationOnce((_blob,signal: AbortSignal) => new Promise((_,reject) => { signal.addEventListener("abort",()=>reject(new DOMException("Stopped","AbortError"))); }));
    const s = new StorySession(story,()=>{});
    const pending = s.turn();
    await vi.waitFor(() => expect(mocks.playBlob).toHaveBeenCalledOnce());
    s.pauseNarrator(); await pending;
    await s.turn();
    expect(s.view.pages).toHaveLength(1);
    expect(mocks.playBlob).toHaveBeenCalledTimes(2);
    s.close();
  });
  it("keeps listening when only the narrator is paused", async () => {
    const s = new StorySession(story, () => {});
    await s.mode("play");
    s.pauseNarrator();
    expect(s.view.listening).toBe(true);
    expect(s.view.pauseMode).toBe("narrator");
    expect(mocks.micStop).not.toHaveBeenCalled();
    const onFinal = mocks.micStart.mock.calls[0][1] as (text: string) => void;
    onFinal("Give the tortoise roller skates");
    await vi.waitFor(() => expect(s.view.pauseMode).toBe("none"));
    expect(s.view.state.log.some(entry => entry.kind === "child" && entry.text.includes("roller skates"))).toBe(true);
    s.close();
  });
  it("pauses only the microphone and resumes it without stopping the story", async () => {
    const s = new StorySession(story, () => {});
    await s.mode("play");
    await s.turn();
    const pagesBefore = s.view.pages.length;
    const oldFinal = mocks.micStart.mock.calls[0][1] as (text: string) => void;
    s.pauseMicrophone();
    expect(mocks.micFinish).toHaveBeenCalledOnce();
    expect(s.view.listening).toBe(false);
    expect(s.view.micPaused).toBe(true);
    expect(s.view.status).toBe("Microphone paused. Story continues.");
    expect(s.view.pauseMode).toBe("none");
    oldFinal("An ignored late answer");
    await vi.advanceTimersByTimeAsync(8000);
    expect(s.view.pages.length).toBeGreaterThan(pagesBefore);
    expect(s.view.state.log.some(entry => entry.kind === "child" && entry.text === "An ignored late answer")).toBe(false);
    s.view.error = "Previous microphone error";
    await s.resumeMicrophone();
    expect(mocks.micStart).toHaveBeenCalledTimes(2);
    expect(s.view.listening).toBe(true);
    expect(s.view.micPaused).toBe(false);
    expect(s.view.error).toBe("");
    s.close();
  });
  it("stops listening with a full pause and reconnects on resume", async () => {
    const s = new StorySession(story, () => {});
    await s.mode("play");
    const oldFinal = mocks.micStart.mock.calls[0][1] as (text: string) => void;
    s.pauseAll();
    expect(s.view.listening).toBe(false);
    expect(s.view.pauseMode).toBe("all");
    expect(mocks.micStop).toHaveBeenCalledOnce();
    oldFinal("This should be ignored");
    expect(mocks.streamTurn).not.toHaveBeenCalled();
    await s.resume();
    expect(mocks.micStart).toHaveBeenCalledTimes(2);
    expect(s.view.listening).toBe(true);
    expect(s.view.pauseMode).toBe("none");
    expect(mocks.streamTurn).toHaveBeenCalledTimes(2);
    s.close();
  });
  it("keeps what the child was saying when everything is paused", async () => {
    const s = new StorySession(story, () => {});
    await s.mode("play");
    mocks.micFinish.mockResolvedValueOnce("The tortoise has roller skates");
    s.pauseAll();
    expect(mocks.streamTurn).not.toHaveBeenCalled();
    await s.resume();
    expect(mocks.streamTurn).toHaveBeenCalledTimes(2);
    const sentState = mocks.streamTurn.mock.calls[0][0];
    expect(sentState.log.at(-1)).toMatchObject({ kind: "child", text: "The tortoise has roller skates" });
    s.close();
  });
  it("saves what the child was saying when Save is pressed", async () => {
    const s = new StorySession(story, () => {});
    await s.mode("play");
    mocks.micFinish.mockResolvedValueOnce("Add a purple dragon");
    const snapshot = await s.snapshot();
    expect(snapshot.state.log.at(-1)).toMatchObject({ kind: "child", text: "Add a purple dragon" });
    expect(mocks.streamTurn).not.toHaveBeenCalled();
    s.close();
  });
  it.each(["full pause", "save"])("keeps pending microphone words when Pause mic is followed by %s", async next => {
    const s = new StorySession(story, () => {});
    await s.mode("play");
    let finish!: (text: string) => void;
    mocks.micFinish.mockImplementationOnce(() => new Promise<string>(resolve => { finish = resolve; }));
    s.pauseMicrophone();
    const pending = next === "save" ? s.snapshot() : (s.pauseAll(), s.resume());
    finish("A bright purple dragon");
    if (next === "save") {
      const saved = await pending as Awaited<ReturnType<typeof s.snapshot>>;
      expect(saved.state.log.at(-1)).toMatchObject({ kind: "child", text: "A bright purple dragon" });
      expect(mocks.streamTurn).not.toHaveBeenCalled();
    } else {
      await pending;
      expect(mocks.streamTurn.mock.calls[0][0].log.at(-1)).toMatchObject({ kind: "child", text: "A bright purple dragon" });
    }
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
    mocks.streamTurn.mockImplementationOnce(async (_state, _signal, onSegment) => { reply.segments.forEach(onSegment); return { ...reply, stateChanges: { plotNotes: ["Hare naps in a new place"] }, imagePrompt: "Hare naps under a tree" }; });
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
  it("keeps a completed clip when a custom story reuses the same scene", async () => {
    const image = new Blob(["image"], { type: "image/jpeg" });
    const video = new Blob(["video"], { type: "video/mp4" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(image)));
    mocks.post.mockResolvedValue({ url: "https://v3.fal.media/files/scene.jpg", dataUri: "data:image/jpeg;base64,aW1hZ2U=" });
    mocks.animateScene.mockResolvedValue(video);
    mocks.streamTurn.mockImplementationOnce(async (_state, _signal, onSegment) => {
      reply.segments.forEach(onSegment);
      return { ...reply, stateChanges: { plotNotes: ["Hare naps in a new place"] }, imagePrompt: "Hare naps under a tree" };
    });
    const s = new StorySession(story, () => {});
    await s.turn();
    await vi.waitFor(() => expect(s.view.pages[0].video).toBe(video));
    await s.turn("The hare wakes up");
    expect(s.view.pages[1].image).toBe(s.view.pages[0].image);
    expect(s.view.pages[1].video).toBe(video);
    s.close();
    vi.unstubAllGlobals();
  });
});
