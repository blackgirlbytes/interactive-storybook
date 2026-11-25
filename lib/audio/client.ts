export async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return res.json();
}

import { TurnSchema, type Turn } from "@/lib/engine/schema";
import type { StreamedSegment, TurnEvent } from "@/lib/engine/streamSegments";
import { DEFAULT_LANGUAGE, listenParams, type LanguageCode } from "@/lib/languages";
import type { Mood } from "@/lib/audio/expression";

export type SpeechStyle = "story" | "clear";
/** Called on every animation frame while audio plays, with the playback position in seconds. */
export type OnTime = (seconds: number) => void;

export async function streamTurn(state: unknown, signal: AbortSignal, onSegment: (segment: StreamedSegment) => void): Promise<Turn> {
  const res = await fetch("/api/turn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state }), signal });
  if (!res.ok) throw new Error((await res.json()).error || "Couldn't turn the page.");
  if (!res.body) throw new Error("The story stream is missing.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let turn: Turn | undefined;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as TurnEvent;
    if (event.type === "error") throw new Error(event.error);
    if (event.type === "segment") onSegment(TurnSchema.shape.segments.element.parse(event));
    if (event.type === "turn") turn = TurnSchema.parse(event.turn);
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let end: number;
      while ((end = buffer.indexOf("\n")) !== -1) {
        consume(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
      }
      if (done) break;
    }
    consume(buffer);
    if (!turn) throw new Error("The story stopped before the page was complete.");
    return turn;
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function speechResponse(text: string, voice: string, signal: AbortSignal, style: SpeechStyle = "story", mood?: Mood): Promise<Response> {
  const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice, style, mood }), signal });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Couldn't load the voice.");
  }
  return res;
}

export async function speech(text: string, voice: string, signal: AbortSignal, style: SpeechStyle = "story", mood?: Mood): Promise<Blob> {
  return (await speechResponse(text, voice, signal, style, mood)).blob();
}

export interface SpeechAudio {
  blob: Promise<Blob>;
  play: (onTime?: OnTime) => Promise<void>;
}

/** Length of an audio recording in seconds, read from its metadata. */
export function audioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = "metadata";
    const done = (value?: number) => { URL.revokeObjectURL(url); audio.removeAttribute("src"); if (value) resolve(value); else reject(new Error("Unknown duration")); };
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? audio.duration : undefined);
    audio.onerror = () => done();
    audio.src = url;
  });
}

/** Reports playback position every frame until the returned stop function is called. */
function trackTime(audio: HTMLAudioElement, onTime?: OnTime): () => void {
  if (!onTime || typeof requestAnimationFrame === "undefined") return () => {};
  let frame = 0;
  const tick = () => { onTime(audio.currentTime); frame = requestAnimationFrame(tick); };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

/** Download once, play MP3 bytes immediately, and retain the complete recording for saves. */
export function speechAudio(text: string, voice: string, signal: AbortSignal, mood?: Mood): SpeechAudio {
  const response = speechResponse(text, voice, signal, "story", mood);
  const blob = response.then(res => res.clone().blob());
  void blob.catch(() => {});
  return {
    blob,
    async play(onTime?: OnTime) {
      if (typeof MediaSource === "undefined" || !MediaSource.isTypeSupported("audio/mpeg")) {
        return playBlob(await blob, signal, onTime);
      }
      return playStream(await response, signal, onTime);
    },
  };
}

function playStream(response: Response, signal: AbortSignal, onTime?: OnTime): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Stopped", "AbortError"));
    const source = new MediaSource();
    const url = URL.createObjectURL(source);
    const audio = new Audio(url);
    const reader = response.body!.getReader();
    const stopTracking = trackTime(audio, onTime);
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      stopTracking();
      signal.removeEventListener("abort", abort);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      void reader.cancel().catch(() => {});
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(new DOMException("Stopped", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    audio.onended = () => finish();
    audio.onerror = () => finish(new Error("Audio couldn't play. Tap Continue to try again."));
    source.addEventListener("sourceopen", async () => {
      try {
        if (settled) return;
        const buffer = source.addSourceBuffer("audio/mpeg");
        for (;;) {
          const { done, value } = await reader.read();
          if (settled) return;
          if (done) break;
          await new Promise<void>((yes, no) => {
            const cleanup = () => {
              buffer.removeEventListener("updateend", updated);
              buffer.removeEventListener("error", failed);
              signal.removeEventListener("abort", stopped);
            };
            const updated = () => { cleanup(); yes(); };
            const failed = () => { cleanup(); no(new Error("Couldn't decode voice audio.")); };
            const stopped = () => { cleanup(); no(new DOMException("Stopped", "AbortError")); };
            buffer.addEventListener("updateend", updated, { once: true });
            buffer.addEventListener("error", failed, { once: true });
            signal.addEventListener("abort", stopped, { once: true });
            buffer.appendBuffer(value);
          });
        }
        if (!settled && source.readyState === "open") source.endOfStream();
      } catch (error) { finish(error); }
    }, { once: true });
    void audio.play().catch(finish);
  });
}

