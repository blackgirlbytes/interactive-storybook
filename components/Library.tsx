"use client";
import { useState } from "react";
import Link from "next/link";
import { CLASSIC_STORIES } from "@/lib/stories";
import Scene from "./Scene";
import HeroBook from "./HeroBook";
import StandardArt from "./StandardArt";
const categories = [{ id: "all", label: "All stories" }, { id: "fairy-tale", label: "Fairy tales" }, { id: "bible", label: "Bible stories" }, { id: "fable", label: "Fables" }];
export default function Library() {
  const [category, setCategory] = useState("all");
  return <main className="library">
    <section className="hero"><div className="hero-copy"><p className="eyebrow"><span/> LITTLE VOICES. BIG ADVENTURES.</p><h1>Every story starts<br/>with <em>your imagination.</em></h1><p className="hero-description">Step inside a story. Talk to the characters. Change what happens next.<br className="desktop-break"/> Here, the most magical part of the story is you.</p><Link className="button primary" href="#stories">Find your next adventure <span>↗</span></Link><span className="hero-note">Just bring your voice. We’ll bring the magic.</span></div><div className="hero-art"><div className="orbit-star one">✧</div><HeroBook/></div></section>
    <section className="how-strip" aria-label="How it works"><div><span className="step-icon">01</span><p><strong>Pick a story</strong><span>A familiar favorite or something new</span></p></div><div><span className="step-icon">02</span><p><strong>Make yourself heard</strong><span>Ask, imagine, and change the adventure</span></p></div><div><span className="step-icon">03</span><p><strong>Keep the magic</strong><span>Save your very own version to revisit</span></p></div></section>
    <section id="stories" className="stories-section"><div className="section-heading"><div><p className="eyebrow">THE STORY SHELF</p><h2>A little wonder awaits.</h2></div><span className="small muted">Old favorites. Endless possibilities.</span></div><div className="filters" aria-label="Story categories">{categories.map(c => <button key={c.id} aria-pressed={category === c.id} className={category === c.id ? "selected" : ""} onClick={() => setCategory(c.id)}>{c.label}</button>)}</div><div className="story-grid">{CLASSIC_STORIES.filter(s => category === "all" || s.category === category).map((s, i) => <Link href={`/story/${s.id}`} className="story-card" key={s.id}><div className={`cover cover-${i}`}>{s.id === "first-christmas" ? <StandardArt src="/story-art/first-christmas/beat-0.jpg" alt="Mary and Joseph travel toward Bethlehem beneath a starry sky"/> : <Scene kind={s.id}/>}<span className="cover-badge">{s.category === "bible" ? "Bible story" : s.category === "fable" ? "Fable" : "Fairy tale"}</span><span className="cover-arrow">↗</span></div><div className="card-text"><span className="card-meta">{s.beats.length} chapters · Ages 4–9</span><h3>{s.title}</h3><p>{s.blurb}</p><span className="card-action">Open the story <span>→</span></span></div></Link>)}</div></section>
    <section className="create-banner"><span className="banner-star">✧</span><div><h2>A story nobody’s told before.</h2><p>A moon-dancing dragon? A tiny astronaut? Let’s dream it up together.</p></div><Link href="/create" className="button light">Create your own <span>↗</span></Link></section>
    <footer><Link className="brand" href="/">OnceUpon.</Link><p>Made for little imaginations, and the grown-ups who love them.</p><span>Powered by Deepgram & fal</span></footer>
  </main>;
}
