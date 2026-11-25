"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LanguageCode } from "@/lib/languages";
import type { Phonics } from "@/lib/phonics/schema";
import { soundOut, splitWord, type PhonicsStep } from "@/lib/phonics/client";

interface Props {
  word: string;
  language: LanguageCode;
  voice: string;
  onClose: () => void;
}

/** Shows a tapped word (render with key={word} so each word starts fresh) split into its sounds and says each one, lighting it up, before blending them. */
export default function PhonicsCard({ word, language, voice, onClose }: Props) {
  const [phonics, setPhonics] = useState<Phonics>();
  const [step, setStep] = useState<PhonicsStep>({ kind: "word" });
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);

  const play = useCallback(async (split: Phonics) => {
    controller.current?.abort();
    const c = controller.current = new AbortController();
    setError("");
    try { await soundOut(word, split, voice, c.signal, setStep); }
    catch { if (!c.signal.aborted) { setError("Couldn’t sound that word out. Try again?"); setStep({ kind: "done" }); } }
  }, [word, voice]);

  useEffect(() => {
    let active = true;
    void splitWord(word, language).then(split => { if (active) { setPhonics(split); void play(split); } });
    return () => { active = false; controller.current?.abort(); };
  }, [word, language, play]);

  const lit = (i: number) => step.kind === "blend" || step.kind === "word" || (step.kind === "part" && step.index === i);
  return <section className="phonics-card" aria-live="polite">
    <p className="eyebrow">LET’S SOUND IT OUT</p>
    <div className="phonics-parts">
      {phonics ? phonics.parts.map((p, i) => <span key={i} className={`phonics-part${lit(i) ? " lit" : ""}`}>{p.letters}</span>)
        : <span className="phonics-part lit">{word}</span>}
    </div>
    <div className="phonics-actions">
      <button className="button primary" disabled={!phonics || step.kind !== "done"} onClick={() => phonics && void play(phonics)}>♫ Hear it again</button>
      <button className="button secondary" onClick={onClose}>Back to the story</button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