export function playBlob(blob: Blob, signal: AbortSignal, onTime?: OnTime): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Stopped", "AbortError"));
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const stopTracking = trackTime(audio, onTime);
    const finish = (err?: unknown) => {
      stopTracking();
      audio.pause();
      audio.removeAttribute("src");
      URL.revokeObjectURL(url);
      signal.removeEventListener("abort", abort);
      if (err) reject(err); else resolve();
    };
    const abort = () => finish(new DOMException("Stopped", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    audio.onended = () => finish();
    audio.onerror = () => finish(new Error("Audio couldn't play. Tap Continue to try again."));
    audio.play().catch(finish);
  });
}

export class Microphone {
  constructor(private language: LanguageCode = DEFAULT_LANGUAGE) {}
  private stream?: MediaStream;
  private socket?: WebSocket;
  private recorder?: MediaRecorder;
  private stopped = false;
  /** True between Flux's StartOfTurn and EndOfTurn: the child is mid-idea. */
  private inTurn = false;
  /** The latest words heard in the turn in progress. */
  private turnText = "";
  /** Set while finish() waits for Flux to send the final words of the turn. */
  private ending?: (text: string) => void;
  /** Capture an EndOfTurn that arrives while the recorder is handing over its last chunk. */
  private draining = false;
  private finalDuringDrain = "";

