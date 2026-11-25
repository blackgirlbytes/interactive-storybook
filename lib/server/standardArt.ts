import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isStandardArtUrl } from "@/lib/stories/standardArt";

/** Read a shipped illustration for fal without depending on fal's temporary CDN URL. */
export async function standardArtDataUri(url: string): Promise<string> {
  if (!isStandardArtUrl(url)) throw new Error("Unknown standard illustration");
  const bytes = await readFile(join(process.cwd(), "public", url.slice(1)));
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}
