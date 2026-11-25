import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Microphone } from "@/lib/audio/client";
import { POST } from "@/app/api/tts/route";
import { DEFAULT_NARRATOR, FLUX_VOICES, normalizeVoice, pickUnusedVoice } from "@/lib/voices";

const fetchMock = vi.fn();
const stopTrack = vi.fn();
class Socket {
  static OPEN = 1;
  static latest: Socket;
  readyState = 1;
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: () => void;
  onerror?: () => void;
  send = vi.fn();
  close = vi.fn();
  constructor(public url: string, public protocols: string[]) {
    Socket.latest = this;
    queueMicrotask(() => this.onopen?.());
  }
  message(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) }); }
}
class Recorder {
  static latest: Recorder;
  static isTypeSupported = vi.fn(() => true);
  state = "inactive";
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  start = vi.fn(() => { this.state = "recording"; });
  stop = vi.fn(() => {
    this.state = "inactive";
    queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(["last audio"]) }); this.onstop?.(); });
  });
  constructor(public stream: unknown, public options: unknown) { Recorder.latest = this; }
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) } });
  vi.stubEnv("DEEPGRAM_API_KEY", "test-key");
  Recorder.isTypeSupported.mockReturnValue(true);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Flux voices", () => {
  it("supports Flux voices and migrates legacy voice names", () => {
    expect(FLUX_VOICES).toHaveLength(36);
    expect(normalizeVoice(" Hannah ")).toBe(DEFAULT_NARRATOR);
    expect(normalizeVoice("flux-kit-en")).toBe("flux-kit-en");
    expect(normalizeVoice("aura-2-athena-en")).toBe(DEFAULT_NARRATOR);
    expect(normalizeVoice("atlas")).toBe("flux-sean-en");
    expect(normalizeVoice("unknown")).toBeUndefined();
  });
  it("keeps new characters distinct from migrated voices", () => {
    expect(pickUnusedVoice(["aura-2-athena-en", "flux-kit-en"])).toBe("flux-alexis-en");
  });
});

