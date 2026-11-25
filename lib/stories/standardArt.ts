import type { StoryDef } from "@/lib/types";
import { CLASSIC_STORIES } from "@/lib/stories";

/** These files are generated once and shipped with the built-in books. */
const PAGE_COUNTS = new Map(CLASSIC_STORIES.map(story => [story.id, story.beats.length]));
const STANDARD_ART_URLS = new Set(CLASSIC_STORIES.flatMap(story =>
  story.beats.map((_, index) => `/story-art/${story.id}/beat-${index}.jpg`)));

export function standardArtUrl(story: StoryDef, beatIndex: number): string | undefined {
  const count = PAGE_COUNTS.get(story.id);
  if (story.category === "custom" || count === undefined || !Number.isInteger(beatIndex) || beatIndex < 0 || beatIndex >= count) return;
  return `/story-art/${story.id}/beat-${beatIndex}.jpg`;
}

export function isStandardArtUrl(url: string): boolean {
  return STANDARD_ART_URLS.has(url);
}

export function standardVideoUrl(imageUrl: string): string | undefined {
  if (!isStandardArtUrl(imageUrl)) return;
  return imageUrl.replace("/story-art/", "/story-video/").replace(/\.jpg$/, ".mp4");
}
