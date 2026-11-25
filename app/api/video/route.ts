import { z } from "zod";
import { buildVideoInput } from "@/lib/engine/videoPrompt";
import { falQueueResult, falQueueStatus, falQueueSubmit, VIDEO_MODEL } from "@/lib/server/fal";
import { errorResponse } from "@/lib/server/errors";

const Body = z.object({ imageUrl: z.string().min(1).max(2000), scene: z.string().trim().min(1).max(800), motion: z.string().trim().max(300).optional() });
const FAL_MEDIA_HOST = /(^|\.)fal\.media$/;
const REQUEST_ID = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request) {
  try {
    if (!VIDEO_MODEL) return Response.json({ disabled: true });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: "Invalid video request" }, { status: 400 });
    }
    const { imageUrl, scene, motion } = parsed.data;
    let falMedia = false;
    try {
      const remote = new URL(imageUrl);
      falMedia = remote.protocol === "https:" && FAL_MEDIA_HOST.test(remote.hostname);
    } catch { /* Only generated fal images can be submitted for video. */ }
    if (!falMedia) return Response.json({ error: "Invalid video request" }, { status: 400 });
    const id = await falQueueSubmit(VIDEO_MODEL, buildVideoInput(imageUrl, scene, motion), req.signal);
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
