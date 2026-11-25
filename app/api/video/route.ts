import { z } from "zod";
import { buildVideoPrompt } from "@/lib/engine/videoPrompt";
import { falQueueResult, falQueueStatus, falQueueSubmit, VIDEO_MODEL } from "@/lib/server/fal";
import { errorResponse } from "@/lib/server/errors";

const Body = z.object({ imageUrl: z.string().url(), scene: z.string().trim().min(1).max(800), motion: z.string().trim().max(300).optional() });
const FAL_MEDIA_HOST = /(^|\.)fal\.media$/;
const REQUEST_ID = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request) {
  try {
    if (!VIDEO_MODEL) return Response.json({ disabled: true });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success || !FAL_MEDIA_HOST.test(new URL(parsed.data.imageUrl).hostname)) {
      return Response.json({ error: "Invalid video request" }, { status: 400 });
    }
    const { imageUrl, scene, motion } = parsed.data;
    const id = await falQueueSubmit(VIDEO_MODEL, {
      prompt: buildVideoPrompt(scene, motion),
      image_url: imageUrl,
      // Matching first and last frames makes the clip loop without a visible jump.
      end_image_url: imageUrl,
      duration: 5,
      resolution: "768P",
      prompt_expansion_mode: "disabled",
      enable_safety_checker: true,
    }, req.signal);
    return Response.json({ id });
  } catch (err) {
    return errorResponse(err);
  }
}

/** 202 with a status while the clip renders, then the MP4 itself. */
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!VIDEO_MODEL || !REQUEST_ID.test(id)) return Response.json({ error: "Invalid video id" }, { status: 400 });
    const status = await falQueueStatus(VIDEO_MODEL, id, req.signal);
    if (status !== "COMPLETED") return Response.json({ status }, { status: 202 });
    const result = await falQueueResult<{ video?: { url?: string } }>(VIDEO_MODEL, id, req.signal);
    const url = result.video?.url;
    if (!url || !FAL_MEDIA_HOST.test(new URL(url).hostname)) throw new Error("fal video returned no clip");
    const video = await fetch(url, { signal: req.signal });
    if (!video.ok || !video.body) throw new Error(`Could not download video (${video.status})`);
    return new Response(video.body, { headers: { "Content-Type": video.headers.get("content-type") || "video/mp4", "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
