import { afterEach, describe, expect, it, vi } from "vitest";
import { CLASSIC_STORIES } from "@/lib/stories";
import { buildImagePrompt, buildReferencePrompt, charactersInScene } from "@/lib/engine/imagePrompt";
import { buildVideoPrompt } from "@/lib/engine/videoPrompt";

const mocks = vi.hoisted(() => ({ post: vi.fn(), streamTurn: vi.fn(), speechAudio: vi.fn(), animateScene: vi.fn(), audioDuration: vi.fn(), falImage: vi.fn(), falQueueSubmit: vi.fn() }));
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
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe("story visuals", () => {
  it("ties a reference picture to its established character design", () => {
    const names = charactersInScene("Tilly Tortoise greets Harry Hare", story.characters);
    expect(names).toEqual(["Tilly Tortoise", "Harry Hare"]);
    const prompt = buildReferencePrompt(
      buildImagePrompt("Tilly Tortoise greets Harry Hare", story.artStyle, story.characters),
      [{ url: "https://v3.fal.media/tilly.jpg", characters: ["Tilly Tortoise"] }], story.characters,
    );
    expect(prompt).toContain("Image 1 shows the established design of Tilly Tortoise");
    expect(prompt).toContain("patterned brown shell");
    expect(prompt).toContain("do not copy the old composition");
  });

  it("animates the story action while preserving the scene", () => {
    const prompt = buildVideoPrompt("Tilly stands beneath the oak tree", "Tilly takes two small steps and her scarf flutters");
    expect(prompt).toContain("Tilly takes two small steps");
    expect(prompt).toContain("Only move elements already in the picture");
    expect(prompt).toContain("Keep the camera still");
  });

  it("uses multiple character references for a new illustration", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["image"], { type: "image/jpeg" }))));
    mocks.falImage.mockResolvedValue("https://v3.fal.media/new.jpg");
    const response = await createImage(new Request("http://localhost/api/image", { method: "POST", body: JSON.stringify({
      scene: "Tilly Tortoise and Harry Hare meet", artStyle: story.artStyle, characters: story.characters,
      references: [
        { url: "https://v3.fal.media/tilly.jpg", characters: ["Tilly Tortoise"] },
        { url: "https://v3.fal.media/harry.jpg", characters: ["Harry Hare"] },
      ],
    }) }));
    expect(response.status).toBe(200);
    expect(mocks.falImage).toHaveBeenCalledWith("fal-ai/flux-2/edit", expect.objectContaining({
      image_urls: ["https://v3.fal.media/tilly.jpg", "https://v3.fal.media/harry.jpg"],
      prompt: expect.stringContaining("Image 2 shows the established design of Harry Hare"),
    }), expect.any(AbortSignal));
  });

  it("sends the chosen action to the video model without prompt expansion", async () => {
    mocks.falQueueSubmit.mockResolvedValue("12345678-1234-1234-1234-123456789abc");
    const response = await createVideo(new Request("http://localhost/api/video", { method: "POST", body: JSON.stringify({
      imageUrl: "https://v3.fal.media/scene.jpg", scene: "Tilly stands beneath the oak tree",
      motion: "Tilly takes two small steps",
    }) }));
    expect(response.status).toBe(200);
    expect(mocks.falQueueSubmit).toHaveBeenCalledWith("minimax/h3-max-turbo/image-to-video", expect.objectContaining({
      prompt: expect.stringContaining("Tilly takes two small steps"), prompt_expansion_mode: "disabled",
    }), expect.any(AbortSignal));
  });

  it("reuses each character's first picture on a later page", async () => {
    const scenes = [
      { imagePrompt: "Tilly Tortoise walks along the path", motionPrompt: "Tilly takes two steps" },
      { imagePrompt: "Harry Hare waits under a tree", motionPrompt: "Harry flicks an ear" },
      { imagePrompt: "Tilly Tortoise and Harry Hare meet", motionPrompt: "They wave to each other" },
    ];
    let image = 0;
    mocks.streamTurn.mockImplementation(async () => ({
      segments: [{ speaker: "narrator", text: "The race continues." }], stateChanges: { plotNotes: ["The child changed the race"] }, advanceBeat: false,
      awaitChild: true, isEnding: false, ...scenes.shift(),
    }));
    mocks.speechAudio.mockImplementation(() => ({ blob: Promise.resolve(new Blob(["audio"])), play: async () => {} }));
    mocks.post.mockImplementation(async () => ({ url: `https://v3.fal.media/scene-${++image}.jpg`, dataUri: "data:image/jpeg;base64,aW1hZ2U=" }));
    mocks.animateScene.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["image"], { type: "image/jpeg" }))));

    const session = new StorySession(story, () => {});
    await session.mode("play");
    for (let turn = 1; turn <= 3; turn++) {
      await session.turn();
      await vi.waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(turn));
      await vi.waitFor(() => expect(session.view.imageBusy).toBe(false));
    }
    const third = mocks.post.mock.calls[2][1];
    expect(third.references).toEqual([
      { url: "https://v3.fal.media/scene-1.jpg", characters: ["Tilly Tortoise"] },
      { url: "https://v3.fal.media/scene-2.jpg", characters: ["Harry Hare"] },
    ]);
    expect(mocks.animateScene.mock.calls[2][2]).toBe("They wave to each other");
    session.close();
  });
});
