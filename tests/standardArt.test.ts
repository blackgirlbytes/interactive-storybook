import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CLASSIC_STORIES } from "@/lib/stories";
import { isStandardArtUrl, standardArtUrl } from "@/lib/stories/standardArt";

const mocks = vi.hoisted(() => ({ post: vi.fn(), streamTurn: vi.fn(), speechAudio: vi.fn(), playBlob: vi.fn(), audioDuration: vi.fn(), animateScene: vi.fn(), falImage: vi.fn(), falQueueSubmit: vi.fn() }));
vi.mock("@/lib/audio/client", () => ({
  ...mocks,
  Microphone: class { start = vi.fn().mockResolvedValue(undefined); stop = vi.fn(); },
}));
vi.mock("@/lib/server/fal", () => ({
  ConfigError: class extends Error {}, falImage: mocks.falImage, falQueueSubmit: mocks.falQueueSubmit,
  falQueueStatus: vi.fn(), falQueueResult: vi.fn(), VIDEO_MODEL: "minimax/h3-max-turbo/image-to-video",
}));

import { StorySession } from "@/lib/audio/session";
import { POST as createImage } from "@/app/api/image/route";
import { POST as createVideo } from "@/app/api/video/route";

const story = CLASSIC_STORIES[2];
const turn = {
  segments: [{ speaker: "narrator", text: "Tilly and Harry meet." }],
  stateChanges: {}, advanceBeat: false, imagePrompt: "Tilly Tortoise meets Harry Hare",
  motionPrompt: "Tilly nods", awaitChild: true, isEnding: false,
};

beforeEach(() => {
  mocks.speechAudio.mockImplementation(() => ({ blob: Promise.resolve(new Blob(["audio"])), play: async () => {} }));
  mocks.playBlob.mockResolvedValue(undefined);
  mocks.audioDuration.mockResolvedValue(1);
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe("standard story illustrations", () => {
  it("has a stable asset path for every built-in beat", () => {
    for (const book of CLASSIC_STORIES) {
      for (let index = 0; index < book.beats.length; index++) {
        expect(isStandardArtUrl(standardArtUrl(book, index)!)).toBe(true);
      }
    }
    expect(standardArtUrl(story, 99)).toBeUndefined();
    expect(isStandardArtUrl("/story-art/../../secret.jpg")).toBe(false);
  });

  it("ships a JPEG for every built-in beat", async () => {
    for (const book of CLASSIC_STORIES) {
      for (let index = 0; index < book.beats.length; index++) {
        const file = join(process.cwd(), "public", standardArtUrl(book, index)!.slice(1));
        const bytes = await readFile(file);
        expect(bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))).toBe(true);
      }
    }
  });

  it("shows the fixed picture without calling fal for an unchanged story", async () => {
    mocks.streamTurn.mockResolvedValue(turn);
    mocks.speechAudio.mockImplementation(() => ({ blob: Promise.resolve(new Blob(["audio"])), play: async () => {} }));
    mocks.animateScene.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["picture"], { type: "image/jpeg" }))));
    const session = new StorySession(story, () => {});
    await session.turn();
    await vi.waitFor(() => expect(session.view.pages[0].image).toBeInstanceOf(Blob));
    expect(session.view.pages[0].standardArtUrl).toBe("/story-art/tortoise-and-hare/beat-0.jpg");
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.animateScene).toHaveBeenCalledWith("/story-art/tortoise-and-hare/beat-0.jpg", turn.imagePrompt, turn.motionPrompt, expect.any(AbortSignal));
    session.close();
  });

  it("reuses a fixed picture and its animation across turns in the same beat", async () => {
    mocks.streamTurn.mockResolvedValue(turn);
    mocks.speechAudio.mockImplementation(() => ({ blob: Promise.resolve(new Blob(["audio"])), play: async () => {} }));
    mocks.animateScene.mockResolvedValue(undefined);
    const fetchMock = vi.fn(async () => new Response(new Blob(["picture"], { type: "image/jpeg" })));
    vi.stubGlobal("fetch", fetchMock);
    const session = new StorySession(story, () => {});
    await session.turn();
    await vi.waitFor(() => expect(session.view.pages[0].image).toBeInstanceOf(Blob));
    await session.turn();
    expect(session.view.error).toBe("");
    expect(session.view.pages[1].image).toBe(session.view.pages[0].image);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.animateScene).toHaveBeenCalledTimes(1);
    session.close();
  });

  it("generates a new picture when the child changes the story", async () => {
    mocks.streamTurn.mockResolvedValue({ ...turn, stateChanges: { plotNotes: ["Tilly has roller skates"] } });
    mocks.speechAudio.mockImplementation(() => ({ blob: Promise.resolve(new Blob(["audio"])), play: async () => {} }));
    mocks.post.mockResolvedValue({ url: "https://v3.fal.media/changed.jpg", dataUri: "data:image/jpeg;base64,aW1hZ2U=" });
    mocks.animateScene.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["picture"], { type: "image/jpeg" }))));
    const session = new StorySession(story, () => {});
    await session.turn("Give Tilly roller skates");
    await vi.waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    expect(mocks.post.mock.calls[0][1].standardArt).toEqual({ storyId: story.id, beatIndex: 0 });
    expect(session.view.pages[0].standardArtUrl).toBeUndefined();
    session.close();
  });

  it("gives fal the stored picture as a reference for a changed scene", async () => {
    mocks.falImage.mockResolvedValue("https://v3.fal.media/new.jpg");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["picture"], { type: "image/jpeg" }))));
    const response = await createImage(new Request("http://localhost/api/image", { method: "POST", body: JSON.stringify({
      scene: "Tilly Tortoise has roller skates", artStyle: story.artStyle, characters: story.characters,
      standardArt: { storyId: story.id, beatIndex: 0 },
    }) }));
    expect(response.status).toBe(200);
    expect(mocks.falImage).toHaveBeenCalledWith("fal-ai/flux-kontext/dev", expect.objectContaining({
      image_url: expect.stringMatching(/^data:image\/jpeg;base64,/),
    }), expect.any(AbortSignal));
  });

  it("can animate a shipped picture without a fal CDN link", async () => {
    mocks.falQueueSubmit.mockResolvedValue("12345678-1234-1234-1234-123456789abc");
    const response = await createVideo(new Request("http://localhost/api/video", { method: "POST", body: JSON.stringify({
      imageUrl: "/story-art/tortoise-and-hare/beat-0.jpg", scene: "Tilly and Harry meet", motion: "Tilly nods",
    }) }));
    expect(response.status).toBe(200);
    expect(mocks.falQueueSubmit).toHaveBeenCalledWith("minimax/h3-max-turbo/image-to-video", expect.objectContaining({
      image_url: expect.stringMatching(/^data:image\/jpeg;base64,/), seed: expect.any(Number),
    }), expect.any(AbortSignal));
  });
});
