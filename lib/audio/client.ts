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

async function speechResponse(text: string, voice: string, signal: AbortSignal): Promise<Response> {
  const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }), signal });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Couldn't load the voice.");
  }
  return res;
}

export async function speech(text: string, voice: string, signal: AbortSignal): Promise<Blob> {
  return (await speechResponse(text, voice, signal)).blob();
}

export interface SpeechAudio {
  blob: Promise<Blob>;
  play: () => Promise<void>;
}

/** Download once, play MP3 bytes immediately, and retain the complete recording for saves. */
export function speechAudio(text: string, voice: string, signal: AbortSignal): SpeechAudio {
  const response = speechResponse(text, voice, signal);
  const blob = response.then(res => res.clone().blob());
  void blob.catch(() => {});
  return {
    blob,
    async play() {
      if (typeof MediaSource === "undefined" || !MediaSource.isTypeSupported("audio/mpeg")) {
        return playBlob(await blob, signal);
      }
      return playStream(await response, signal);
    },
  };
}

function playStream(response: Response, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Stopped", "AbortError"));
    const source = new MediaSource();
    const url = URL.createObjectURL(source);
    const audio = new Audio(url);
    const reader = response.body!.getReader();
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
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

export function playBlob(blob: Blob, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Stopped", "AbortError"));
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const finish = (err?: unknown) => {
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
  private stream?: MediaStream;
  private socket?: WebSocket;
  private recorder?: MediaRecorder;
  private keepalive?: ReturnType<typeof setInterval>;
  private stopped = false;

  async start(onInterim: (text: string) => void, onFinal: (text: string) => void, onError: (message: string) => void) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone needs HTTPS or localhost and a supported browser.");
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (this.stopped) { this.stop(); return; }
    try {
      const { token } = await post<{ token: string }>("/api/deepgram-token", {});
      if (this.stopped) { this.stop(); return; }
      const params = new URLSearchParams({ model: "nova-3", language: "en-US", interim_results: "true", smart_format: "true", endpointing: "350", utterance_end_ms: "1000", vad_events: "true" });
      const socket = this.socket = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ["bearer", token]);
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Microphone connection timed out.")), 10000);
        socket.onopen = () => { clearTimeout(timeout); resolve(); };
        socket.onerror = () => { clearTimeout(timeout); reject(new Error("Couldn't connect to Deepgram.")); };
        socket.onclose = () => { clearTimeout(timeout); reject(new Error("Microphone connection closed.")); };
      });
      if (this.stopped) { this.stop(); return; }
      let pending = "";
      const flush = () => { if (pending.trim()) onFinal(pending.trim()); pending = ""; };
      socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        const text = msg.channel?.alternatives?.[0]?.transcript;
        if (text) {
          onInterim(text);
          if (msg.is_final) pending += ` ${text}`;
        }
        if (msg.speech_final || msg.type === "UtteranceEnd") flush();
      };
      socket.onclose = () => { if (!this.stopped) { this.stop(); onError("The microphone disconnected. Turn Play mode on again to reconnect."); } };
      socket.onerror = () => onError("Microphone connection error.");
      const mimeType = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].find(t => MediaRecorder.isTypeSupported(t));
      this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
      this.recorder.ondataavailable = e => { if (e.data.size && socket.readyState === WebSocket.OPEN) socket.send(e.data); };
      this.recorder.start(100);
      this.keepalive = setInterval(() => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "KeepAlive" })); }, 5000);
    } catch (err) { this.stop(); throw err; }
  }

  stop() {
    this.stopped = true;
    clearInterval(this.keepalive);
    if (this.recorder?.state === "recording") this.recorder.stop();
    this.stream?.getTracks().forEach(t => t.stop());
    this.socket?.close();
  }
}
const VIDEO_POLL_MS = 3000;
const VIDEO_TIMEOUT_MS = 5 * 60_000;

/** Turns a finished picture into a looping clip. Resolves undefined when clips are turned off. */
export async function animateScene(imageUrl: string, scene: string, signal: AbortSignal): Promise<Blob | undefined> {
  const job = await post<{ id?: string; disabled?: boolean }>("/api/video", { imageUrl, scene }, signal);
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
