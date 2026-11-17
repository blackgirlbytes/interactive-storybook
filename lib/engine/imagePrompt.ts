import type { CharacterCard } from "@/lib/types";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Image models tend to paint character names as visible labels, so names in the
 * scene are swapped for their visual descriptions before the prompt is sent.
 */
export function buildImagePrompt(scene: string, artStyle: string, characters: Pick<CharacterCard, "name" | "look">[]): string {
  let described = scene.trim();
  const byLength = [...characters].sort((a, b) => b.name.length - a.name.length);
  for (const c of byLength) {
    const pattern = new RegExp(`\\b${escape(c.name)}\\b(,\\s*${escape(c.look)},?)?`, "gi");
    described = described.replace(pattern, c.look);
  }
  for (const c of byLength) {
    const first = c.name.split(" ").find((w) => w.length > 2 && !/^(the|big|bad|little|judge)$/i.test(w));
    if (first) described = described.replace(new RegExp(`\\b${escape(first)}\\b`, "g"), c.look);
  }
  return `${artStyle}. Scene: ${described}. Absolutely no words, letters, names, labels, captions or signatures anywhere in the picture.`;
}
