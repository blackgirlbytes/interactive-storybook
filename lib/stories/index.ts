import type { StoryDef } from "@/lib/types";
import { voiceModel as v } from "@/lib/voices";

export const ART_STYLE =
  "Warm watercolor children's picture book illustration, soft pastel colors, gentle golden lighting, friendly rounded characters with big expressive eyes, cozy and whimsical, no text or letters";

export const CLASSIC_STORIES: StoryDef[] = [
  {
    id: "noahs-ark",
    title: "Noah's Ark",
    emoji: "🌈",
    blurb: "Noah builds a giant boat and gathers the animals two by two before the great flood.",
    category: "bible",
    setting: "A green valley long ago, then a giant wooden ark floating on a wide sea",
    artStyle: ART_STYLE,
    narratorVoice: v("athena"),
    characters: [
      { id: "noah", name: "Noah", personality: "Kind, patient, faithful and hard-working grandfather figure who listens carefully and trusts God even when others laugh", look: "an old man with a long white beard, brown robe and a wooden walking staff", voice: v("draco") },
      { id: "naamah", name: "Naamah", personality: "Noah's warm, practical wife who keeps everyone fed and calm", look: "a kind older woman with a blue headscarf and an apron", voice: v("helena") },
      { id: "dove", name: "Dove", personality: "A gentle, brave little white dove who loves to help", look: "a small white dove with soft feathers", voice: v("iris") },
      { id: "elephant", name: "Ellie the Elephant", personality: "A big, cheerful elephant who worries about fitting through the door", look: "a friendly grey elephant with big ears", voice: v("luna") },
    ],
    beats: [
      { title: "A big instruction", goal: "God tells Noah a great flood is coming and asks him to build an ark; neighbors laugh but Noah obeys" },
      { title: "Building the ark", goal: "Noah's family builds the huge ark from wood and pitch" },
      { title: "Two by two", goal: "The animals arrive two by two and board the ark" },
      { title: "The rain", goal: "Rain falls for forty days and nights while everyone stays safe and cozy on the ark" },
      { title: "The dove", goal: "Noah sends out the dove, which returns with an olive leaf showing dry land" },
      { title: "The rainbow", goal: "Everyone leaves the ark onto dry land and God places a rainbow in the sky as a promise" },
    ],
  },
  {
    id: "three-little-pigs",
    title: "The Three Little Pigs",
    emoji: "🐷",
    blurb: "Three pig siblings build houses of straw, sticks and bricks. Then the wolf comes knocking.",
    category: "fairy-tale",
    setting: "A sunny countryside with rolling hills, a meadow of straw, a little forest, and a brickyard",
    artStyle: ART_STYLE,
    narratorVoice: v("cora"),
    characters: [
      { id: "percy", name: "Percy Pig", personality: "The youngest pig: playful, a bit lazy, loves to dance and sing", look: "a small pink pig in a yellow straw hat", voice: v("iris") },
      { id: "pip", name: "Pip Pig", personality: "The middle pig: speedy and silly, always in a hurry to play", look: "a pink pig wearing green overalls", voice: v("delia") },
      { id: "penny", name: "Penny Pig", personality: "The oldest pig: careful, clever, patient and kind to her siblings", look: "a pink pig with a red bandana and a little trowel", voice: v("cordelia") },
      { id: "wolf", name: "Big Bad Wolf", personality: "A grumbly, boastful, hungry wolf who is more silly than scary and loves to huff and puff", look: "a scruffy grey wolf with a long bushy tail and a patched coat", voice: v("jupiter") },
    ],
    beats: [
      { title: "Leaving home", goal: "Mother Pig sends the three little pigs off to build their own homes" },
      { title: "Three houses", goal: "Percy builds with straw, Pip with sticks, Penny with bricks" },
      { title: "Straw and sticks", goal: "The wolf huffs and puffs and blows down the straw and stick houses; the pigs escape to Penny's house" },
      { title: "The brick house", goal: "The wolf cannot blow down the brick house and tries the chimney" },
      { title: "Safe and sound", goal: "The wolf gives up and runs away (no one is hurt), and the pigs celebrate together" },
    ],
  },
  {
    id: "tortoise-and-hare",
    title: "The Tortoise and the Hare",
    emoji: "🐢",
    blurb: "A boastful hare and a steady tortoise run a race that the whole forest comes to watch.",
    category: "fable",
    setting: "A meadow and forest path with a racetrack marked by flowers, a big shady oak tree, and a finish line ribbon",
    artStyle: ART_STYLE,
    narratorVoice: v("minerva"),
    characters: [
      { id: "tortoise", name: "Tilly Tortoise", personality: "Slow, calm, steady, determined, quietly confident and kind", look: "a small green tortoise with a patterned brown shell and a tiny scarf", voice: v("harmonia") },
      { id: "hare", name: "Harry Hare", personality: "Fast, boastful, show-offy and easily distracted but not mean underneath", look: "a lanky brown hare with long ears and running shoes", voice: v("aries") },
      { id: "owl", name: "Judge Owl", personality: "Wise, fair and a little sleepy referee of the race", look: "a round brown owl with spectacles holding a little flag", voice: v("atlas") },
    ],
    beats: [
      { title: "The boast", goal: "Hare brags that nobody is faster, and Tortoise calmly challenges him to a race" },
      { title: "Ready, set, go", goal: "The forest animals gather and Owl starts the race; Hare zooms far ahead" },
      { title: "The nap", goal: "Hare is so far ahead he stops to nap under the oak tree" },
      { title: "Slow and steady", goal: "Tortoise keeps going step by step, passing the sleeping Hare" },
      { title: "The finish line", goal: "Hare wakes and races but Tortoise crosses the finish line first; everyone learns slow and steady wins the race" },
    ],
  },
  {
    id: "little-red-riding-hood",
    title: "Little Red Riding Hood",
    emoji: "🧺",
    blurb: "Red carries a basket of treats through the woods to Grandma's, but a sneaky wolf has other plans.",
    category: "fairy-tale",
    setting: "A cozy village cottage, a sun-dappled forest path full of flowers, and Grandma's little cottage in the woods",
    artStyle: ART_STYLE,
    narratorVoice: v("athena"),
    characters: [
      { id: "red", name: "Little Red Riding Hood", personality: "Curious, cheerful, friendly and brave girl who loves flowers and her grandma", look: "a young girl with a bright red hooded cape carrying a wicker basket", voice: v("cordelia") },
      { id: "grandma", name: "Grandma", personality: "Warm, funny, loving grandmother who bakes cookies and tells jokes", look: "a smiling grandmother with round glasses, a white bun and a knitted shawl", voice: v("janus") },
      { id: "wolf", name: "The Wolf", personality: "A sneaky, sweet-talking but bumbling wolf who is more silly than scary", look: "a tall grey wolf with a sly grin and a bushy tail", voice: v("hermes") },
      { id: "woodcutter", name: "The Woodcutter", personality: "Gentle, strong, helpful neighbor who looks out for everyone in the woods", look: "a tall man with a plaid shirt, a beard and a friendly smile", voice: v("mars") },
    ],
    beats: [
      { title: "A basket for Grandma", goal: "Red's mother sends her with a basket of treats to sick Grandma and tells her to stay on the path" },
      { title: "Into the woods", goal: "Red meets the Wolf, who tricks her into picking flowers off the path" },
      { title: "The tricky wolf", goal: "The Wolf hurries ahead to Grandma's, hides Grandma in the closet, and puts on her nightcap" },
      { title: "What big eyes", goal: "Red arrives and notices Grandma looks very strange: what big eyes, ears and teeth" },
      { title: "Rescue and home", goal: "The Woodcutter chases the Wolf away (no one is hurt), Grandma is found safe, and they share treats; Red promises to stay on the path" },
    ],
  },
];

export function getClassicStory(id: string): StoryDef | undefined {
  return CLASSIC_STORIES.find((s) => s.id === id);
}
