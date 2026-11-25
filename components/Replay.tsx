"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getAdventure, type Adventure } from "@/lib/db";
import { audioDuration, playBlob } from "@/lib/audio/client";
import { storyLanguage } from "@/lib/languages";
import { WordClock } from "@/lib/text/wordClock";
import ReadAlong from "./ReadAlong";
import PhonicsCard from "./PhonicsCard";
import BlobImage from "./BlobImage";
import BlobVideo from "./BlobVideo";
import Scene from "./Scene";
import StandardArt from "./StandardArt";
export default function Replay({ id }: { id: string }) {
  const [adventure,setAdventure] = useState<Adventure>();
  const [error,setError] = useState("");
  const [index,setIndex] = useState(0);
  const [playing,setPlaying] = useState(false);
  const [reading,setReading] = useState<{ segment: number; word: number }>();
  const [phonics,setPhonics] = useState(false);
  const [word,setWord] = useState<string>();
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    getAdventure(id).then(a => { if (active) { if (a) setAdventure(a); else setError("This adventure isn’t on this browser’s shelf."); } }).catch(() => { if (active) setError("Couldn’t open this saved adventure."); });
    return () => { active = false; controller.current?.abort(); };
  }, [id]);
  function pause() { controller.current?.abort(); setPlaying(false); setReading(undefined); }
  async function play() {
    if (!adventure) return;
    setWord(undefined);
    pause(); const c = controller.current = new AbortController(); setPlaying(true); setError("");
    try {
      for (let p = index; p < adventure.pages.length; p++) {
        setIndex(p);
        const { segments, audio } = adventure.pages[p];
        for (let i = 0; i < audio.length; i++) {
          if (!audio[i]) continue;
          const clock = new WordClock(segments[i]?.text ?? "");
          clock.duration = await audioDuration(audio[i]).catch(() => undefined);
          await playBlob(audio[i], c.signal, t => { const w = clock.wordAt(t); setReading(r => r?.segment === i && r.word === w ? r : { segment: i, word: w }); });
        }
        setReading(undefined);
        if (!adventure.pages[p].audio.length) { setError("No audio was saved for this page. You can still read it."); break; }
      }
    } catch (e) { if (!c.signal.aborted) setError((e as Error).message); }
    finally { if (!c.signal.aborted) setPlaying(false); }
  }
  const page = adventure?.pages[index];
  return <main className="reader"><Link className="back-link" href="/adventures">← My adventures</Link><h1>{adventure?.title || "Your saved adventure"}</h1>{page && <><div className="reader-grid"><section className="picture-panel">{page.image ? <BlobImage blob={page.image} alt={page.scene || adventure!.story.setting}/> : page.standardArtUrl ? <StandardArt src={page.standardArtUrl} alt={page.scene || adventure!.story.setting}/> : <Scene kind={adventure!.story.id}/>}{page.video && <BlobVideo blob={page.video} label={page.scene || adventure!.story.setting}/>}<span className="picture-caption">Page {index+1} of {adventure!.pages.length}</span></section><section className="reading-panel"><p className="eyebrow">JUST HOW YOU IMAGINED IT</p>{word && <PhonicsCard key={word} word={word} language={storyLanguage(adventure!.story)} voice={adventure!.story.narratorVoice} onClose={() => setWord(undefined)}/>}<div className={`narration${phonics ? " phonics-on" : ""}`}><ReadAlong segments={page.segments} reading={playing ? reading : undefined} onWord={phonics ? w => { pause(); setWord(w); } : undefined}/></div><div className="playback-controls"><button className="button primary" onClick={() => playing ? pause() : void play()}>{playing ? "Pause" : "♫ Replay narration"}</button><button className="button secondary" aria-pressed={phonics} onClick={() => { setPhonics(!phonics); setWord(undefined); }}>Aa Phonics</button><button className="button secondary" disabled={index === 0} onClick={() => { pause(); setIndex(index-1); }}>←</button><button className="button secondary" disabled={index >= adventure!.pages.length-1} onClick={() => { pause(); setIndex(index+1); }}>→</button></div></section></div><p className="storage-note">Your saved version. Replaying doesn’t use the microphone or call the AI services.</p></>}{error && <p className="error" role="alert">{error}</p>}</main>;
}
