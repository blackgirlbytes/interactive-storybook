"use client";
import { useEffect, useState } from "react";
import BlobImage from "./BlobImage";
import StandardArt from "./StandardArt";
import Scene from "./Scene";

interface Art {
  image?: Blob;
  url?: string;
  kind: string;
  alt: string;
}

function sameArt(a: Art, b: Art) {
  return a.image === b.image && a.url === b.url && a.kind === b.kind;
}

function ArtView({ art, onLoad }: { art: Art; onLoad?: () => void }) {
  if (art.image) return <BlobImage blob={art.image} alt={art.alt} onLoad={onLoad}/>;
  if (art.url) return <StandardArt src={art.url} alt={art.alt} onLoad={onLoad}/>;
  return <Scene kind={art.kind}/>;
}

/** Keep the old picture visible until its replacement loads, then fade between them. */
export default function StoryIllustration({ image, url, kind, alt }: Art) {
  const [layers, setLayers] = useState<{ shown: Art; next?: Art; revealed: boolean }>(() => ({
    shown: { image, url, kind, alt }, revealed: false,
  }));
  const target = { image, url, kind, alt };
  if (!sameArt(layers.next ?? layers.shown, target)) {
    setLayers(current => {
      if (sameArt(current.next ?? current.shown, target)) return current;
      if (sameArt(current.shown, target)) return { shown: current.shown, revealed: false };
      return { shown: current.revealed && current.next ? current.next : current.shown,
        next: target, revealed: !image && !url };
    });
  }

  useEffect(() => {
    if (!layers.next || !layers.revealed) return;
    const next = layers.next;
    const timer = setTimeout(() => setLayers(current => current.next === next
      ? { shown: next, revealed: false } : current), 550);
    return () => clearTimeout(timer);
  }, [layers.next, layers.revealed]);

  return <>
    <div className="story-art-layer"><ArtView art={{ ...layers.shown, alt }}/></div>
    {layers.next && <div className={`story-art-layer incoming${layers.revealed ? " ready" : ""}`}>
      <ArtView art={layers.next} onLoad={() => setLayers(current => current.next === layers.next
        ? { ...current, revealed: true } : current)}/>
    </div>}
  </>;
}
