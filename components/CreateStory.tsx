"use client";
import { useEffect, useRef, useState } from "react";
import { CreateReplySchema } from "@/lib/engine/schema";
import { post, speech, playBlob, Microphone } from "@/lib/audio/client";
import { narratorFor, normalizeVoice, pickUnusedVoice } from "@/lib/voices";
import { GREETINGS, savedLanguage, saveLanguage, type LanguageCode } from "@/lib/languages";
import LanguagePicker from "./LanguagePicker";
import { ART_STYLE } from "@/lib/stories";
import { slugify } from "@/lib/engine/reducer";
import type { StoryDef } from "@/lib/types";
import StoryPlayer from "./StoryPlayer";
import { isLikelyEcho } from "@/lib/engine/echo";
type Message = { role: "guide" | "child"; text: string };
export default function CreateStory() {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [messages, setMessages] = useState<Message[]>([{ role: "guide", text: GREETINGS.en }]);
  const messagesRef = useRef(messages);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [story, setStory] = useState<StoryDef>();
  const controller = useRef<AbortController | null>(null);
  const microphone = useRef<Microphone | null>(null);
  const recentSpeech = useRef({ text: "", until: 0 });
  useEffect(() => () => { controller.current?.abort(); microphone.current?.stop(); }, []);
  function chooseLanguage(code: LanguageCode) {
    microphone.current?.stop(); setListening(false);
    const greeting: Message[] = [{ role: "guide", text: GREETINGS[code] }];
    messagesRef.current = greeting; setMessages(greeting); setLanguage(code);
  }
  // Start in the language the family picked last time.
  useEffect(() => {
    const preferred = savedLanguage();
    // localStorage is only readable after hydration, so the saved choice is applied here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (preferred !== "en") chooseLanguage(preferred);
  }, []);
  const started = messages.some(m => m.role === "child");
  async function send(text: string) {
    if (!text.trim()) return;
    controller.current?.abort();
    const c = controller.current = new AbortController();
    const next: Message[] = [...messagesRef.current, { role: "child", text: text.trim().slice(0,1000) }];
    messagesRef.current = next; setMessages(next); setText(""); setBusy(true); setError("");
    try {
      const reply = CreateReplySchema.parse(await post("/api/create", { messages: next, language }, c.signal));
      if (c.signal.aborted) return;
      const updated: Message[] = [...next, { role: "guide", text: reply.say }];
      messagesRef.current = updated; setMessages(updated);
      if (reply.done && reply.story) {
        const draft = reply.story;
        const narrator = narratorFor(language);
        const used = [narrator];
        const ids = new Set<string>();
        const characters = draft.characters.map(ch => {
          const requested = normalizeVoice(ch.voice, language);
          const voice = requested && !used.includes(requested) ? requested : pickUnusedVoice(used, language);
          used.push(voice);
          let id = slugify(ch.name); while (ids.has(id)) id += "-2"; ids.add(id);
          return { ...ch, voice, id, invented: true };
        });
        microphone.current?.stop(); setListening(false);
        setStory({ ...draft, emoji: draft.emoji || "✧", id: `custom-${crypto.randomUUID()}`, category: "custom", narratorVoice: narrator, artStyle: ART_STYLE, characters, language });
      } else {
        try {
          const audio = await speech(reply.say, narratorFor(language), c.signal);
          recentSpeech.current = { text: reply.say, until: Date.now() + reply.say.length * 100 + 2000 };
          await playBlob(audio, c.signal);
        }
        catch (e) { if ((e as Error).name !== "AbortError") setError(`Voice unavailable. You can keep typing. ${(e as Error).message}`); }
      }
    } catch (e) { if (!c.signal.aborted) setError((e as Error).message); }
    finally { if (!c.signal.aborted) setBusy(false); }
  }
  async function toggleMic() {
    if (listening) { microphone.current?.stop(); setListening(false); return; }
    const mic = microphone.current = new Microphone(language);
    try {
      const echo = (t: string) => Date.now() < recentSpeech.current.until && isLikelyEcho(t, recentSpeech.current.text);
      await mic.start(t => { if (!echo(t)) controller.current?.abort(); }, t => { if (!echo(t)) void send(t); }, msg => { setError(msg); setListening(false); });
      if (microphone.current === mic) setListening(true);
    } catch (e) { setError((e as Error).message); }
  }
  if (story) return <StoryPlayer story={story}/>;
  return <main className="creator"><p className="eyebrow">A BLANK PAGE. A BIG IMAGINATION.</p><h1>Let’s dream up <em>something new.</em></h1><p className="muted">A few little ideas are all we need to begin.</p><section className="chat-card"><LanguagePicker value={language} disabled={started || busy} onChange={code => { saveLanguage(code); chooseLanguage(code); }}/><div className="guide-emblem">✧</div><div className="chat-history" aria-live="polite">{messages.map((m,i) => <div className={`chat-message ${m.role}`} key={i}><span className="speaker">{m.role === "guide" ? "Your story guide" : "You"}</span><p>{m.text}</p></div>)}</div>{busy && <p role="status">Dreaming up the next question…</p>}<form onSubmit={e => { e.preventDefault(); void send(text); }}><label htmlFor="create-answer" className="small">Your next idea</label><div className="input-row"><input id="create-answer" value={text} maxLength={1000} onChange={e => setText(e.target.value)} placeholder="A little dragon who’s afraid of heights…" disabled={busy}/><button disabled={busy || !text.trim()} aria-label="Send your idea">↑</button></div></form><button className={`button ${listening ? "primary" : "secondary"}`} onClick={() => void toggleMic()}>{listening ? "◉ Listening · turn microphone off" : "◉ Use my voice instead"}</button><p className="small muted">Headphones recommended. Use pretend names, not personal details.</p>{error && <p className="error" role="alert">{error}</p>}</section></main>;
}
