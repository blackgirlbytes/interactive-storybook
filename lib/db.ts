import { openDB, type DBSchema } from "idb";
import type { SpokenSegment, StoryDef, StoryState } from "@/lib/types";

export interface AdventurePage {
  segments: SpokenSegment[];
  audio: Blob[];
  image?: Blob;
  video?: Blob;
  scene?: string;
}
export interface Adventure {
  id: string;
  title: string;
  createdAt: number;
  story: StoryDef;
  state: StoryState;
  pages: AdventurePage[];
}
interface Shelf extends DBSchema {
  adventures: { key: string; value: Adventure };
}
const db = () => openDB<Shelf>("onceupon", 1, { upgrade(db) { db.createObjectStore("adventures", { keyPath: "id" }); } });
export async function saveAdventure(adventure: Omit<Adventure, "id" | "createdAt">) {
  const copy = { ...adventure, id: crypto.randomUUID(), createdAt: Date.now() };
  await (await db()).put("adventures", copy);
  return copy.id;
}
export async function listAdventures() { return (await (await db()).getAll("adventures")).sort((a,b) => b.createdAt - a.createdAt); }
export async function getAdventure(id: string) { return (await db()).get("adventures", id); }
