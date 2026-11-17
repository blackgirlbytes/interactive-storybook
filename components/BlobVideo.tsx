"use client";
import { useEffect, useRef } from "react";
/** Muted looping scene clip that fades in over the still picture once it starts playing. */
export default function BlobVideo({ blob, label }: { blob: Blob; label: string }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const src = URL.createObjectURL(blob);
    el.classList.remove("ready");
    el.src = src;
    void el.play().catch(() => {});
    return () => { el.removeAttribute("src"); el.load(); URL.revokeObjectURL(src); };
  }, [blob]);
  return <video ref={video} className="scene-video" aria-label={label} muted loop autoPlay playsInline onPlaying={e => e.currentTarget.classList.add("ready")}/>;
}
