import "server-only";
import { ConfigError } from "@/lib/server/fal";

export function errorResponse(err: unknown): Response {
  if (err instanceof ConfigError) return Response.json({ error: err.message, config: true }, { status: 500 });
  if (err instanceof Error && err.name === "AbortError") return new Response(null, { status: 499 });
  console.error(err);
  const message = err instanceof Error ? err.message : "Unknown error";
  return Response.json({ error: message }, { status: 502 });
}
