"use client";
import { useEffect, useState } from "react";
import Scene from "./Scene";

const LINE = "What if the tortoise had roller skates?";

// The hero's one moment: a child's question is "heard" as the book's page
// text, and the moment it finishes, the tortoise's skates appear.
export default function HeroBook() {
  const [typed, setTyped] = useState(0);
  const [heard, setHeard] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    let interval = 0;
    timers.push(window.setTimeout(() => {
      if (reduced) { setTyped(LINE.length); setHeard(true); return; }
      let n = 0;
      interval = window.setInterval(() => {
        n += 1;
        setTyped(n);
        if (n >= LINE.length) {
          window.clearInterval(interval);
          timers.push(window.setTimeout(() => setHeard(true), 300));
        }
      }, 45);
    }, reduced ? 0 : 1100));
    return () => { timers.forEach(id => window.clearTimeout(id)); window.clearInterval(interval); };
  }, []);
  const speaking = typed > 0 && typed < LINE.length;
  const done = typed >= LINE.length;
  return <div className="hero-book">
    <Scene reveal={heard}/>
    <div className="book-page">
      <span className={`voice-mark${speaking ? " speaking" : ""}`} aria-hidden="true"><i/><i/><i/><i/></span>
      <p className="book-line">
        <span className="sr-only">“{LINE}”</span>
        <span className="ghost" aria-hidden="true">“{LINE}”</span>
        <span aria-hidden="true">“{LINE.slice(0, typed)}{done ? "”" : <span className="caret"/>}</span>
      </p>
    </div>
  </div>;
}
