import { z } from "zod";
import { deepgramKey } from "@/lib/server/deepgram";
import { errorResponse } from "@/lib/server/errors";
import { normalizeVoice } from "@/lib/voices";

const Body = z.object({ text: z.string().trim().min(1).max(1500), voice: z.string() });

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    const model = parsed.success ? normalizeVoice(parsed.data.voice) : undefined;
    if (!parsed.success || !model) {
      return Response.json({ error: "Invalid text or voice" }, { status: 400 });
    }
    const { text } = parsed.data;
    const res = await fetch(`https://api.deepgram.com/v2/speak?model=${model}&encoding=mp3`, {
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
