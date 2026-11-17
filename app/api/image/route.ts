import { z } from "zod";
import { buildImagePrompt } from "@/lib/engine/imagePrompt";
import { falImage } from "@/lib/server/fal";
import { errorResponse } from "@/lib/server/errors";

const Body = z.object({
  scene: z.string().trim().min(1).max(800),
  artStyle: z.string().max(500),
  characters: z.array(z.object({ name: z.string().max(60), look: z.string().max(400) })).max(12),
  referenceUrl: z.string().url().optional(),
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
    const { scene, artStyle, characters, referenceUrl } = parsed.data;
    const prompt = buildImagePrompt(scene, artStyle, characters);

    let url: string | undefined;
    const ref = referenceUrl && FAL_MEDIA_HOST.test(new URL(referenceUrl).hostname) ? referenceUrl : undefined;
    if (ref) {
      try {
        url = await falImage(
          "fal-ai/flux-kontext/dev",
          {
            prompt: `Keep the same art style and the same character designs as the reference picture. Draw this new moment: ${prompt}`,
            image_url: ref,
            resolution_mode: "4:3",
            num_inference_steps: 20,
            enable_safety_checker: true,
            output_format: "jpeg",
          },
          req.signal,
        );
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") throw e;
        console.warn("Kontext failed, falling back to schnell:", e);
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