describe("Flux TTS route", () => {
  it.each(["flux-hannah-en", "aura-2-athena-en"])("streams Flux MP3 for %s", async voice => {
    fetchMock.mockResolvedValue(new Response("audio"));
    const res = await POST(new Request("http://localhost/api/tts", { method: "POST", body: JSON.stringify({ text: "Once upon a time.", voice }) }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(await res.text()).toBe("audio");
    expect(fetchMock).toHaveBeenCalledWith("https://api.deepgram.com/v2/speak?model=flux-hannah-en&encoding=mp3&expressivity=1", expect.objectContaining({ body: JSON.stringify({ text: "Once upon a time." }) }));
  });
  it("rejects unsupported voices without contacting Deepgram", async () => {
    const res = await POST(new Request("http://localhost/api/tts", { method: "POST", body: JSON.stringify({ text: "Hello.", voice: "unknown" }) }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Flux microphone", () => {
  it("uses temporary-token auth and only submits completed turns", async () => {
    fetchMock.mockResolvedValue(Response.json({ token: "temporary-token" }));
    const interim = vi.fn(), final = vi.fn(), error = vi.fn(), speechStart = vi.fn();
    const mic = new Microphone();
    await mic.start(interim, final, error, speechStart);
    const socket = Socket.latest;
    expect(socket.url).toContain("/v2/listen?model=flux-general-en");
    expect(socket.protocols).toEqual(["bearer", "temporary-token"]);
    expect(Recorder.latest.options).toEqual({ mimeType: "audio/webm;codecs=opus" });
    expect(Recorder.latest.start).toHaveBeenCalledWith(80);
    const chunk = new Blob(["audio"]);
    Recorder.latest.ondataavailable?.({ data: chunk });
    expect(socket.send).toHaveBeenCalledWith(chunk);
    socket.message({ type: "TurnInfo", event: "StartOfTurn", transcript: "" });
    expect(speechStart).toHaveBeenCalledOnce();
    expect(interim).not.toHaveBeenCalled();
    socket.message({ type: "TurnInfo", event: "Update", transcript: "Um" });
    socket.message({ type: "TurnInfo", event: "Update", transcript: "Um, give the tortoise roller skates." });
    expect(interim).toHaveBeenCalledTimes(2);
    expect(final).not.toHaveBeenCalled();
    socket.message({ type: "TurnInfo", event: "EndOfTurn", transcript: "Give the tortoise roller skates." });
    expect(final).toHaveBeenCalledExactlyOnceWith("Give the tortoise roller skates.");
    socket.message({ type: "TurnInfo", event: "EndOfTurn", transcript: "" });
    expect(final).toHaveBeenCalledOnce();
    mic.stop();
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: "CloseStream" }));
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(error).not.toHaveBeenCalled();
  });
  it("keeps a half-finished idea when the microphone is turned off", async () => {
    fetchMock.mockResolvedValue(Response.json({ token: "temporary-token" }));
    const interim = vi.fn(), final = vi.fn(), error = vi.fn();
    const mic = new Microphone();
    await mic.start(interim, final, error);
    const socket = Socket.latest;
    socket.message({ type: "TurnInfo", event: "StartOfTurn", transcript: "" });
    socket.message({ type: "TurnInfo", event: "Update", transcript: "The tortoise has roller" });
    const finishing = mic.finish();
    await vi.waitFor(() => expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: "ForceEndTurn" })));
    const sent = socket.send.mock.calls.map(([data]) => data);
    // The recorder's last chunk goes out before Flux is told the turn is over.
    expect(sent.findIndex(d => d instanceof Blob)).toBeLessThan(sent.indexOf(JSON.stringify({ type: "ForceEndTurn" })));
    expect(socket.send).not.toHaveBeenCalledWith(JSON.stringify({ type: "CloseStream" }));
    socket.message({ type: "TurnInfo", event: "EndOfTurn", transcript: "The tortoise has roller skates.", trigger: "manual" });
    await expect(finishing).resolves.toBe("The tortoise has roller skates.");
    expect(socket.send).toHaveBeenLastCalledWith(JSON.stringify({ type: "CloseStream" }));
    expect(final).not.toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
  it("closes straight away when the child isn't speaking", async () => {
    fetchMock.mockResolvedValue(Response.json({ token: "temporary-token" }));
    const mic = new Microphone();
    await mic.start(vi.fn(), vi.fn(), vi.fn());
    const socket = Socket.latest;
    socket.message({ type: "TurnInfo", event: "Update", transcript: "Hello" });
    socket.message({ type: "TurnInfo", event: "EndOfTurn", transcript: "Hello" });
    await expect(mic.finish()).resolves.toBe("");
    expect(socket.send).not.toHaveBeenCalledWith(JSON.stringify({ type: "ForceEndTurn" }));
    expect(socket.send).toHaveBeenLastCalledWith(JSON.stringify({ type: "CloseStream" }));
  });
  it("falls back to the latest words if the final transcript doesn't arrive", async () => {
    fetchMock.mockResolvedValue(Response.json({ token: "temporary-token" }));
    const mic = new Microphone();
    await mic.start(vi.fn(), vi.fn(), vi.fn());
    Socket.latest.message({ type: "TurnInfo", event: "Update", transcript: "A purple dragon" });
    await expect(mic.finish(20)).resolves.toBe("A purple dragon");
    expect(Socket.latest.close).toHaveBeenCalled();
  });
  it("cleans up the microphone on a provider error", async () => {
    fetchMock.mockResolvedValue(Response.json({ token: "temporary-token" }));
    const error = vi.fn();
    const mic = new Microphone();
    await mic.start(vi.fn(), vi.fn(), error);
    Socket.latest.message({ type: "Error", description: "Audio rejected" });
    expect(error).toHaveBeenCalledWith("Microphone error: Audio rejected");
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(Recorder.latest.stop).toHaveBeenCalledOnce();
  });
  it("explains unsupported audio formats before requesting microphone access", async () => {
    Recorder.isTypeSupported.mockReturnValue(false);
    await expect(new Microphone().start(vi.fn(), vi.fn(), vi.fn())).rejects.toThrow("Try Chrome");
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });
});
