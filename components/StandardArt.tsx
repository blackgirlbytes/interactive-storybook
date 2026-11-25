"use client";
import Image from "next/image";

export default function StandardArt({ src, alt, onLoad }: { src: string; alt: string; onLoad?: () => void }) {
  return <Image className="scene-image" src={src} alt={alt} width={1024} height={768} loading="eager" onLoad={onLoad} />;
}
