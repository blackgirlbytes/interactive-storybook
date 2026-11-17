import "server-only";
import type { ZodType } from "zod";
import { extractJson } from "@/lib/engine/schema";
import { chatJSON } from "@/lib/server/fal";

export async function generateValid<T>(schema: ZodType<T>, system: string, user: string, signal: AbortSignal): Promise<T> {
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const retryNote = attempt
      ? `Your previous reply was invalid (${lastError}). Reply again with ONLY a valid JSON object in the required shape.`
      : undefined;
    const raw = await chatJSON(system, user, signal, retryNote);
    try {
      const parsed = schema.safeParse(extractJson(raw));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (e) {
      lastError = e instanceof Error ? e.message : "unparseable JSON";
    }
  }
  throw new Error(`Story engine returned invalid output: ${lastError}`);
}
