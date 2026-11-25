import { describe, expect, it } from "vitest";
import { CLASSIC_STORIES } from "@/lib/stories";
import { TurnSchema, extractJson } from "@/lib/engine/schema";
import { StoryStateSchema } from "@/lib/engine/stateSchema";
import { initialState, addChildUtterance, applyTurn } from "@/lib/engine/reducer";
import { buildEngineUser, ENGINE_SYSTEM } from "@/lib/engine/prompts";
import { isLikelyEcho } from "@/lib/engine/echo";
import { buildImagePrompt } from "@/lib/engine/imagePrompt";
import { isAllowedVoice } from "@/lib/voices";

const story = CLASSIC_STORIES.find(s => s.id === "tortoise-and-hare")!;
const turn = (extra = {}) => TurnSchema.parse({ segments: [{ speaker: "narrator", text: "Once upon a time." }], ...extra });
describe("story schema and classics", () => {
  it("has five valid stories and distinct valid character voices", () => {
    expect(CLASSIC_STORIES).toHaveLength(5);
    for (const s of CLASSIC_STORIES) {
      expect(StoryStateSchema.safeParse(initialState(s,"listen")).success).toBe(true);
      const voices = [s.narratorVoice,...s.characters.map(c => c.voice)];
      expect(voices.every(isAllowedVoice)).toBe(true);
      expect(new Set(voices).size).toBe(voices.length);
    }
  });
  it("parses fenced JSON but rejects missing or oversized text", () => {
    expect(extractJson('```json\n{"segments":[]}\n```')).toEqual({ segments: [] });
    expect(() => extractJson("no object")).toThrow();
    expect(TurnSchema.safeParse({ segments: [] }).success).toBe(false);
    expect(TurnSchema.safeParse({ segments: [{ speaker:"narrator",text:"x".repeat(601) }] }).success).toBe(false);
    expect(turn().stateChanges).toEqual({});
  });
  it("rejects out of range current beats", () => {
    expect(StoryStateSchema.safeParse({ ...initialState(story,"play"), beatIndex: story.beats.length }).success).toBe(false);
  });
});
describe("turns and memory", () => {
  it("remembers the child's roller-skate change and preserves the original", () => {
    const state = addChildUtterance(initialState(story,"play"),"The tortoise has roller skates!");
    const changed = applyTurn(state, turn({ stateChanges: { addObjects:["roller skates"],plotNotes:["Tilly has roller skates."] }, imagePrompt:"Tilly Tortoise is wearing roller skates." })).state;
    expect(changed.objects).toContain("roller skates");
    expect(buildEngineUser(changed)).toContain("Tilly has roller skates.");
    expect(state.objects).toEqual([]);
    expect(initialState(story,"play").plotNotes).toEqual([]);
  });
  it("answers as Noah with his own voice", () => {
    const noah = CLASSIC_STORIES[0];
    const reply = applyTurn(addChildUtterance(initialState(noah,"play"),"Noah, why did you build the ark?"),turn({ segments:[{ speaker:"noah",text:"God asked me to keep the animals safe." }] }));
    expect(reply.spoken[0].voice).toBe(noah.characters[0].voice);
    expect(reply.state.log.at(-1)?.kind).toBe("dialogue");
  });
  it("adds a new character once and uses their distinct voice immediately", () => {
    const t = turn({ stateChanges:{ addCharacters:[{name:"Ruby Robot",look:"A little copper robot",personality:"Helpful",voice:"athena"}] },segments:[{speaker:"Ruby Robot",text:"I can help!"}] });
    const first = applyTurn(initialState(story,"play"),t);
    const ruby = first.state.characters.at(-1)!;
    expect(ruby.id).toBe("ruby-robot");
    expect(ruby.voice).not.toBe(story.narratorVoice);
    expect(first.spoken[0].voice).toBe(ruby.voice);
    expect(applyTurn(first.state,t).state.characters).toHaveLength(first.state.characters.length);
  });
  it("does not end early and reaches a bounded final beat", () => {
    let s = initialState(story,"listen");
    expect(applyTurn(s,turn({isEnding:true})).state.ended).toBe(false);
    for(let i=0;i<story.beats.length;i++) s = applyTurn(s,turn({advanceBeat:true})).state;
    expect(s.beatIndex).toBe(story.beats.length-1);
    expect(applyTurn(s,turn({isEnding:true})).state.ended).toBe(true);
  });
  it("includes character appearance in the picture prompt", () => {
    const p = buildImagePrompt("Tilly Tortoise skates past Harry Hare, a lanky brown hare with long ears and running shoes, who is boasting","Watercolor",story.characters);
    expect(p).toContain("patterned brown shell");
    expect(p).not.toMatch(/Tilly|Harry/);
    expect(p.match(/lanky brown hare/g)).toHaveLength(1);
  });
  it("has explicit child safety and listen-mode rules", () => {
    expect(ENGINE_SYSTEM).toContain("Never ask for or repeat personal information");
    expect(ENGINE_SYSTEM).toContain("In LISTEN mode it is always false");
  });
  it("filters likely narration echo, not a new idea", () => {
    expect(isLikelyEcho("the hare went to sleep","The hare went to sleep beneath the oak.")).toBe(true);
    expect(isLikelyEcho("give the tortoise roller skates","The hare went to sleep beneath the oak.")).toBe(false);
  });
});
