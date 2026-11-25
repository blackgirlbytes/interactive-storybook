# OnceUpon

A voice-powered storybook for little imaginations. Next.js App Router, TypeScript, Tailwind, Deepgram and fal.

## Run locally

```sh
npm install
cp .env.example .env.local
# Add your DEEPGRAM_API_KEY and FAL_KEY to .env.local
npm run dev -- --hostname 127.0.0.1
```

Open http://localhost:3000. The library works without keys; generated stories, illustrations, and voices require funded provider accounts. Deepgram's temporary-token endpoint requires a key with Member or higher permissions. Never prefix either key with `NEXT_PUBLIC_`.

## Try it

- Open one of four classics, then **Begin the story**. Listen mode continues automatically.
- Choose **Play & talk**, allow microphone access, and interrupt with “The tortoise has roller skates!” or “Noah, why did you build the ark?” When the story asks a question, it waits up to 8 seconds for a reply, then continues if nobody speaks. Speech stops that timer so a child can finish their idea. Headphones prevent speaker audio from reaching the microphone. Typed ideas work too.
- **Create a story** guides the child through a hero, setting, problem, and helper, then opens their new story.
- **Save this version** makes a separate copy in IndexedDB, including text and image/video/audio blobs. Clips still rendering when you save are not included. Saving pauses playback, turns off the microphone, and finishes downloading missing narration. Originals stay unchanged.
- **My adventures** replays saved versions without AI calls. There are no accounts or cloud saves. Saves stay in the same browser/profile/origin, subject to storage quota and browser eviction. Clearing site data deletes them. Private browsing may not preserve them.

Use HTTPS outside localhost for microphone access. Chrome and Edge are recommended; MediaRecorder support and browser autoplay policies vary.

## Languages, read-along and phonics

- Stories can be told in English, Spanish, French, German, Italian, Portuguese, Dutch, Hindi, Japanese or Russian: the languages Flux STT Multilingual understands and Flux TTS reads with full text normalization. Pick one on a classic story before it starts, or on the create page; the choice is remembered. Classic stories are recast with same-gender voices in that language (Japanese has four voices, so some roles share one). The interface itself stays in English.
- Each word lights up as it is read. Flux TTS returns no word timings, so they are estimated from word length and punctuation and scaled to the recording's real length.
- Turn on **Aa Phonics** and tap any word to hear it said, sounded out part by part (phonemes in English, syllables, aksharas or kana elsewhere), and blended again.

## Providers

- Deepgram Flux STT (`flux-general-en` for English, `flux-general-multi` with a `language_hint` for other languages, `/v2/listen`): streaming transcription with model-driven turn detection. Interim transcripts stop narration; `EndOfTurn` submits the child's complete idea. Opus microphone audio streams in roughly 80 ms chunks. Browser connections use short-lived JWTs, not the server key.
- Deepgram Flux TTS (`/v2/speak`): a narrator and separate character voices from 36 English voices and the Flux voices for the nine other fully supported languages. Story narration uses `expressivity=1` (beta) as a baseline, and the story engine tags every line with a mood (hushed, gentle, lively, excited) that shifts it from -2 to 2, so whispers go soft and surprises go big. English lines also hold a 600 ms pause after a mid-sentence ellipsis (Flux TTS inline pauses are English-only). Phonics uses the neutral delivery. Flux TTS has no child voices; the brightest young voices (Brooke, Heather, Gemma, Cole, Kit) suit child characters best. Legacy Aura-2 voice names map to Flux voices when generating new audio; saved recordings still replay unchanged. MP3 playback starts while downloading on MediaSource-capable browsers, with full-blob playback as a fallback.
- fal OpenRouter chat-completions endpoint: JSON story turns and guided story creation, with schema validation and one retry. The originally planned `fal-ai/any-llm` is deprecated; its replacement still uses only `FAL_KEY`.
- The four built-in books ship with a fixed picture for each story beat. Opening an original book shows the same picture every time. These pictures were generated once with fal FLUX 2 Pro and FLUX 2 Edit, then stored in `public/story-art/`. Run `npm run art:generate` to fill in missing pictures; pass `-- --force` to regenerate them (which incurs new fal charges).
- When a child changes a built-in story, or when a custom story needs a picture, fal generates one in the background. A built-in book's fixed picture is sent as a reference for its changed scene. Each character's first newly generated picture can also become a reference for later appearances. FLUX Kontext dev handles one reference; FLUX.2 edit combines several. Failed edits fall back to Kontext and then schnell.
- fal H3 Max Turbo (`minimax/h3-max-turbo/image-to-video`): each new picture becomes a muted 5-second 768P loop (same first and last frame) that fades in over the still when ready, usually well after narration starts. The story engine supplies one small scene-specific action, and prompt expansion is disabled to keep the motion focused. About $0.09 per clip at current pricing. Set `FAL_VIDEO_MODEL` to another fal image-to-video endpoint with the same inputs, or to `off` to keep still pictures. Saved adventures keep the clips.

Story turns stream line by line over NDJSON, with voice downloads starting as each line arrives. Listen mode prefetches the opening on the story screen and one next page during narration. Prefetching uses provider credit even if you leave before hearing that page; changing modes, pausing, or adding an idea cancels unused work.

Story facts, characters, objects, recent dialogue and ordered story beats travel with each turn. Added characters get distinct voices. Original books use shipped illustrations; child-led scenes and custom stories are generated with fal.

## Validation

```sh
npm test
npm run lint
npm run build
```

Tests cover schema parsing, plot changes, character memory, ending rules, interruption races, pause/resume and saved audio. Live provider quality, microphone recognition, visual consistency and the roughly 1.5-second audio-start target must be measured with real keys and actual audio hardware. The target is not a guaranteed latency.

## Safety and deployment limits

This is a local prototype for supervised use, not a production children's service. System prompts request gentle stories and redirect unsafe requests; image generation enables the provider safety checker. Prompt rules and echo filtering are not guarantees. No dedicated content-moderation pipeline, parental consent flow, authentication, rate limiting or billing protection is included. Add these before a public deployment.

Microphone audio goes to Deepgram. Story ideas/transcripts go through the app server to fal and its selected LLM provider; scene descriptions and reference images go to fal's image providers. No raw microphone recordings are stored by this app. Saved adventures include typed/transcribed story contributions and generated content. Review the providers' retention/privacy policies and obtain appropriate parental consent before collecting children's data. Avoid real names, schools and addresses.
