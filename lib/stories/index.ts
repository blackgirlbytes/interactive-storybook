import type { StoryDef } from "@/lib/types";
import { voiceModel as v } from "@/lib/voices";

export const ART_STYLE =
  "Rich gouache and ink children's picture book illustration set at twilight and under moonlight: deep indigo and blue shadows, warm lamplight-gold glows from lanterns, windows and fireflies, soft silvery rim light on the characters, fine hand-drawn ink outlines, textured paper grain, friendly expressive characters, cozy and magical, never scary, no text or letters";
const CHRISTMAS_ART_STYLE = ART_STYLE.replace("lanterns, windows and fireflies", "lanterns and windows");

export const CLASSIC_STORIES: StoryDef[] = [
  {
    id: "noahs-ark",
    title: "Noah's Ark",
    emoji: "🌈",
    blurb: "Noah builds a giant boat and gathers the animals two by two before the great flood.",
    category: "bible",
    setting: "A green valley long ago, then a giant wooden ark floating on a wide sea",
    artStyle: ART_STYLE,
    narratorVoice: v("hannah"),
    characters: [
      { id: "noah", name: "Noah", personality: "Kind, patient, faithful and hard-working grandfather figure who listens carefully and trusts God even when others laugh", look: "an old man with a long white beard, brown robe and a wooden walking staff", voice: v("sean") },
      { id: "naamah", name: "Naamah", personality: "Noah's warm, practical wife who keeps everyone fed and calm", look: "a kind older woman with a blue headscarf and an apron", voice: v("bree") },
      { id: "dove", name: "Dove", personality: "A gentle, brave little white dove who loves to help", look: "a small white dove with soft feathers", voice: v("gemma") },
      { id: "elephant", name: "Ellie the Elephant", personality: "A big, cheerful elephant who worries about fitting through the door", look: "a friendly grey elephant with big ears", voice: v("brooke") },
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
    narratorVoice: v("rufus"),
    characters: [
      { id: "percy", name: "Percy Pig", personality: "The youngest pig: playful, a bit lazy, loves to dance and sing", look: "a small pink pig in a yellow straw hat", voice: v("cole") },
      { id: "pip", name: "Pip Pig", personality: "The middle pig: speedy and silly, always in a hurry to play", look: "a pink pig wearing green overalls", voice: v("heather") },
      { id: "penny", name: "Penny Pig", personality: "The oldest pig: careful, clever, patient and kind to her siblings", look: "a pink pig with a red bandana and a little trowel", voice: v("gemma") },
      { id: "wolf", name: "Big Bad Wolf", personality: "A grumbly, boastful, hungry wolf who is more silly than scary and loves to huff and puff", look: "a scruffy grey wolf with a long bushy tail and a patched coat", voice: v("cliff") },
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
    narratorVoice: v("maeve"),
    characters: [
      { id: "tortoise", name: "Tilly Tortoise", personality: "Slow, calm, steady, determined, quietly confident and kind", look: "a small green tortoise with a patterned brown shell and a tiny scarf", voice: v("sienna") },
      { id: "hare", name: "Harry Hare", personality: "Fast, boastful, show-offy and easily distracted but not mean underneath", look: "a lanky brown hare with long ears and running shoes", voice: v("cole") },
      { id: "owl", name: "Judge Owl", personality: "Wise, fair and a little sleepy referee of the race", look: "a round brown owl with spectacles holding a little flag", voice: v("sean") },
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
    narratorVoice: v("hannah"),
    characters: [
      { id: "red", name: "Little Red Riding Hood", personality: "Curious, cheerful, friendly and brave girl who loves flowers and her grandma", look: "a young girl with a bright red hooded cape carrying a wicker basket", voice: v("heather") },
      { id: "grandma", name: "Grandma", personality: "Warm, funny, loving grandmother who bakes cookies and tells jokes", look: "a smiling grandmother with round glasses, a white bun and a knitted shawl", voice: v("bree") },
      { id: "wolf", name: "The Wolf", personality: "A sneaky, sweet-talking but bumbling wolf who is more silly than scary", look: "a tall grey wolf with a sly grin and a bushy tail", voice: v("marcus") },
      { id: "woodcutter", name: "The Woodcutter", personality: "Gentle, strong, helpful neighbor who looks out for everyone in the woods", look: "a tall man with a plaid shirt, a beard and a friendly smile", voice: v("bruce") },
    ],
    beats: [
      { title: "A basket for Grandma", goal: "Red's mother sends her with a basket of treats to sick Grandma and tells her to stay on the path" },
      { title: "Into the woods", goal: "Red meets the Wolf, who tricks her into picking flowers off the path" },
      { title: "The tricky wolf", goal: "The Wolf hurries ahead to Grandma's, hides Grandma in the closet, and puts on her nightcap" },
      { title: "What big eyes", goal: "Red arrives and notices Grandma looks very strange: what big eyes, ears and teeth" },
      { title: "Rescue and home", goal: "The Woodcutter chases the Wolf away (no one is hurt), Grandma is found safe, and they share treats; Red promises to stay on the path" },
    ],
  },
  {
    id: "first-christmas",
    title: "The First Christmas",
    emoji: "⭐",
    blurb: "Travel to Bethlehem with Mary and Joseph, then meet the shepherds who hear wonderful news.",
    category: "bible",
    setting: "Bethlehem long ago: a lantern-lit road, a humble stable, and quiet fields beneath a bright star",
    artStyle: CHRISTMAS_ART_STYLE,
    narratorVoice: v("hannah"),
    characters: [
      { id: "mary", name: "Mary", personality: "Gentle, thoughtful, brave, and full of love for her newborn son Jesus", look: "a young woman with warm brown skin, a blue head covering and a simple cream robe", voice: v("sienna") },
      { id: "joseph", name: "Joseph", personality: "Kind, steady, and caring; he helps Mary and keeps the family comfortable", look: "a young man with warm brown skin, short dark hair, a soft beard and a brown robe", voice: v("miles") },
      { id: "angel", name: "The Angel", personality: "Warm and reassuring, bringing joyful news to the shepherds", look: "a gentle glowing angel in a flowing cream robe, with soft wings and a golden halo", voice: v("gemma") },
      { id: "shepherd", name: "A Shepherd", personality: "Curious, humble, and eager to share the joyful news", look: "a friendly shepherd with a weathered face, a woven cloak and a wooden staff", voice: v("kit") },
    ],
    beats: [
      { title: "The road to Bethlehem", goal: "Mary and Joseph travel to Bethlehem for the census; Mary is expecting a baby and Joseph helps her along the lantern-lit road" },
      { title: "A place to rest", goal: "Bethlehem is crowded and there is no guest room; Mary and Joseph find a humble, sheltered place with a manger where they can rest safely" },
      { title: "Baby Jesus is born", goal: "Jesus is born; Mary wraps him warmly and lays him in the manger while Joseph stays beside them" },
      { title: "Good news in the fields", goal: "An angel appears to shepherds watching their sheep at night, calms their fear, and announces the joyful news of Jesus' birth" },
      { title: "The shepherds visit", goal: "The shepherds hurry to Bethlehem, find Mary, Joseph and baby Jesus, and share what the angel told them" },
      { title: "A peaceful Christmas night", goal: "The shepherds return praising God; Mary treasures the moment and the family rests together in peace beneath the starry sky" },
    ],
  },
];

export function getClassicStory(id: string): StoryDef | undefined {
  return CLASSIC_STORIES.find((s) => s.id === id);
}
