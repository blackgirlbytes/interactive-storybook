/** Animate one story action while keeping the picture stable enough to loop. */
export function buildVideoPrompt(scene: string, motion?: string): string {
  return `Animate this children's storybook illustration as one continuous five-second shot. ` +
    `The picture shows: ${scene.trim()} ` +
    `Main motion: ${(motion || "Add gentle movement to one visible character or detail.").trim()} ` +
    "Only move elements already in the picture. Use one clear, small, repeatable action and subtle supporting motion. " +
    "Keep the camera still and preserve the exact character designs, colors, art style and composition. " +
    "Return to the starting pose for a smooth loop. No new characters, dialogue, text or scene cuts.";
}
