import { z } from "zod";
import { CreateReplySchema } from "@/lib/engine/schema";
import { CREATE_SYSTEM, buildCreateUser } from "@/lib/engine/prompts";
import { errorResponse } from "@/lib/server/errors";
import { generateValid } from "@/lib/server/generate";

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["guide", "child"]), text: z.string().max(1000) })).max(30),
});

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
    const reply = await generateValid(CreateReplySchema, CREATE_SYSTEM, buildCreateUser(parsed.data.messages), req.signal);
    return Response.json(reply);
  } catch (err) {
    return errorResponse(err);
  }
}
