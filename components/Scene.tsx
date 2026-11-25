"use client";
import { useEffect, useRef } from "react";
import { sceneLabel } from "@/lib/art/paint";
import type { ScenePlayer } from "@/lib/art/scenes";

// A living illustration for a story. p5 only runs in the browser, so it loads
// after mount; the sketch pauses while scrolled out of view and stays still
// for people who prefer reduced motion.
// `reveal` lets a page hold back a scene's surprise (the tortoise's skates)
// until its own moment; it defaults to showing everything.
export default function Scene({ kind = "tortoise-and-hare", className = "", reveal = true }: { kind?: string; className?: string; reveal?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const revealed = useRef(reveal);
  const playerRef = useRef<ScenePlayer | undefined>(undefined);
  useEffect(() => { revealed.current = reveal; playerRef.current?.setReveal(reveal); }, [reveal]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let player: ScenePlayer | undefined;
    let cancelled = false;
    let visible = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!player || reduced) return;
      if (visible) player.loop(); else player.noLoop();
    });
    const resized = new ResizeObserver(() => player?.relayout());
    seen.observe(el);
    resized.observe(el);
    void Promise.all([import("p5"), import("@/lib/art/scenes")]).then(([{ default: P5 }, { sceneSketch }]) => {
      if (cancelled) return;
      player = new P5(sceneSketch(kind, el, reduced, revealed.current), el) as ScenePlayer;
      playerRef.current = player;
      if (!visible && !reduced) player.noLoop();
    });
    return () => { cancelled = true; seen.disconnect(); resized.disconnect(); player?.remove(); playerRef.current = undefined; };
  }, [kind]);
  return <div ref={host} className={`scene-art ${className}`} role="img" aria-label={sceneLabel(kind)} />;
}
