import { TurnSchema, extractJson, type Turn } from "@/lib/engine/schema";
import { ENGINE_SYSTEM, buildEngineUser } from "@/lib/engine/prompts";
import { StoryStateSchema } from "@/lib/engine/stateSchema";
import { completedSegments, type TurnEvent } from "@/lib/engine/streamSegments";
import { chatStream } from "@/lib/server/fal";
import { generateValid } from "@/lib/server/generate";
import { errorResponse } from "@/lib/server/errors";
import type { StoryState } from "@/lib/types";

function parseTurn(raw: string): Turn | undefined {
  try {
    const parsed = TurnSchema.safeParse(extractJson(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsedState = StoryStateSchema.safeParse(body?.state);
    if (!parsedState.success) return Response.json({ error: "Invalid story state" }, { status: 400 });
    const state = parsedState.data as StoryState;
    const user = buildEngineUser(state);
    const upstream = new AbortController();
    const signal = AbortSignal.any([req.signal, upstream.signal]);
    const deltas = await chatStream(ENGINE_SYSTEM, user, signal);
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: TurnEvent) => { if (!signal.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); };
        let raw = "";
        let sent: { speaker: string; text: string }[] = [];
        try {
          for await (const delta of deltas) {
            raw += delta;
            const ready = completedSegments(raw);
            for (const seg of ready.slice(sent.length)) send({ type: "segment", ...seg });
            sent = ready.length > sent.length ? ready : sent;
          }
          let turn = parseTurn(raw);
          turn ??= await generateValid(TurnSchema, ENGINE_SYSTEM, user, signal);
          // Lines already streamed have been voiced, so they stay authoritative.
          if (sent.length) turn = { ...turn, segments: [...sent, ...turn.segments.slice(sent.length)].slice(0, 6) };
          send({ type: "turn", turn });
        } catch (err) {
          if (!signal.aborted) {
            console.error(err);
            send({ type: "error", error: err instanceof Error ? err.message : "The story engine stopped unexpectedly." });
          }
        } finally {
          try {
            controller.close();
          } catch {
            // Already closed because the client disconnected.
          }
        }
      },
      cancel() { upstream.abort(); },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
