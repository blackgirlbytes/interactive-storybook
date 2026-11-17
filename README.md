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
- Choose **Play & talk**, allow microphone access, and interrupt with “The tortoise has roller skates!” or “Noah, why did you build the ark?” Headphones prevent speaker audio from reaching the microphone. Typed ideas work too.
- **Create a story** guides the child through a hero, setting, problem, and helper, then opens their new story.
- **Save this version** makes a separate copy in IndexedDB, including text and image/video/audio blobs. Clips still rendering when you save are not included. Saving pauses playback, turns off the microphone, and finishes downloading missing narration. Originals stay unchanged.
- **My adventures** replays saved versions without AI calls. There are no accounts or cloud saves. Saves stay in the same browser/profile/origin, subject to storage quota and browser eviction. Clearing site data deletes them. Private browsing may not preserve them.

Use HTTPS outside localhost for microphone access. Chrome and Edge are recommended; MediaRecorder support and browser autoplay policies vary.

## Providers

- Deepgram Nova-3: streaming transcription, interim-result barge-in and end-of-utterance detection. Browser connections use short-lived JWTs, not the server key.
- Deepgram Aura-2: a narrator and separate character voices. MP3 playback starts while downloading on MediaSource-capable browsers, with full-blob playback as a fallback.
- fal OpenRouter chat-completions endpoint: JSON story turns and guided story creation, with schema validation and one retry. The originally planned `fal-ai/any-llm` is deprecated; its replacement still uses only `FAL_KEY`.
- fal FLUX schnell: first illustration. FLUX Kontext dev (20 steps): faster reference-image edits, with schnell fallback. Illustrations load in the background.
- fal H3 Max Turbo (`minimax/h3-max-turbo/image-to-video`): each new picture becomes a muted 5-second 768P loop (same first and last frame) that fades in over the still when ready, usually well after narration starts. About $0.09 per clip at current pricing. Set `FAL_VIDEO_MODEL` to another fal image-to-video endpoint with the same inputs, or to `off` to keep still pictures. Saved adventures keep the clips.

Story turns stream line by line over NDJSON, with voice downloads starting as each line arrives. Listen mode prefetches the opening on the story screen and one next page during narration. Prefetching uses provider credit even if you leave before hearing that page; changing modes, pausing, or adding an idea cancels unused work.

Story facts, characters, objects, recent dialogue and ordered story beats travel with each turn. Added characters get distinct voices. Built-in covers are local SVG artwork; live scenes come from fal.

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
