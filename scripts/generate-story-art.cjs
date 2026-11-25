/** Generate the built-in books' illustrations once, then commit the resulting JPEGs. */
const fs = require("node:fs/promises");
const path = require("node:path");
const ts = require("typescript");
const scenes = require("./story-art-scenes.json");

async function stories() {
  const source = await fs.readFile(path.join(__dirname, "../lib/stories/index.ts"), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", js)(() => ({ voiceModel: name => name }), mod, mod.exports);
  return mod.exports.CLASSIC_STORIES;
}

async function generate(endpoint, input) {
  const response = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`${endpoint}: ${response.status} ${(await response.text()).slice(0, 240)}`);
  const result = await response.json();
  if (result.has_nsfw_concepts?.[0]) throw new Error(`${endpoint}: image blocked by safety checker`);
  const url = result.images?.[0]?.url;
  if (!url) throw new Error(`${endpoint}: no image returned`);
  const image = await fetch(url);
  if (!image.ok || !image.headers.get("content-type")?.startsWith("image/jpeg")) throw new Error(`${endpoint}: invalid JPEG output`);
  return Buffer.from(await image.arrayBuffer());
}

async function main() {
  if (!process.env.FAL_KEY) throw new Error("Set FAL_KEY before generating story art.");
  const force = process.argv.includes("--force");
  const forceIndependent = process.argv.includes("--independent");
  const onlyStory = process.argv.find(arg => arg.startsWith("--story="))?.split("=")[1];
  const onlyBeat = process.argv.find(arg => arg.startsWith("--beat="))?.split("=")[1];
  for (const story of await stories()) {
    if (onlyStory && story.id !== onlyStory) continue;
    const bookScenes = scenes[story.id];
    if (!bookScenes || bookScenes.length !== story.beats.length) throw new Error(`Missing scenes for ${story.id}`);
    let reference;
    for (const [index, scene] of bookScenes.entries()) {
      const file = path.join(__dirname, "../public/story-art", story.id, `beat-${index}.jpg`);
      if (onlyBeat !== undefined && Number(onlyBeat) !== index) {
        if (index === Number(onlyBeat) - 1) {
          reference = `data:image/jpeg;base64,${(await fs.readFile(file)).toString("base64")}`;
        }
        continue;
      }
      if (!force && await fs.stat(file).then(() => true, () => false)) {
        // Existing files are stable. A partial run can be resumed without charging again.
        reference = `data:image/jpeg;base64,${(await fs.readFile(file)).toString("base64")}`;
        console.log(`Keeping ${story.id} beat ${index}`);
        continue;
      }
      const looks = story.characters.filter(character => character.name.toLowerCase().split(/\W+/)
        .some(word => word.length > 2 && !["the", "little", "pig", "riding", "hood"].includes(word) && scene.toLowerCase().includes(word)))
        .map(character => `${character.name}: ${character.look}`).join("; ");
      const prompt = `${story.artStyle}. A single wide 4:3 storybook page, full-bleed edge to edge with no border, frame or panels. Show exactly this scene: ${scene} Character designs for the people or animals named above: ${looks}. Do not show other characters or events from the story. No words, letters, captions, signs, watermarks or signatures.`;
      // An edit reference can carry an unwanted character into the next scene.
      const independent = forceIndependent || (story.id === "three-little-pigs" && index === 4) ||
        (story.id === "little-red-riding-hood" && (index === 2 || index === 3 || index === 4));
      const bytes = reference && !independent
        ? await generate("fal-ai/flux-2/edit", {
            prompt: `Use the reference only for character appearance and the painted night style. Compose a new picture from scratch. Exactly one of each named character: ${prompt}`,
            image_urls: [reference], image_size: "landscape_4_3", enable_prompt_expansion: false,
            enable_safety_checker: true, output_format: "jpeg", seed: 44000 + index,
          })
        : await generate("fal-ai/flux-2-pro", {
          prompt, image_size: "landscape_4_3",
          enable_safety_checker: true, output_format: "jpeg", seed: 44000,
        });
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, bytes);
      reference = `data:image/jpeg;base64,${bytes.toString("base64")}`;
      console.log(`Saved ${story.id} beat ${index} (${bytes.length} bytes)`);
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
