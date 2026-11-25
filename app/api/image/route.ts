import { z } from "zod";
import { buildImagePrompt, buildReferencePrompt } from "@/lib/engine/imagePrompt";
import { falImage } from "@/lib/server/fal";
import { errorResponse } from "@/lib/server/errors";
import { getClassicStory } from "@/lib/stories";
import { standardArtUrl } from "@/lib/stories/standardArt";
import { standardArtDataUri } from "@/lib/server/standardArt";

const Body = z.object({
  scene: z.string().trim().min(1).max(800),
  artStyle: z.string().max(500),
  characters: z.array(z.object({ name: z.string().max(60), look: z.string().max(400) })).max(12),
  references: z.array(z.object({ url: z.string().url(), characters: z.array(z.string().max(60)).max(12) })).max(4).optional(),
  standardArt: z.object({ storyId: z.string().max(80), beatIndex: z.number().int().min(0).max(50) }).optional(),
});

const FAL_MEDIA_HOST = /(^|\.)fal\.media$/;

async function toDataUri(url: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Could not download image (${res.status})`);
  const type = res.headers.get("content-type") || "image/jpeg";
  const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
  return `data:${type};base64,${b64}`;
}

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid image request" }, { status: 400 });
    const { scene, artStyle, characters } = parsed.data;
    const prompt = buildImagePrompt(scene, artStyle, characters);

    let url: string | undefined;
    const references = (parsed.data.references ?? []).filter(reference => FAL_MEDIA_HOST.test(new URL(reference.url).hostname));
    const standard = parsed.data.standardArt;
    const story = standard && getClassicStory(standard.storyId);
    const standardUrl = story && standardArtUrl(story, standard!.beatIndex);
    if (standardUrl) {
      try {
        references.splice(0, references.length,
          { url: await standardArtDataUri(standardUrl), characters: [] }, ...references.slice(-3));
      } catch (e) {
        console.warn("Standard illustration reference unavailable:", e);
      }
    }
    if (references.length > 1) {
      try {
        url = await falImage(
          "fal-ai/flux-2/edit",
          {
            prompt: buildReferencePrompt(prompt, references, characters),
            image_urls: references.map(reference => reference.url),
            image_size: "landscape_4_3",
            enable_prompt_expansion: false,
            enable_safety_checker: true,
            output_format: "jpeg",
          },
          req.signal,
        );
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") throw e;
        console.warn("Multi-reference illustration failed, trying one reference:", e);
      }
    }
    if (!url && references.length) {
      const ref = references.at(-1)!;
      try {
        url = await falImage(
          "fal-ai/flux-kontext/dev",
          {
            prompt: buildReferencePrompt(prompt, [ref], characters),
            image_url: ref.url,
            resolution_mode: "4:3",
            num_inference_steps: 20,
            enable_safety_checker: true,
            output_format: "jpeg",
          },
          req.signal,
        );
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") throw e;
        console.warn("Referenced illustration failed, falling back to schnell:", e);
      }
    }
    url ??= await falImage(
      "fal-ai/flux/schnell",
      { prompt, image_size: "landscape_4_3", num_inference_steps: 4, num_images: 1, enable_safety_checker: true },
      req.signal,
    );
    return Response.json({ url, dataUri: await toDataUri(url, req.signal) });
  } catch (err) {
    return errorResponse(err);
  }
}