  async start(onInterim: (text: string) => void, onFinal: (text: string) => void, onError: (message: string) => void, onSpeechStart?: () => void) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone needs HTTPS or localhost and a supported browser.");
    // Flux accepts Opus in WebM or Ogg containers; other recorder formats would be rejected.
    const mimeType = typeof MediaRecorder !== "undefined" && ["audio/webm;codecs=opus", "audio/ogg;codecs=opus"].find(t => MediaRecorder.isTypeSupported(t));
    if (!mimeType) throw new Error("This browser can’t stream microphone audio to the story. Try Chrome, Edge or Firefox.");
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (this.stopped) { this.stop(); return; }
    try {
      const { token } = await post<{ token: string }>("/api/deepgram-token", {});
      if (this.stopped) { this.stop(); return; }
      const params = listenParams(this.language);
      const socket = this.socket = new WebSocket(`wss://api.deepgram.com/v2/listen?${params}`, ["bearer", token]);
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Microphone connection timed out.")), 10000);
        socket.onopen = () => { clearTimeout(timeout); resolve(); };
        socket.onerror = () => { clearTimeout(timeout); reject(new Error("Couldn't connect to Deepgram.")); };
        socket.onclose = () => { clearTimeout(timeout); reject(new Error("Microphone connection closed.")); };
      });
      if (this.stopped) { this.stop(); return; }
      socket.onmessage = (event) => {
        const msg = JSON.parse(event.data) as { type?: string; event?: string; transcript?: string; description?: string };
        if (msg.type === "Error" || msg.type === "FatalError") {
          if (this.ending) { this.ending(this.turnText); return; }
          this.stop(); onError(`Microphone error: ${msg.description ?? "Deepgram stopped listening."}`); return;
        }
        // FORCE_END_TURN_NO_ACTIVE_TURN: the turn already ended, so there is nothing more to wait for.
        if (msg.type === "Warning") { this.ending?.(this.turnText); return; }
        if (msg.type !== "TurnInfo") return;
        const text = msg.transcript?.trim() ?? "";
        if (msg.event === "EndOfTurn") {
          if (this.draining && (text || this.turnText)) this.finalDuringDrain = text || this.turnText;
          this.inTurn = false; this.turnText = "";
          if (this.ending) this.ending(text);
          else if (text && !this.draining) onFinal(text);
          return;
        }
        this.inTurn = true;
        if (text) this.turnText = text;
        if (this.ending) return;
        if (msg.event === "StartOfTurn") onSpeechStart?.();
        if (text) onInterim(text);
      };
      socket.onclose = () => {
        if (this.ending) { this.ending(this.turnText); return; }
        if (!this.stopped) { this.stop(); onError("The microphone disconnected. Turn Play mode on again to reconnect."); } };
      socket.onerror = () => onError("Microphone connection error.");
      this.recorder = new MediaRecorder(this.stream, { mimeType });
      this.recorder.ondataavailable = e => { if (e.data.size && socket.readyState === WebSocket.OPEN) socket.send(e.data); };
      // Deepgram recommends roughly 80 ms of audio per message for Flux.
      this.recorder.start(80);
    } catch (err) { this.stop(); throw err; }
  }

  /**
   * Turns the microphone off without losing a half-finished idea. If the child is mid-turn,
   * sends the last audio, asks Flux to end the turn now (ForceEndTurn), and waits briefly for
   * the final transcript. CloseStream alone never ends the turn, so those words would be lost.
   * Resolves with the child's final words, or "" if they weren't speaking.
   */
  async finish(timeoutMs = 2000): Promise<string> {
    const socket = this.socket;
    if (this.stopped || !socket || socket.readyState !== WebSocket.OPEN) { this.stop(); return ""; }
    this.stopped = true;
    this.draining = true;
    const recorder = this.recorder;
    if (recorder?.state === "recording") {
      // The recorder hands over its last chunk just before it fires "stop".
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, 500);
        recorder.onstop = () => { clearTimeout(timer); resolve(); };
        recorder.stop();
      });
    }
    this.stream?.getTracks().forEach(t => t.stop());
    let text = this.finalDuringDrain;
    if (this.inTurn && socket.readyState === WebSocket.OPEN) {
      text = await new Promise<string>(resolve => {
        const timer = setTimeout(() => done(this.turnText), timeoutMs);
        const done = (words: string) => { clearTimeout(timer); this.ending = undefined; resolve(words); };
        this.ending = done;
        socket.send(JSON.stringify({ type: "ForceEndTurn" }));
      });
    }
    this.draining = false;
    this.stop();
    return text.trim();
  }

  stop() {
    this.stopped = true;
    if (this.recorder?.state === "recording") this.recorder.stop();
    this.stream?.getTracks().forEach(t => t.stop());
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: "CloseStream" }));
    this.socket?.close();
  }
}
const VIDEO_POLL_MS = 3000;
const VIDEO_TIMEOUT_MS = 5 * 60_000;

/** Turns a finished picture into a looping clip. Resolves undefined when clips are turned off. */
export async function animateScene(imageUrl: string, scene: string, motion: string | undefined, signal: AbortSignal): Promise<Blob | undefined> {
  const job = await post<{ id?: string; disabled?: boolean }>("/api/video", { imageUrl, scene, motion }, signal);
  if (job.disabled || !job.id) return undefined;
  const deadline = Date.now() + VIDEO_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, VIDEO_POLL_MS);
      signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Stopped", "AbortError")); }, { once: true });
    });
    const res = await fetch(`/api/video?id=${encodeURIComponent(job.id)}`, { signal });
    if (res.status === 202) continue;
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "The moving picture couldn’t be made.");
    }
    return res.blob();
  }
  throw new Error("The moving picture took too long.");
}
