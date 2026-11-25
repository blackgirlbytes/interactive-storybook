import type { Mode, StoryDef, StoryState } from "@/lib/types";
import { initialState, applyTurn, addChildUtterance, findCharacter } from "@/lib/engine/reducer";
import { TurnSchema, type Turn } from "@/lib/engine/schema";
import type { StreamedSegment } from "@/lib/engine/streamSegments";
import { animateScene, audioDuration, Microphone, playBlob, post, speech, speechAudio, streamTurn, type OnTime, type SpeechAudio } from "./client";
import { storyLanguage } from "@/lib/languages";
import { WordClock } from "@/lib/text/wordClock";
import type { AdventurePage } from "@/lib/db";
import { isLikelyEcho } from "@/lib/engine/echo";
import { standardArtUrl } from "@/lib/stories/standardArt";
import { charactersInScene, type ImageReference } from "@/lib/engine/imagePrompt";

const CHILD_REPLY_WAIT_MS = 8000;
const AUTO_CONTINUE_MS = 500;

export interface SessionView {
  state: StoryState;
  pages: AdventurePage[];
  status: string;
  error: string;
  listening: boolean;
  micPaused: boolean;
  pauseMode: "none" | "narrator" | "all";
  imageBusy: boolean;
  videoBusy: boolean;
  /** The word being read aloud right now, for read-along highlighting. */
  reading?: ReadingPosition;
}
export interface ReadingPosition {
  page: AdventurePage;
  segment: number;
  word: number;
}
interface PreparedTurn {
  state: StoryState;
  controller: AbortController;
  segments: StreamedSegment[];
  audio: (SpeechAudio | undefined)[];
  done: Promise<Turn>;
  notify?: () => void;
}
interface ActiveNarration {
  base: StoryState;
  page: AdventurePage;
  heardCount: number;
  referenceUrl?: string;
}
export class StorySession {
  view: SessionView;
  private controller?: AbortController;
  private mic?: Microphone;
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private awaitingChild = false;
  private referenceUrl?: string;
  private customized = false;
  private characterReferences = new Map<string, { url: string; page: AdventurePage }>();
  private imageJobs = new Set<Promise<void>>();
  private imageControllers = new Set<AbortController>();
  private videoJobs = 0;
  private closed = false;
  private paused = true;
  private pendingPage?: AdventurePage;
  private activeNarration?: ActiveNarration;
  private abandonedPages = new WeakSet<AdventurePage>();
  private recentlySpoken = "";
  private spokenAt = 0;
  private snapshotting = false;
  /** Set while a closing microphone is still handing over the child's last words. */
  private lastWords?: Promise<void>;
  private prefetched?: PreparedTurn;
  constructor(story: StoryDef, private update: (view: SessionView) => void, restored?: SessionView) {
    this.view = restored ? { ...restored, reading: undefined, listening: false, micPaused: false, pauseMode: "none", imageBusy: false, videoBusy: false } : { state: initialState(story, "listen"), pages: [], status: "Ready when you are", error: "", listening: false, micPaused: false, pauseMode: "none", imageBusy: false, videoBusy: false };
  }
  private emit() { if (!this.closed) this.update({ ...this.view, pages: [...this.view.pages] }); }
  warmup() {
    if (!this.closed && !this.prefetched && !this.view.state.ended) {
      this.prefetched = this.prepare(this.view.state);
    }
  }
  private discardPrefetch() { this.prefetched?.controller.abort(); this.prefetched = undefined; }
  private prepare(state: StoryState): PreparedTurn {
    const controller = new AbortController();
    const prepared: PreparedTurn = { state, controller, segments: [], audio: [], done: undefined! };
    prepared.done = streamTurn(state, controller.signal, segment => {
      if (controller.signal.aborted) return;
      prepared.segments.push(segment);
      const character = findCharacter(state.characters, segment.speaker);
      // New characters need the final metadata before choosing their own voice.
      prepared.audio.push(segment.speaker === "narrator" || character
        ? speechAudio(segment.text, character?.voice ?? state.story.narratorVoice, controller.signal, segment.mood)
        : undefined);
      prepared.notify?.();
    }).then(turn => {
      const spoken = applyTurn(state, turn).spoken;
      prepared.segments = turn.segments;
      spoken.forEach((segment, i) => {
        prepared.audio[i] ??= speechAudio(segment.text, segment.voice, controller.signal, segment.mood);
      });
      return turn;
    });
    void prepared.done.catch(() => {});
    return prepared;
  }
  stopTurn() { clearTimeout(this.timer); this.awaitingChild = false; this.generation++; this.controller?.abort(); }
  private stopNarration() { this.paused = true; this.stopTurn(); this.discardPrefetch(); }
  pauseNarrator() {
    this.stopNarration();
    this.view.pauseMode = "narrator";
    this.view.status = this.view.listening ? "Narrator paused. You can speak." : "Narrator paused";
    this.emit();
  }
  pauseAll() {
    this.stopNarration();
    const mic = this.mic; this.mic = undefined;
    if (mic) {
      const words: Promise<void> = this.keepLastWords(mic).finally(() => { if (this.lastWords === words) this.lastWords = undefined; });
      this.lastWords = words;
    }
    this.view.listening = false;
    this.view.micPaused = true;
    this.view.pauseMode = "all";
    this.view.status = "Story and microphone paused";
    this.emit();
  }
  /** Silences the story so a word can be sounded out; the mic goes off too so it can't hear the sounds as a reply. */
  quiet() {
    if (this.view.listening) this.pauseAll();
    else if (this.view.pauseMode === "none") this.pauseNarrator();
  }
  /** Turns the mic off, keeping a half-finished idea as story input for when the story resumes. */
  private async keepLastWords(mic: Microphone) {
    const text = await mic.finish().catch(() => "");
    if (!text || this.closed || this.echo(text)) return;
    this.rememberHeardNarration();
    this.view.state = { ...addChildUtterance(this.view.state, text), ended: false };
    this.emit();
  }
  private canAcceptMicrophoneWords() {
    return !this.closed && this.view.state.mode === "play" && this.view.pauseMode !== "all";
  }
  /** Stops only the microphone; narration and its automatic continuation keep running. */
  pauseMicrophone() {
    if (this.view.state.mode !== "play" || this.view.pauseMode === "all") return;
    const mic = this.mic; this.mic = undefined;
    this.view.listening = false;
    this.view.micPaused = true;
    this.view.status = this.view.pauseMode === "narrator" ? "Narrator and microphone paused" : "Microphone paused. Story continues.";
    this.emit();
    if (mic) {
      const words: Promise<void> = mic.finish().then(text => {
        if (text && this.canAcceptMicrophoneWords() && !this.echo(text)) void this.turn(text);
      }).catch(() => {}).finally(() => { if (this.lastWords === words) this.lastWords = undefined; });
      this.lastWords = words;
    }
  }
  async resumeMicrophone() {
    if (!this.canAcceptMicrophoneWords() || !this.view.micPaused) return;
    if (this.lastWords) await this.lastWords;
    if (!this.canAcceptMicrophoneWords() || !this.view.micPaused) return;
    this.view.micPaused = false;
    this.emit();
    await this.startMicrophone(false, true);
  }
  async resume() {
    if (this.lastWords) await this.lastWords;
    if (this.view.pauseMode === "all" && this.view.state.mode === "play") {
      await this.mode("play");
      if (!this.view.listening) return;
    }
    await this.turn();
  }
  /** Discard generated lines that had not finished playing before the child spoke. */
  private rememberHeardNarration() {
    const active = this.activeNarration;
    if (!active || this.pendingPage !== active.page) return;
    const heard = active.page.segments.slice(0, active.heardCount);
    const mode = this.view.state.mode;
    const characters = this.view.state.characters.filter(character =>
      active.base.characters.some(previous => previous.id === character.id) ||
      heard.some(segment => segment.speakerId === character.id || segment.text.toLowerCase().includes(character.name.toLowerCase()))
    );
    this.view.state = {
      ...active.base,
      mode,
      characters,
      log: [...active.base.log, ...heard.map(segment => ({
        kind: segment.speakerId === "narrator" ? "narration" as const : "dialogue" as const,
        speaker: segment.speakerName,
        text: segment.text,
        beatIndex: active.base.beatIndex,
      }))],
    };
    if (heard.length) {
      active.page.segments = heard;
      active.page.audio = active.page.audio.slice(0, heard.length);
      active.page.scene = undefined;
      const previous = this.view.pages[this.view.pages.indexOf(active.page) - 1];
      active.page.image = previous?.image;
      active.page.video = previous?.video;
      active.page.standardArtUrl = previous?.standardArtUrl;
    } else {
      this.view.pages = this.view.pages.filter(page => page !== active.page);
    }
    this.abandonedPages.add(active.page);
    this.referenceUrl = active.referenceUrl;
    this.pendingPage = undefined;
    this.activeNarration = undefined;
    this.emit();
  }
  async mode(mode: Mode) {
    if (this.lastWords) await this.lastWords;
    const wasAwaitingChild = this.awaitingChild;
    if (wasAwaitingChild) {
      clearTimeout(this.timer);
      this.awaitingChild = false;
    }
    this.discardPrefetch();
    this.mic?.stop(); this.mic = undefined;
    this.view.state = { ...this.view.state, mode }; this.view.listening = false; this.view.micPaused = false;
    if (this.view.pauseMode === "all" && mode === "listen") {
      this.view.pauseMode = "narrator";
      this.view.status = "Narrator paused";
    }
    this.emit();
    if (wasAwaitingChild && mode === "listen" && !this.view.state.ended) {
      this.timer = setTimeout(() => { if (!this.paused) void this.turn(); }, AUTO_CONTINUE_MS);
    }
    if (mode === "play") await this.startMicrophone(wasAwaitingChild);
  }
  private async startMicrophone(wasAwaitingChild: boolean, resumed = false) {
      const mic = this.mic = new Microphone(storyLanguage(this.view.state.story));
      try {
        await mic.start(
          text => { if (!this.closed && this.mic === mic && !this.echo(text)) { this.stopTurn(); this.view.status = "I’m listening…"; this.emit(); } },
          text => { if (this.mic === mic && !this.echo(text)) void this.turn(text); },
          error => { if (this.mic !== mic) return; mic.stop(); this.mic = undefined; this.view.error = error; this.view.listening = false; this.view.micPaused = true; this.emit(); },
          () => { if (!this.closed && this.mic === mic) { this.stopTurn(); this.view.status = "I’m listening…"; this.emit(); } },
        );
        if (this.mic === mic && !this.closed) {
          this.view.listening = true;
          this.view.micPaused = false;
          if (resumed) this.view.error = "";
          if (this.view.pauseMode !== "none") {
            this.view.pauseMode = "narrator";
            this.view.status = "Narrator paused. You can speak.";
          } else if (wasAwaitingChild) {
            this.awaitingChild = true;
            this.timer = setTimeout(() => { if (!this.paused) void this.turn(); }, CHILD_REPLY_WAIT_MS);
          } else if (resumed) {
            this.view.status = "Microphone on. You can speak.";
          }
        }
      } catch (e) { if (this.mic === mic) { this.mic = undefined; this.view.error = String((e as Error).message); this.view.micPaused = true; } }
      this.emit();
  }
  /** Follows a segment's playback and moves the read-along highlight from word to word. */
  private follow(page: AdventurePage, segment: number, recording: Blob | Promise<Blob>): OnTime {
    const clock = new WordClock(page.segments[segment]?.text ?? "");
    void Promise.resolve(recording).then(audioDuration).then(seconds => { if (seconds > 0) clock.duration = seconds; }).catch(() => {});
    return seconds => {
      if (this.closed) return;
      const word = clock.wordAt(seconds);
      const now = this.view.reading;
      if (now?.page === page && now.segment === segment && now.word === word) return;
      this.view.reading = { page, segment, word };
      this.emit();
    };
  }
  private stopFollowing(page: AdventurePage, segment: number) {
    if (this.view.reading?.page !== page || this.view.reading.segment !== segment) return;
    this.view.reading = undefined;
    this.emit();
  }
  private echo(text: string) { return Date.now() - this.spokenAt < 15000 && isLikelyEcho(text, this.recentlySpoken); }
  private async narrate(page: AdventurePage, controller: AbortController, current: () => boolean) {
    const loads = page.segments.map((s,i) => page.audio[i] ? Promise.resolve(page.audio[i]) : speech(s.text, s.voice, controller.signal, "story", s.mood));
    loads.forEach(p => { void p.catch(() => {}); });
    for (let i = 0; i < loads.length; i++) {
      const blob = await loads[i];
      if (!current()) return;
      page.audio[i] = blob;
      this.recentlySpoken = page.segments[i].text; this.spokenAt = Date.now() + page.segments[i].text.length * 90;
      this.view.status = `${page.segments[i].speakerName} is speaking`; this.emit();
      try { await playBlob(blob, controller.signal, this.follow(page, i, blob)); }
      finally { this.stopFollowing(page, i); }
      if (current() && this.activeNarration?.page === page) this.activeNarration.heardCount = Math.max(this.activeNarration.heardCount, i + 1);
      this.spokenAt = Date.now();
    }
  }
  async turn(text?: string) {
    if (this.closed || this.snapshotting || (this.view.state.ended && !text && !this.pendingPage)) return;
    if (text) this.rememberHeardNarration();
    this.stopTurn(); this.paused = false; this.view.pauseMode = "none";
    const generation = this.generation;
    let controller = this.controller = new AbortController();
    const current = () => !this.closed && generation === this.generation;
    if (text) this.view.state = { ...addChildUtterance(this.view.state, text), ended: false };
    this.view.error = ""; this.view.status = "Turning your ideas into a story…"; this.emit();
    try {
      if (!text && this.pendingPage) {
        const page = this.pendingPage;
        await this.narrate(page, controller, current);
        if (!current()) return;
        this.pendingPage = undefined;
        this.activeNarration = undefined;
        this.view.status = this.view.state.ended ? "The End. What a lovely adventure!" : "Ready for the next page"; this.emit();
        if (!this.view.state.ended) this.timer = setTimeout(() => { if (!this.paused) void this.turn(); }, AUTO_CONTINUE_MS);
        return;
      }
      this.pendingPage = undefined;
      const base = this.view.state;
      if (text || this.prefetched?.state !== base) this.discardPrefetch();
      const prepared = this.prefetched ?? this.prepare(base);
      this.prefetched = undefined;
      controller = this.controller = prepared.controller;
      const previous = this.view.pages.at(-1);
      const readyArt = !text && !this.customized && !base.plotNotes.length &&
        !base.characters.some(character => character.invented)
        ? standardArtUrl(base.story, base.beatIndex) : undefined;
      const page: AdventurePage = {
        segments: [], audio: [], image: readyArt ? undefined : previous?.image,
        video: undefined, standardArtUrl: readyArt,
      };
      const active: ActiveNarration = { base, page, heardCount: 0, referenceUrl: this.referenceUrl };
      this.activeNarration = active;
      let attached = false;
      let queued = 0;
      let playback = Promise.resolve();
      const display = (turn: Turn) => {
        const applied = applyTurn(base, turn);
        this.view.state = { ...applied.state, mode: this.view.state.mode };
        page.segments = applied.spoken;
        if (!attached) {
          attached = true; this.pendingPage = page; this.view.pages.push(page);
        }
        this.emit();
      };
      const schedule = () => {
        while (queued < page.segments.length && prepared.audio[queued]) {
          const i = queued++;
          const resource = prepared.audio[i]!;
          void resource.blob.then(blob => { if (current()) page.audio[i] = blob; }).catch(() => {});
          playback = playback.then(async () => {
            if (!current()) return;
            const segment = page.segments[i];
            this.recentlySpoken = segment.text; this.spokenAt = Date.now() + segment.text.length * 90;
            this.view.status = `${segment.speakerName} is speaking`; this.emit();
            try { await resource.play(this.follow(page, i, resource.blob)); }
            finally { this.stopFollowing(page, i); }
            if (!current()) return;
            active.heardCount = Math.max(active.heardCount, i + 1);
            page.audio[i] = await resource.blob;
            this.spokenAt = Date.now();
          });
          void playback.catch(() => {});
        }
      };
      prepared.notify = () => {
        if (!current()) return;
        display(TurnSchema.parse({ segments: prepared.segments }));
        schedule();
      };
      if (prepared.segments.length) prepared.notify();
      const turn = await prepared.done;
      if (!current()) return;
      display(turn);
      page.scene = turn.imagePrompt ?? undefined;
      const standardUrl = standardArtUrl(base.story, base.beatIndex);
      this.customized ||= !!text && (!!turn.stateChanges.plotNotes?.length ||
        !!turn.stateChanges.addObjects?.length || !!turn.stateChanges.addCharacters?.length);
      const changedStory = this.customized || base.plotNotes.length > 0 || !!turn.stateChanges.plotNotes?.length ||
        !!turn.stateChanges.addCharacters?.length || base.characters.some(character => character.invented);
      if (standardUrl && !changedStory) this.illustrateStandard(page, standardUrl, turn.imagePrompt ?? base.story.beats[base.beatIndex].goal, turn.motionPrompt ?? undefined);
      else if (turn.imagePrompt) this.illustrate(page, turn.imagePrompt, turn.motionPrompt ?? undefined, base.beatIndex);
      schedule();
      // Prepare the next text and voice while this page plays. A child's answer discards it.
      this.warmup();
      await playback;
      if (!current()) return;
      this.pendingPage = undefined;
      this.activeNarration = undefined;
      this.view.status = this.view.state.ended ? "The End. What a lovely adventure!" : turn.awaitChild ? "What happens next? Tell me!" : "A little more magic…"; this.emit();
      if (!this.view.state.ended) {
        this.awaitingChild = turn.awaitChild && this.view.state.mode === "play";
        this.timer = setTimeout(() => { if (!this.paused) void this.turn(); }, this.awaitingChild ? CHILD_REPLY_WAIT_MS : AUTO_CONTINUE_MS);
      }
    } catch (e) {
      if (current() && (e as Error).name !== "AbortError") { controller.abort(); this.discardPrefetch(); this.view.error = (e as Error).message; this.view.status = "Let’s try that again"; this.emit(); }
    }
  }
  private illustrationReferences(scene: string): ImageReference[] {
    const references: ImageReference[] = [];
    for (const name of charactersInScene(scene, this.view.state.characters)) {
      const anchor = this.characterReferences.get(name);
      if (!anchor || this.abandonedPages.has(anchor.page)) continue;
      let reference = references.find(item => item.url === anchor.url);
      if (!reference) {
        reference = { url: anchor.url, characters: [] };
        references.push(reference);
      }
      reference.characters.push(name);
    }
    // fal's multi-reference editor accepts at most four pictures. Keep room for the last page.
    const selected = references.filter(item => item.url !== this.referenceUrl).slice(0, this.referenceUrl ? 3 : 4);
    if (this.referenceUrl) {
      selected.push(references.find(item => item.url === this.referenceUrl) ?? { url: this.referenceUrl, characters: [] });
    }
    return selected;
  }
  private illustrateStandard(page: AdventurePage, url: string, scene: string, motion?: string) {
    const previous = this.view.pages.at(-2);
    if (previous?.standardArtUrl === url && previous.image && !this.abandonedPages.has(previous)) {
      page.image = previous.image;
      page.video = previous.video;
      page.standardArtUrl = url;
      this.emit();
      return;
    }
    const controller = new AbortController();
    page.image = undefined;
    page.video = undefined;
    page.standardArtUrl = url;
    this.imageControllers.add(controller);
    this.view.imageBusy = true; this.emit();
    const job = (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Could not open the standard illustration (${response.status})`);
        const image = await response.blob();
        if (this.closed || this.abandonedPages.has(page)) return;
        page.image = image;
        this.emit();
        this.animate(image, url, scene, motion);
      } catch (e) { if (!this.closed && (e as Error).name !== "AbortError") this.view.error = `Illustration: ${(e as Error).message}`; }
    })();
    this.imageJobs.add(job);
    void job.finally(() => { this.imageJobs.delete(job); this.imageControllers.delete(controller); this.view.imageBusy = this.imageJobs.size > 0; this.emit(); });
  }
  private illustrate(page: AdventurePage, scene: string, motion?: string, beatIndex?: number) {
    const controller = new AbortController();
    this.imageControllers.add(controller);
    this.view.imageBusy = true; this.emit();
    const references = this.illustrationReferences(scene);
    const visibleCharacters = charactersInScene(scene, this.view.state.characters);
    const job = (async () => {
      try {
        const data = await post<{ url: string; dataUri: string }>("/api/image", {
          scene, artStyle: this.view.state.story.artStyle, characters: this.view.state.characters, references,
          standardArt: beatIndex !== undefined && standardArtUrl(this.view.state.story, beatIndex)
            ? { storyId: this.view.state.story.id, beatIndex } : undefined,
        }, controller.signal);
        if (this.closed || this.abandonedPages.has(page)) return;
        const image = await (await fetch(data.dataUri)).blob();
        if (this.closed || this.abandonedPages.has(page)) return;
        page.image = image;
        page.video = undefined;
        page.standardArtUrl = undefined;
        for (const name of visibleCharacters) {
          const existing = this.characterReferences.get(name);
          if (!existing || this.abandonedPages.has(existing.page)) this.characterReferences.set(name, { url: data.url, page });
        }
        if (this.view.pages.at(-1) === page) this.referenceUrl = data.url;
        this.animate(image, data.url, scene, motion);
      } catch (e) { if (!this.closed && (e as Error).name !== "AbortError") this.view.error = `Illustration: ${(e as Error).message}`; }
    })();
    this.imageJobs.add(job);
    void job.finally(() => { this.imageJobs.delete(job); this.imageControllers.delete(controller); this.view.imageBusy = this.imageJobs.size > 0; this.emit(); });
  }
  private animate(image: Blob, imageUrl: string, scene: string, motion?: string) {
    const controller = new AbortController();
    this.imageControllers.add(controller);
    this.videoJobs++; this.view.videoBusy = true; this.emit();
    void animateScene(imageUrl, scene, motion, controller.signal)
      .then(video => {
        if (!video || this.closed) return;
        // Later pages that reuse this picture should move too.
        for (const p of this.view.pages) if (p.image === image) p.video = video;
      })
      .catch(e => { if ((e as Error).name !== "AbortError") console.warn("Scene animation failed:", e); })
      .finally(() => { this.imageControllers.delete(controller); this.videoJobs--; this.view.videoBusy = this.videoJobs > 0; this.emit(); });
  }
  async snapshot() {
    this.snapshotting = true;
    this.pauseAll();
    try {
      // Keep an idea the child was mid-way through saying when Save was pressed.
      if (this.lastWords) await this.lastWords;
      await Promise.all([...this.imageJobs]);
      // Interrupted pages still need complete audio for offline replay.
      for (const page of this.view.pages) {
        for (let i = 0; i < page.segments.length; i++) {
          if (!page.audio[i]) {
            const s = page.segments[i];
            page.audio[i] = await speech(s.text, s.voice, AbortSignal.timeout(30000), "story", s.mood);
          }
        }
      }
      return structuredClone({ story: this.view.state.story, state: this.view.state, pages: this.view.pages });
    } finally { this.snapshotting = false; }
  }
  close() {
    this.closed = true; this.stopTurn(); this.discardPrefetch(); this.mic?.stop();
    this.imageControllers.forEach(c => c.abort());
  }
}
