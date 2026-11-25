import type { StoryDef } from "@/lib/types";

/** These files are generated once and shipped with the built-in books. */
const PAGE_COUNTS: Record<string, number> = {
  "noahs-ark": 6,
  "three-little-pigs": 5,
  "tortoise-and-hare": 5,
  "little-red-riding-hood": 5,
  "first-christmas": 6,
};

export function standardArtUrl(story: StoryDef, beatIndex: number): string | undefined {
  const count = PAGE_COUNTS[story.id];
  if (story.category === "custom" || count === undefined || !Number.isInteger(beatIndex) || beatIndex < 0 || beatIndex >= count) return;
  return `/story-art/${story.id}/beat-${beatIndex}.jpg`;
}

export function isStandardArtUrl(url: string): boolean {
  return Object.entries(PAGE_COUNTS).some(([id, count]) =>
    Array.from({ length: count }, (_, index) => `/story-art/${id}/beat-${index}.jpg`).includes(url));
}
