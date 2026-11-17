/** Motion prompt for turning a finished story picture into a short looping clip. */
export function buildVideoPrompt(scene: string): string {
  return `Gently animate this children's storybook illustration. ${scene.trim()} ` +
    "The characters move naturally and expressively, and small details come alive: leaves, grass, water, clouds, light. " +
    "Slow, steady camera. Keep the exact art style, colors, characters and composition. No new characters, no text, no scene cuts.";
}
