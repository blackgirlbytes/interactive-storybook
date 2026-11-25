import Image from "next/image";

export default function StandardArt({ src, alt }: { src: string; alt: string }) {
  return <Image className="scene-image" src={src} alt={alt} width={1024} height={768} />;
}
