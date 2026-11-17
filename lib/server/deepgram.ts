import "server-only";
import { ConfigError } from "@/lib/server/fal";

export function deepgramKey(): string {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new ConfigError("DEEPGRAM_API_KEY is not set. Add it to .env.local.");
  return key;
}
