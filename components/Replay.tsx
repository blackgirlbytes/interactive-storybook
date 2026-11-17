"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getAdventure, type Adventure } from "@/lib/db";
import { playBlob } from "@/lib/audio/client";
import BlobImage from "./BlobImage";
import BlobVideo from "./BlobVideo";
import Scene from "./Scene";
export default function Replay({ id }: { id: string }) {
  const [adventure,setAdventure] = useState<Adventure>();
  const [error,setError] = useState("");
  const [index,setIndex] = useState(0);
  const [playing,setPlaying] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    getAdventure(id).then(a => { if (active) { if (a) setAdventure(a); else setError("This adventure isn’t on this browser’s shelf."); } }).catch(() => { if (active) setError("Couldn’t open this saved adventure."); });
    return () => { active = false; controller.current?.abort(); };
  }, [id]);
  function pause() { controller.current?.abort(); setPlaying(false); }
  async function play() {
    if (!adventure) return;
    pause(); const c = controller.current = new AbortController(); setPlaying(true); setError("");
    try {
      for (let p = index; p < adventure.pages.length; p++) {
        setIndex(p);
        for (const audio of adventure.pages[p].audio) if (audio) await playBlob(audio,c.signal);
        if (!adventure.pages[p].audio.length) { setError("No audio was saved for this page. You can still read it."); break; }
      }
    } catch (e) { if (!c.signal.aborted) setError((e as Error).message); }
    finally { if (!c.signal.aborted) setPlaying(false); }
  }
  const page = adventure?.pages[index];
  return <main className="reader"><Link className="back-link" href="/adventures">← My adventures</Link><h1>{adventure?.title || "Your saved adventure"}</h1>{page && <><div className="reader-grid"><section className="picture-panel">{page.image ? <BlobImage blob={page.image} alt={page.scene || adventure!.story.setting}/> : <Scene kind={adventure!.story.id}/>}{page.video && <BlobVideo blob={page.video} label={page.scene || adventure!.story.setting}/>}<span className="picture-caption">Page {index+1} of {adventure!.pages.length}</span></section><section className="reading-panel"><p className="eyebrow">JUST HOW YOU IMAGINED IT</p><div className="narration">{page.segments.map((s,i) => <div key={i}><span className="speaker">{s.speakerName}</span><p>{s.text}</p></div>)}</div><div className="playback-controls"><button className="button primary" onClick={() => playing ? pause() : void play()}>{playing ? "Pause" : "♫ Replay narration"}</button><button className="button secondary" disabled={index === 0} onClick={() => { pause(); setIndex(index-1); }}>←</button><button className="button secondary" disabled={index >= adventure!.pages.length-1} onClick={() => { pause(); setIndex(index+1); }}>→</button></div></section></div><p className="storage-note">Your saved version. Replaying doesn’t use the microphone or call the AI services.</p></>}{error && <p className="error" role="alert">{error}</p>}</main>;
}
