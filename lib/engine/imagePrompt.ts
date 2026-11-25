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

export interface ImageReference {
  url: string;
  characters: string[];
}

export function charactersInScene(scene: string, characters: Pick<CharacterCard, "name" | "look">[]): string[] {
  const lower = scene.toLowerCase();
  return characters.filter(character => {
    const name = character.name.toLowerCase();
    const shortName = name.split(" ").find(word => word.length > 2 && !/^(the|big|bad|little|judge)$/.test(word));
    return lower.includes(name) || (!!shortName && new RegExp(`\\b${escape(shortName)}\\b`, "i").test(scene));
  }).map(character => character.name);
}

export function buildReferencePrompt(prompt: string, references: ImageReference[], characters: Pick<CharacterCard, "name" | "look">[]): string {
  const sources = references.map((reference, index) => reference.characters.length
    ? `Image ${index + 1} shows the established design of ${reference.characters.map(name => {
      const look = characters.find(character => character.name === name)?.look;
      return look ? `${name} (${look})` : name;
    }).join(" and ")}.`
    : `Image ${index + 1} is the previous story page and shows its art style.`);
  return `${sources.join(" ")} Draw a new picture for this moment: ${prompt} Preserve the established appearance of referenced characters, including their colors, clothing and distinctive features. Include only characters and objects called for in the new scene; do not copy the old composition.`;
}
