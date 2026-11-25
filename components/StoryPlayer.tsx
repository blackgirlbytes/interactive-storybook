"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { StoryDef } from "@/lib/types";
import { StorySession, type SessionView } from "@/lib/audio/session";
import { saveAdventure } from "@/lib/db";
import { initialState } from "@/lib/engine/reducer";
import { savedLanguage, saveLanguage, storyLanguage, type LanguageCode } from "@/lib/languages";
import { localizeStory } from "@/lib/voices";
import Scene from "./Scene";
import BlobImage from "./BlobImage";
import BlobVideo from "./BlobVideo";
import ReadAlong from "./ReadAlong";
import PhonicsCard from "./PhonicsCard";
import LanguagePicker from "./LanguagePicker";

const freshView = (story: StoryDef): SessionView => ({ state: initialState(story, "listen"), pages: [], status: "Ready when you are", error: "", listening: false, pauseMode: "none", imageBusy: false, videoBusy: false });

/** `chooseLanguage` lets the reader pick the story language before it starts (classic stories). */
export default function StoryPlayer({ story: original, chooseLanguage = false }: { story: StoryDef; chooseLanguage?: boolean }) {
  const [language, setLanguage] = useState<LanguageCode>(() => storyLanguage(original));
  const [story, setStory] = useState(original);
  const session = useRef<StorySession | null>(null);
  const [view, setView] = useState<SessionView>(() => freshView(original));
  const latest = useRef(view);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [phonics, setPhonics] = useState(false);
  const [word, setWord] = useState<string>();
  function changeLanguage(code: LanguageCode) {
    const localized = localizeStory(original, code);
    latest.current = freshView(localized);
    setView(latest.current); setStory(localized); setLanguage(code);
  }
  // Classic stories open in the language the family picked last time.
  useEffect(() => {
    if (!chooseLanguage) return;
    const preferred = savedLanguage();
    if (preferred !== storyLanguage(original)) changeLanguage(preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original, chooseLanguage]);
  useEffect(() => { const s = new StorySession(story, next => { latest.current = next; setView(next); }, latest.current); session.current = s; const warmup = setTimeout(() => s.warmup(), 100); return () => { clearTimeout(warmup); s.close(); session.current = null; }; }, [story]);
  const page = view?.pages.at(-1);
  const started = view.pages.length > 0 || view.state.log.length > 0;
  async function save() {
    if (!session.current) return;
    setSaving(true);
    try { const snapshot = await session.current.snapshot(); await saveAdventure({ ...snapshot, title: `${story.title} · My version` }); setNotice("Saved! Your original story is still on the shelf."); }
    catch { setNotice("Couldn’t save. Your browser may be out of storage or have storage disabled."); }
    finally { setSaving(false); }
  }
  function soundOut(w: string) { session.current?.quiet(); setWord(w); }
  const reading = view.reading && view.reading.page === page ? view.reading : undefined;
  return <main className="reader"><Link className="back-link" href="/">← Back to the story shelf</Link><div className="reader-heading"><div><p className="eyebrow">YOUR NEXT CHAPTER</p><h1>{story.title}</h1></div><div className="reader-tools">{chooseLanguage && <LanguagePicker value={language} disabled={started} onChange={code => { saveLanguage(code); changeLanguage(code); }}/>}<button className="button secondary" disabled={!page || saving} onClick={save}>{saving ? "Saving the magic…" : "♡ Save this version"}</button></div></div><div className="reader-grid"><section className="picture-panel">{page?.image ? <BlobImage blob={page.image} alt={page.scene || story.setting}/> : <Scene kind={story.id}/>}{page?.video && <BlobVideo blob={page.video} label={page.scene || story.setting}/>}<span className="picture-caption">{view?.imageBusy ? "✧ The page is changing…" : view?.videoBusy && !page?.video ? "✧ The picture is coming to life…" : `Chapter ${(view?.state.beatIndex ?? 0) + 1} · ${story.beats[view?.state.beatIndex ?? 0]?.title}`}</span></section><section className="reading-panel"><div className="mode-switch"><button aria-pressed={view?.state.mode === "listen"} onClick={() => void session.current?.mode("listen")}>♫ Listen</button><button aria-pressed={view?.state.mode === "play"} onClick={() => void session.current?.mode("play")}>◉ Play & talk</button><button aria-pressed={phonics} onClick={() => { setPhonics(!phonics); setWord(undefined); }} title="Tap any word to hear it sounded out">Aa Phonics</button></div><p className={`status ${view?.listening ? "listening" : ""}`} role="status">{view?.listening && <span className="live-dot"/>}{phonics && !word ? "Phonics is on. Tap any word to sound it out." : view?.status ?? "Opening your story…"}</p>{word && <PhonicsCard key={word} word={word} language={language} voice={story.narratorVoice} onClose={() => setWord(undefined)}/>}<div className={`narration${phonics ? " phonics-on" : ""}`} aria-live="polite">{page ? <ReadAlong segments={page.segments} reading={reading} onWord={phonics ? soundOut : undefined}/> : <><h2>Once upon a time…</h2><p>{story.blurb}</p><p className="muted small">Choose Listen to sit back, or Play & talk to jump into the adventure. Headphones help the story hear just your voice.</p></>}</div><div className="playback-controls"><button className="button primary" onClick={() => { setWord(undefined); void session.current?.resume(); }} disabled={view?.state.ended}>{view.pauseMode === "all" ? "Resume story & mic →" : page ? "Continue →" : "Begin the story →"}</button><button className="button secondary" onClick={() => session.current?.pauseNarrator()} disabled={view.pauseMode !== "none"}>Pause narrator</button>{view.state.mode === "play" && <button className="button secondary" onClick={() => session.current?.pauseAll()} disabled={view.pauseMode === "all"}>Pause everything</button>}</div>{view?.state.ended && <Link href="/" className="back-link">Find another adventure →</Link>}</section></div><div className="interaction-bar"><span className="mic-symbol">✧</span><form onSubmit={e => { e.preventDefault(); if (text.trim() && view.pauseMode !== "all") { void session.current?.turn(text.trim()); setText(""); } }}><label htmlFor="story-idea">{view.pauseMode === "all" ? "Story and microphone paused. Press Resume to continue." : view.listening ? "Your microphone is on. Jump in anytime!" : "A little idea can change everything."}</label><div className="input-row"><input id="story-idea" value={text} maxLength={600} disabled={view.pauseMode === "all"} onChange={e => setText(e.target.value)} placeholder='Try “The tortoise has roller skates!”'/><button type="submit" aria-label="Add your idea" disabled={!text.trim() || view.pauseMode === "all"}>↑</button></div></form><p>Talk to a character.<br/>Dream up a twist.<br/>Make it yours.</p></div>{view?.error && <p className="error" role="alert">{view.error}</p>}{notice && <p className="notice" role="status">{notice} <Link href="/adventures">My adventures →</Link></p>}<details className="transcript"><summary>Our adventure so far</summary>{view?.state.log.map((e,i) => <p key={i}><strong>{e.kind === "child" ? "You" : e.speaker}:</strong> {e.text}</p>)}</details></main>;
}
