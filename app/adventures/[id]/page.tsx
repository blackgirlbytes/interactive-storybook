import { Suspense } from "react";
import Replay from "@/components/Replay";
async function Saved({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <Replay id={id}/>; }
export default function Page(props: { params: Promise<{ id: string }> }) { return <Suspense fallback={<main className="reader">Opening your adventure…</main>}><Saved {...props}/></Suspense>; }
