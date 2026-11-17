import { deepgramKey } from "@/lib/server/deepgram";
import { errorResponse } from "@/lib/server/errors";

export async function POST() {
  try {
    const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: { Authorization: `Token ${deepgramKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl_seconds: 60 }),
    });
    if (!res.ok) throw new Error(`Deepgram token error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { access_token: string; expires_in?: number };
    return Response.json({ token: data.access_token, expiresIn: data.expires_in ?? 60 }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
