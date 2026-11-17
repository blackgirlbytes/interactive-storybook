import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getClassicStory } from "@/lib/stories";
import StoryPlayer from "@/components/StoryPlayer";
async function Story({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = getClassicStory(id);
  if (!story) notFound();
  return <StoryPlayer story={story}/>;
}
export default function Page(props: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<main className="reader">Opening your story…</main>}><Story {...props}/></Suspense>;
}
