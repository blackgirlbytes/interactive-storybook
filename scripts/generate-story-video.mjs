/** Generate each built-in book's loop once, then commit the resulting MP4s. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ts from "typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const scenes = JSON.parse(await fs.readFile(path.join(scriptDir, "story-art-scenes.json"), "utf8"));
const run = promisify(execFile);

const model = process.env.FAL_VIDEO_MODEL || "minimax/h3-max-turbo/image-to-video";
const queueApp = model.split("/").slice(0, 2).join("/");
const queueBase = "https://queue.fal.run";

function loadModule(file, requireModule = () => ({})) {
  return fs.readFile(file, "utf8").then(source => {
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const mod = { exports: {} };
    new Function("require", "module", "exports", js)(requireModule, mod, mod.exports);
    return mod.exports;
  });
}

async function queue(url, init) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`fal queue ${response.status}: ${(await response.text()).slice(0, 240)}`);
  return response.json();
}

async function generate(story, index, buildVideoPrompt, force) {
  const scene = scenes[story.id]?.[index];
  if (!scene) throw new Error(`Missing scene for ${story.id} beat ${index}`);
  const file = path.join(scriptDir, "../public/story-video", story.id, `beat-${index}.mp4`);
  if (!force && await fs.stat(file).then(() => true, () => false)) {
    console.log(`Keeping ${story.id} beat ${index}`);
    return;
  }
  const pendingFile = `${file}.pending.json`;
  let id;
  if (!force) id = await fs.readFile(pendingFile, "utf8").then(text => JSON.parse(text).id, () => undefined);
  if (!id) {
    const image = await fs.readFile(path.join(scriptDir, "../public/story-art", story.id, `beat-${index}.jpg`));
    const imageUrl = `data:image/jpeg;base64,${image.toString("base64")}`;
    const submitted = await queue(`${queueBase}/${model}`, {
      method: "POST",
      body: JSON.stringify({
        prompt: buildVideoPrompt(scene),
        image_url: imageUrl,
        end_image_url: imageUrl,
        seed: [...`${story.id}/${index}`].reduce((seed, char) => (seed * 31 + char.charCodeAt(0)) >>> 0, 7),
        duration: 5,
        resolution: "768P",
        prompt_expansion_mode: "disabled",
        enable_safety_checker: true,
      }),
    });
    id = submitted.request_id;
    if (!id) throw new Error(`No request ID for ${story.id} beat ${index}`);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(pendingFile, JSON.stringify({ id, model }));
  }
  const deadline = Date.now() + 15 * 60_000;
  while (Date.now() < deadline) {
    const status = await queue(`${queueBase}/${queueApp}/requests/${id}/status`);
    if (status.status === "COMPLETED") break;
    if (status.status !== "IN_QUEUE" && status.status !== "IN_PROGRESS") throw new Error(`${story.id} beat ${index}: ${status.status}`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  if (Date.now() >= deadline) throw new Error(`Timed out: ${story.id} beat ${index} (${id})`);
  const result = await queue(`${queueBase}/${queueApp}/requests/${id}`);
  const videoUrl = result.video?.url;
  if (!videoUrl || new URL(videoUrl).hostname !== "fal.media" && !new URL(videoUrl).hostname.endsWith(".fal.media")) throw new Error(`Invalid video URL for ${story.id} beat ${index}`);
  const response = await fetch(videoUrl);
  if (!response.ok) throw new Error(`Could not download ${story.id} beat ${index}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.toString("ascii", 4, 8) !== "ftyp") throw new Error(`Invalid MP4 for ${story.id} beat ${index}`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const rawFile = `${file}.raw.mp4`;
  const outputFile = `${file}.tmp.mp4`;
  try {
    await fs.writeFile(rawFile, bytes);
    // The model's MP4 is ~7 MB for five seconds. H.264 at CRF 25 is ~1 MB and needs no audio track.
    await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", rawFile,
      "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "25", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outputFile]);
    const compressed = await fs.readFile(outputFile);
    if (compressed.toString("ascii", 4, 8) !== "ftyp") throw new Error(`Invalid compressed MP4 for ${story.id} beat ${index}`);
    await fs.rename(outputFile, file);
    await fs.unlink(pendingFile);
    console.log(`Saved ${story.id} beat ${index} (${compressed.length} bytes)`);
  } finally {
    await Promise.allSettled([fs.unlink(rawFile), fs.unlink(outputFile)]);
  }
}

async function main() {
  if (!process.env.FAL_KEY) throw new Error("Set FAL_KEY before generating story video.");
  if (model === "off") throw new Error("FAL_VIDEO_MODEL is off.");
  await run("ffmpeg", ["-version"]);
  const force = process.argv.includes("--force");
  const onlyStory = process.argv.find(arg => arg.startsWith("--story="))?.split("=")[1];
  const onlyBeat = process.argv.find(arg => arg.startsWith("--beat="))?.split("=")[1];
  const { CLASSIC_STORIES } = await loadModule(path.join(scriptDir, "../lib/stories/index.ts"), () => ({ voiceModel: name => name }));
  const { buildVideoPrompt } = await loadModule(path.join(scriptDir, "../lib/engine/videoPrompt.ts"));
  const tasks = [];
  for (const story of CLASSIC_STORIES) {
    if (onlyStory && story.id !== onlyStory) continue;
    if (scenes[story.id]?.length !== story.beats.length) throw new Error(`Missing scenes for ${story.id}`);
    for (const [index] of story.beats.entries()) {
      if (onlyBeat !== undefined && Number(onlyBeat) !== index) continue;
      tasks.push({ story, index });
    }
  }
  if (!tasks.length) throw new Error("No matching story beats.");
  const workers = Array.from({ length: Math.min(3, tasks.length) }, async () => {
    for (;;) {
      const task = tasks.shift();
      if (!task) return;
      await generate(task.story, task.index, buildVideoPrompt, force);
    }
  });
  const results = await Promise.allSettled(workers);
  const failure = results.find(result => result.status === "rejected");
  if (failure) throw failure.reason;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
