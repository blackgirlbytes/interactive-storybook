"use client";
import { useEffect, useRef } from "react";
export default function BlobImage({ blob, alt, onLoad }: { blob: Blob; alt: string; onLoad?: () => void }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => { const src = URL.createObjectURL(blob); if (image.current) image.current.src = src; return () => URL.revokeObjectURL(src); }, [blob]);
  // Generated scene data lives locally, not behind a remote image loader.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={image} className="scene-image" alt={alt} onLoad={onLoad}/>;
}
