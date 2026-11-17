"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { listAdventures, type Adventure } from "@/lib/db";
import BlobImage from "./BlobImage";
import Scene from "./Scene";
export default function Adventures() {
  const [items,setItems] = useState<Adventure[]>();
  const [error,setError] = useState("");
  useEffect(() => { let active = true; listAdventures().then(a => { if (active) setItems(a); }).catch(() => { if (active) setError("Your browser couldn’t open the adventure shelf. Please allow local storage."); }); return () => { active = false; }; }, []);
  return <main className="shelf"><p className="eyebrow">YOUR VERY OWN STORY SHELF</p><h1>Little moments.<br/><em>Adventures to keep.</em></h1><p className="muted">Every twist, every new friend, every “what if.” Saved right here.</p><p className="storage-note">Saved on this browser only. Clearing browser data removes these adventures. Original stories never change.</p>{error && <p role="alert" className="error">{error}</p>}{!items && !error && <p role="status">Opening your shelf…</p>}{items?.length === 0 && <section className="empty-state"><span>✧</span><h2>Your next favorite memory starts with a story.</h2><p>Save a version during an adventure and it will be waiting here.</p><Link className="button primary" href="/">Explore the story library →</Link></section>}<div className="story-grid">{items?.map(a => <Link className="story-card" key={a.id} href={`/adventures/${a.id}`}><div className="cover">{a.pages.at(-1)?.image ? <BlobImage blob={a.pages.at(-1)!.image!} alt={a.story.title}/> : <Scene kind={a.story.id}/>}</div><div className="card-text"><span className="card-meta">{new Date(a.createdAt).toLocaleDateString()} · {a.pages.length} pages</span><h3>{a.title}</h3><span className="card-action">Relive the adventure →</span></div></Link>)}</div></main>;
}
