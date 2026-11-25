"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { StoryDef } from "@/lib/types";
import { StorySession, type SessionView } from "@/lib/audio/session";
import { saveAdventure } from "@/lib/db";
import { initialState } from "@/lib/engine/reducer";
import Scene from "./Scene";
import BlobImage from "./BlobImage";
import BlobVideo from "./BlobVideo";
export default function StoryPlayer({ story }: { story: StoryDef }) {
  const session = useRef<StorySession | null>(null);
  const [view, setView] = useState<SessionView>(() => ({ state: initialState(story, "listen"), pages: [], status: "Ready when you are", error: "", listening: false, pauseMode: "none", imageBusy: false, videoBusy: false }));
  const latest = useRef(view);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { const s = new StorySession(story, next => { latest.current = next; setView(next); }, latest.current); session.current = s; const warmup = setTimeout(() => s.warmup(), 100); return () => { clearTimeout(warmup); s.close(); session.current = null; }; }, [story]);
  const page = view?.pages.at(-1);
  async function save() {
    if (!session.current) return;
    setSaving(true);
    try { const snapshot = await session.current.snapshot(); await saveAdventure({ ...snapshot, title: `${story.title} · My version` }); setNotice("Saved! Your original story is still on the shelf."); }
    catch { setNotice("Couldn’t save. Your browser may be out of storage or have storage disabled."); }
    finally { setSaving(false); }
  }
  return <main className="reader"><Link className="back-link" href="/">← Back to the story shelf</Link><div className="reader-heading"><div><p className="eyebrow">YOUR NEXT CHAPTER</p><h1>{story.title}</h1></div><button className="button secondary" disabled={!page || saving} onClick={save}>{saving ? "Saving the magic…" : "♡ Save this version"}</button></div><div className="reader-grid"><section className="picture-panel">{page?.image ? <BlobImage blob={page.image} alt={page.scene || story.setting}/> : <Scene kind={story.id}/>}{page?.video && <BlobVideo blob={page.video} label={page.scene || story.setting}/>}<span className="picture-caption">{view?.imageBusy ? "✧ The page is changing…" : view?.videoBusy && !page?.video ? "✧ The picture is coming to life…" : `Chapter ${(view?.state.beatIndex ?? 0) + 1} · ${story.beats[view?.state.beatIndex ?? 0]?.title}`}</span></section><section className="reading-panel"><div className="mode-switch"><button aria-pressed={view?.state.mode === "listen"} onClick={() => void session.current?.mode("listen")}>♫ Listen</button><button aria-pressed={view?.state.mode === "play"} onClick={() => void session.current?.mode("play")}>◉ Play & talk</button></div><p className={`status ${view?.listening ? "listening" : ""}`} role="status">{view?.listening && <span className="live-dot"/>}{view?.status ?? "Opening your story…"}</p><div className="narration" aria-live="polite">{page ? page.segments.map((s,i) => <div key={i}><span className="speaker">{s.speakerName}</span><p>{s.text}</p></div>) : <><h2>Once upon a time…</h2><p>{story.blurb}</p><p className="muted small">Choose Listen to sit back, or Play & talk to jump into the adventure. Headphones help the story hear just your voice.</p></>}</div><div className="playback-controls"><button className="button primary" onClick={() => void session.current?.resume()} disabled={view?.state.ended}>{view.pauseMode === "all" ? "Resume story & mic →" : page ? "Continue →" : "Begin the story →"}</button><button className="button secondary" onClick={() => session.current?.pauseNarrator()} disabled={view.pauseMode !== "none"}>Pause narrator</button>{view.state.mode === "play" && <button className="button secondary" onClick={() => session.current?.pauseAll()} disabled={view.pauseMode === "all"}>Pause everything</button>}</div>{view?.state.ended && <Link href="/" className="back-link">Find another adventure →</Link>}</section></div><div className="interaction-bar"><span className="mic-symbol">✧</span><form onSubmit={e => { e.preventDefault(); if (text.trim() && view.pauseMode !== "all") { void session.current?.turn(text.trim()); setText(""); } }}><label htmlFor="story-idea">{view.pauseMode === "all" ? "Story and microphone paused. Press Resume to continue." : view.listening ? "Your microphone is on. Jump in anytime!" : "A little idea can change everything."}</label><div className="input-row"><input id="story-idea" value={text} maxLength={600} disabled={view.pauseMode === "all"} onChange={e => setText(e.target.value)} placeholder='Try “The tortoise has roller skates!”'/><button type="submit" aria-label="Add your idea" disabled={!text.trim() || view.pauseMode === "all"}>↑</button></div></form><p>Talk to a character.<br/>Dream up a twist.<br/>Make it yours.</p></div>{view?.error && <p className="error" role="alert">{view.error}</p>}{notice && <p className="notice" role="status">{notice} <Link href="/adventures">My adventures →</Link></p>}<details className="transcript"><summary>Our adventure so far</summary>{view?.state.log.map((e,i) => <p key={i}><strong>{e.kind === "child" ? "You" : e.speaker}:</strong> {e.text}</p>)}</details></main>;
}
