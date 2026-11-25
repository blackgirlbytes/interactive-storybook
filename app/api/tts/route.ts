import { z } from "zod";
import { deepgramKey } from "@/lib/server/deepgram";
import { errorResponse } from "@/lib/server/errors";
import { isAllowedVoice, normalizeVoice } from "@/lib/voices";
import { expressivityFor, MOODS, stripControls, withStoryPauses } from "@/lib/audio/expression";

const Body = z.object({
  text: z.string().trim().min(1).max(1500),
  voice: z.string(),
  /** "story" reads with extra feeling; "clear" is the voice's neutral delivery, for phonics. */
  style: z.enum(["story", "clear"]).default("story"),
  /** How the line is performed; shifts the story expressivity up or down. Unknown moods are ignored. */
  mood: z.enum(MOODS).optional().catch(undefined),
});

/**
 * Flux TTS expressivity runs -2 (calm) to 2 (animated); it is in beta and 0 is the only
 * production-validated value. Storybook reading defaults to 1 for a livelier performance, and each
 * line's mood shifts from there (hushed lines go calm and soft, excited lines fully animated).
 * DEEPGRAM_TTS_EXPRESSIVITY sets that baseline; 0 makes ordinary lines use the voice's default.
 */
function storyExpressivity(): number {
  const value = Number(process.env.DEEPGRAM_TTS_EXPRESSIVITY ?? 1);
  return Number.isInteger(value) && value >= -2 && value <= 2 ? value : 1;
}

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    const voice = parsed.success ? parsed.data.voice.trim().toLowerCase() : "";
    // Any supported language's Flux voice is accepted; bare and legacy names are English.
    const model = isAllowedVoice(voice) ? voice : normalizeVoice(voice);
    if (!parsed.success || !model) {
      return Response.json({ error: "Invalid text or voice" }, { status: 400 });
    }
    const { style, mood } = parsed.data;
    const story = style === "story";
    // Inline pauses are English-only on Flux TTS; other languages reject any inline control.
    const text = story && model.endsWith("-en") ? withStoryPauses(parsed.data.text) : stripControls(parsed.data.text);
    if (!text.trim()) return Response.json({ error: "Invalid text or voice" }, { status: 400 });
    const params = new URLSearchParams({ model, encoding: "mp3" });
    const expressivity = story ? expressivityFor(storyExpressivity(), mood) : 0;
    if (expressivity) params.set("expressivity", String(expressivity));
    const res = await fetch(`https://api.deepgram.com/v2/speak?${params}`, {
      method: "POST",
      signal: req.signal,
      headers: { Authorization: `Token ${deepgramKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Deepgram TTS error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
