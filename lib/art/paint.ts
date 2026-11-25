// Static layers for the moonlit story scenes: skies, land, buildings, and
// rigid sprites, painted once per size with Canvas 2D. Depth comes from light:
// layered gradients, atmospheric perspective, rim-lit silhouettes, warm
// lamplight against cool moonlight, and paper grain. Everything that moves is
// drawn each frame by the p5 sketches in ./scenes.ts.

export const ART_W = 600;
export const ART_H = 440;
const TAU = Math.PI * 2;

type C = CanvasRenderingContext2D;
export type Pt = { x: number; y: number };
export type P = { c: C; r: () => number; n: Noise; light: Pt; s: number };
export type Ground = (x: number) => number;

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export class Noise {
  private v: number[];
  constructor(r: () => number, size = 512) { this.v = Array.from({ length: size }, r); }
  at(x: number) {
    const n = this.v.length, i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
    const a = this.v[((i % n) + n) % n], b = this.v[(((i + 1) % n) + n) % n];
    return a + (b - a) * s;
  }
  fbm(x: number, octaves = 4) {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o++) { sum += amp * this.at(x * freq + o * 31.7); norm += amp; amp *= 0.5; freq *= 2.03; }
    return sum / norm;
  }
}

export const rnd = (p: P, a: number, b: number) => a + (b - a) * p.r();
const pick = <T,>(p: P, list: T[]) => list[Math.floor(p.r() * list.length)];

export function rgba(hex: string, a = 1) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function blur(p: P, px: number) { p.c.filter = px > 0 ? `blur(${px * p.s}px)` : "none"; }

export function ellipse(c: C, x: number, y: number, rx: number, ry: number, rot = 0) {
  c.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
}

/** A local coordinate frame for characters: scale, mirror, and place. */
export function frame(c: C, ox: number, oy: number, s: number, flip = 1) {
  return {
    e: (x: number, y: number, rx: number, ry: number, rot = 0) => ellipse(c, ox + x * s * flip, oy + y * s, rx * s, ry * s, rot * flip),
    m: (x: number, y: number) => c.moveTo(ox + x * s * flip, oy + y * s),
    l: (x: number, y: number) => c.lineTo(ox + x * s * flip, oy + y * s),
    q: (cx: number, cy: number, x: number, y: number) => c.quadraticCurveTo(ox + cx * s * flip, oy + cy * s, ox + x * s * flip, oy + y * s),
    b: (c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) =>
      c.bezierCurveTo(ox + c1x * s * flip, oy + c1y * s, ox + c2x * s * flip, oy + c2y * s, ox + x * s * flip, oy + y * s),
    pt: (x: number, y: number): Pt => ({ x: ox + x * s * flip, y: oy + y * s }),
  };
}

// ---------- light ----------

export function glow(p: P, x: number, y: number, radius: number, hex: string, a: number, mode: GlobalCompositeOperation = "screen") {
  const { c } = p;
  c.save();
  c.globalCompositeOperation = mode;
  const g = c.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, rgba(hex, a));
  g.addColorStop(0.3, rgba(hex, a * 0.5));
  g.addColorStop(1, rgba(hex, 0));
  c.fillStyle = g;
  c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  c.restore();
}

/** A pool of light flattened onto the ground. */
function pool(p: P, x: number, y: number, radius: number, hex: string, a: number) {
  const { c } = p;
  c.save();
  c.translate(x, y); c.scale(1, 0.3); c.translate(-x, -y);
  glow(p, x, y, radius, hex, a);
  c.restore();
}

/**
 * Fill a silhouette with a soft rim of light on the side facing `light`.
 * The rim is drawn first, then a blurred dark copy nudged away from the light.
 */
export function rimLit(p: P, anchor: Pt, build: (c: C) => void, dark: string, rim: string, k = 1.5, light = p.light) {
  const { c } = p;
  const dx = light.x - anchor.x, dy = light.y - anchor.y, d = Math.hypot(dx, dy) || 1;
  c.save();
  c.beginPath(); build(c);
  c.fillStyle = dark; c.fill();
  c.clip();
  c.fillStyle = rim; c.fill();
  c.translate((-dx / d) * k, (-dy / d) * k);
  blur(p, k * 0.45);
  c.beginPath(); build(c);
  c.fillStyle = dark; c.fill();
  c.restore();
}

// ---------- sky ----------

function sky(p: P, stops: [number, string][]) {
  const g = p.c.createLinearGradient(0, 0, 0, ART_H);
  for (const [o, col] of stops) g.addColorStop(o, col);
  p.c.fillStyle = g;
  p.c.fillRect(0, 0, ART_W, ART_H);
}

function stars(p: P, count: number, maxY: number, moon: Pt) {
  const { c } = p;
  for (let i = 0; i < count; i++) {
    const x = rnd(p, 0, ART_W), y = Math.pow(p.r(), 1.5) * maxY;
    const fade = Math.min(1, Math.hypot(x - moon.x, y - moon.y) / 140) * (1 - (y / maxY) * 0.55);
    const size = Math.pow(p.r(), 3.2) * 1.3 + 0.22;
    const col = pick(p, ["#ffffff", "#fff1d6", "#d5e2ff", "#ffffff"]);
    c.fillStyle = rgba(col, rnd(p, 0.35, 1) * fade);
    c.beginPath(); c.arc(x, y, size, 0, TAU); c.fill();
    if (size > 1.15 && fade > 0.75) {
      glow(p, x, y, size * 7, col, 0.45);
      c.save();
      c.strokeStyle = rgba(col, 0.35); c.lineWidth = 0.35;
      c.beginPath(); c.moveTo(x - size * 7, y); c.lineTo(x + size * 7, y); c.moveTo(x, y - size * 7); c.lineTo(x, y + size * 7); c.stroke();
      c.restore();
    }
  }
}

function moon(p: P, x: number, y: number, R: number, warm = 0) {
  const { c } = p;
  glow(p, x, y, R * 11, "#6f86e0", 0.2);
  glow(p, x, y, R * 4.5, warm ? "#ffd9a0" : "#ffeccc", 0.32);
  glow(p, x, y, R * 1.9, "#fff4dc", 0.55);
  c.save();
  c.beginPath(); c.arc(x, y, R, 0, TAU); c.clip();
  const g = c.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.1, x, y, R);
  g.addColorStop(0, "#fffdf5");
  g.addColorStop(1, warm ? "#f2d29a" : "#eedcb4");
  c.fillStyle = g; c.fillRect(x - R, y - R, R * 2, R * 2);
  blur(p, R * 0.05);
  for (let i = 0; i < 12; i++) {
    const a = rnd(p, 0, TAU), d = Math.sqrt(p.r()) * R * 0.7, rx = rnd(p, 0.12, 0.34) * R;
    c.fillStyle = rgba("#b4a07a", rnd(p, 0.14, 0.3));
    c.beginPath(); ellipse(c, x + Math.cos(a) * d, y + Math.sin(a) * d, rx, rx * rnd(p, 0.55, 1), rnd(p, 0, TAU)); c.fill();
  }
  blur(p, 0);
  for (let i = 0; i < 22; i++) {
    const a = rnd(p, 0, TAU), d = Math.sqrt(p.r()) * R * 0.85;
    c.fillStyle = rgba("#a08b66", 0.16);
    c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rnd(p, 0.02, 0.06) * R, 0, TAU); c.fill();
  }
  const limb = c.createRadialGradient(x, y, R * 0.55, x, y, R);
  limb.addColorStop(0, "rgba(0,0,0,0)");
  limb.addColorStop(1, "rgba(110,85,50,.35)");
  c.fillStyle = limb; c.fillRect(x - R, y - R, R * 2, R * 2);
  c.restore();
}

function clouds(p: P, cx: number, cy: number, width: number, col: string, a: number, lit = "#cfd3ff") {
  const { c } = p;
  c.save();
  blur(p, 4);
  for (let i = 0; i < 46; i++) {
    const x = cx + rnd(p, -0.5, 0.5) * width, y = cy + rnd(p, -1, 1) * 7;
    c.fillStyle = rgba(col, a * rnd(p, 0.4, 1));
    c.beginPath(); ellipse(c, x, y, rnd(p, 16, 46), rnd(p, 4, 10)); c.fill();
  }
  blur(p, 2.5);
  for (let i = 0; i < 26; i++) {
    const x = cx + rnd(p, -0.45, 0.45) * width, y = cy - rnd(p, 3, 9);
    const near = Math.max(0, 1 - Math.abs(x - p.light.x) / 260);
    c.fillStyle = rgba(lit, a * 0.45 * (0.3 + near));
    c.beginPath(); ellipse(c, x, y, rnd(p, 10, 34), rnd(p, 1.5, 3.5)); c.fill();
  }
  c.restore();
}

function mist(p: P, y: number, h: number, col: string, a: number) {
  const g = p.c.createLinearGradient(0, y - h, 0, y + h);
  g.addColorStop(0, rgba(col, 0));
  g.addColorStop(0.5, rgba(col, a));
  g.addColorStop(1, rgba(col, 0));
  p.c.fillStyle = g;
  p.c.fillRect(0, y - h, ART_W, h * 2);
}

// ---------- land ----------

function ridge(p: P, o: { base: number; amp: number; freq: number; off: number; top: string; bottom: string; rim?: string; rimA?: number }): Ground {
  const { c } = p;
  const ys: number[] = [];
  for (let x = 0; x <= ART_W; x++) ys.push(o.base - o.amp * (p.n.fbm(x * o.freq + o.off) - 0.5) * 2);
  const ground: Ground = x => ys[Math.max(0, Math.min(ART_W, Math.round(x)))];
  const top = Math.min(...ys);
  c.beginPath(); c.moveTo(0, ART_H);
  ys.forEach((y, x) => c.lineTo(x, y));
  c.lineTo(ART_W, ART_H); c.closePath();
  const g = c.createLinearGradient(0, top, 0, ART_H);
  g.addColorStop(0, o.top); g.addColorStop(1, o.bottom);
  c.fillStyle = g; c.fill();
  if (o.rim) {
    const a = o.rimA ?? 0.4, lx = Math.max(0.01, Math.min(0.99, p.light.x / ART_W));
    const h = c.createLinearGradient(0, 0, ART_W, 0);
    h.addColorStop(0, rgba(o.rim, a * (lx < 0.3 ? 0.8 : 0.2)));
    h.addColorStop(lx, rgba(o.rim, a));
    h.addColorStop(1, rgba(o.rim, a * (lx > 0.7 ? 0.8 : 0.2)));
    c.save();
    c.strokeStyle = h; c.lineWidth = 1.1;
    blur(p, 0.5);
    c.beginPath(); ys.forEach((y, x) => (x ? c.lineTo(x, y + 0.4) : c.moveTo(x, y + 0.4))); c.stroke();
    c.restore();
  }
  return ground;
}

function grass(p: P, ground: Ground, from: number, to: number, count: number, dark: string, tip: string, hMin = 4, hMax = 14, depth = 14) {
  const { c } = p;
  c.save(); c.lineCap = "round";
  for (let i = 0; i < count; i++) {
    const x = rnd(p, from, to), y = ground(x) + Math.pow(p.r(), 1.4) * depth, h = rnd(p, hMin, hMax) * (0.6 + (y - ground(x)) / depth * 0.6);
    const lean = (p.n.at(x * 0.04 + 50) - 0.5) * h * 1.1 + rnd(p, -2, 2);
    c.strokeStyle = p.r() < 0.16 ? rgba(tip, rnd(p, 0.25, 0.6)) : rgba(dark, rnd(p, 0.75, 1));
    c.lineWidth = rnd(p, 0.45, 1.1);
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + lean * 0.25, y - h * 0.6, x + lean, y - h); c.stroke();
  }
  c.restore();
}

function flowers(p: P, ground: Ground, count: number, cols: string[], depth = 30) {
  const { c } = p;
  for (let i = 0; i < count; i++) {
    const x = rnd(p, 0, ART_W), y = ground(x) + rnd(p, 2, depth), col = pick(p, cols);
    c.fillStyle = rgba(col, rnd(p, 0.45, 0.85));
    c.beginPath(); c.arc(x, y, rnd(p, 0.6, 1.5), 0, TAU); c.fill();
  }
}

function tree(p: P, x: number, base: number, h: number, dark: string, rim: string) {
  const trunk = (c: C) => {
    c.moveTo(x - h * 0.03, base);
    c.quadraticCurveTo(x - h * 0.012, base - h * 0.35, x - h * 0.01, base - h * 0.62);
    c.lineTo(x + h * 0.01, base - h * 0.62);
    c.quadraticCurveTo(x + h * 0.014, base - h * 0.35, x + h * 0.032, base);
    c.closePath();
  };
  rimLit(p, { x, y: base - h * 0.3 }, trunk, dark, rim, 1.2);
  const cx = x + rnd(p, -0.04, 0.04) * h, cy = base - h * 0.66, rx = h * 0.3, ry = h * 0.36;
  // a canopy of several clumps, each made of hundreds of small leaves, so the
  // silhouette edge is ragged and leafy rather than a cluster of bubbles
  const blobs: { x: number; y: number; r: number }[] = [];
  const clumps = Array.from({ length: 7 }, () => {
    const a = rnd(p, 0, TAU), d = Math.sqrt(p.r()) * 0.55;
    return { x: cx + Math.cos(a) * d * rx, y: cy + Math.sin(a) * d * ry, rx: rx * rnd(p, 0.4, 0.62), ry: ry * rnd(p, 0.38, 0.55) };
  });
  for (const cl of clumps) {
    for (let i = 0; i < 70; i++) {
      const a = rnd(p, 0, TAU), d = Math.pow(p.r(), 0.6);
      blobs.push({ x: cl.x + Math.cos(a) * d * cl.rx, y: cl.y + Math.sin(a) * d * cl.ry, r: rx * rnd(p, 0.035, 0.09) * (1.3 - d * 0.5) });
    }
  }
  const canopy = (c: C) => { for (const b of blobs) { c.moveTo(b.x + b.r, b.y); c.arc(b.x, b.y, b.r, 0, TAU); } };
  rimLit(p, { x: cx, y: cy }, canopy, dark, rim, h * 0.009);
  // leaf speckle on the lit side
  const { c } = p;
  c.save(); c.beginPath(); canopy(c); c.clip();
  const dx = p.light.x - cx, dy = p.light.y - cy, d = Math.hypot(dx, dy) || 1;
  for (let i = 0; i < 1100; i++) {
    const a = rnd(p, 0, TAU), rr = Math.sqrt(p.r());
    const px = cx + Math.cos(a) * rr * rx * 1.1, py = cy + Math.sin(a) * rr * ry * 1.1;
    const facing = ((px - cx) * dx + (py - cy) * dy) / (d * rx);
    const lit = facing > 0.15;
    c.fillStyle = lit ? rgba(rim, 0.05 + 0.16 * Math.min(1, facing)) : rgba(pick(p, ["#1c2a52", "#22305e", "#141c3e"]), 0.5);
    c.beginPath(); ellipse(c, px, py, rnd(p, 0.6, 1.8), rnd(p, 0.35, 0.9), rnd(p, 0, TAU)); c.fill();
  }
  c.restore();
}

function conifer(p: P, x: number, base: number, h: number, w: number, dark: string, rim: string, k = 1.2, light = p.light) {
  const tiers = Math.round(h / 9) + 4;
  const left: Pt[] = [], right: Pt[] = [];
  for (let i = 1; i <= tiers; i++) {
    const t = i / tiers, y = base - h + t * h * 0.9, step = (h * 0.9) / tiers;
    const half = w * 0.5 * Math.pow(t, 0.9) * rnd(p, 0.8, 1.15);
    left.push({ x: x - half, y: y + rnd(p, -1, 1) }, { x: x - half * rnd(p, 0.45, 0.65), y: y + step * 0.35 });
    const half2 = w * 0.5 * Math.pow(t, 0.9) * rnd(p, 0.8, 1.15);
    right.push({ x: x + half2, y: y + rnd(p, -1, 1) }, { x: x + half2 * rnd(p, 0.45, 0.65), y: y + step * 0.35 });
  }
  const build = (c: C) => {
    c.moveTo(x, base - h);
    for (const q of left) c.lineTo(q.x, q.y);
    c.lineTo(x - w * 0.05, base - h * 0.06); c.lineTo(x - w * 0.05, base); c.lineTo(x + w * 0.05, base); c.lineTo(x + w * 0.05, base - h * 0.06);
    for (let i = right.length - 1; i >= 0; i--) c.lineTo(right[i].x, right[i].y);
    c.closePath();
  };
  rimLit(p, { x, y: base - h * 0.5 }, build, dark, rim, k, light);
}

function treeline(p: P, ground: Ground, from: number, to: number, hMin: number, hMax: number, dark: string, rim: string, density = 0.55, k = 0.8) {
  for (let x = from; x < to; x += rnd(p, 3, 9)) {
    if (p.n.at(x * 0.02 + 300) < 1 - density) continue;
    const h = rnd(p, hMin, hMax);
    conifer(p, x, ground(x) + 3, h, h * rnd(p, 0.38, 0.5), dark, rim, k);
  }
}

// ---------- finishing ----------

/** Paper grain over the whole canvas, in device pixels. */
function grain(canvas: HTMLCanvasElement) {
  const c = canvas.getContext("2d");
  if (!c) return;
  const W = canvas.width, H = canvas.height, img = c.getImageData(0, 0, W, H), d = img.data;
  let seed = 1234567;
  for (let i = 0; i < d.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const g = ((seed >>> 24) - 128) * 0.08;
    d[i] += g; d[i + 1] += g; d[i + 2] += g;
  }
  c.putImageData(img, 0, 0);
}

/** A soft dark vignette, painted once into its own transparent layer. */
export function paintVignette(canvas: HTMLCanvasElement) {
  const c = canvas.getContext("2d");
  if (!c) return;
  const W = canvas.width, H = canvas.height;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, W, H);
  const v = c.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.32, W / 2, H * 0.5, Math.max(W, H) * 0.78);
  v.addColorStop(0, "rgba(4,6,20,0)");
  v.addColorStop(1, "rgba(4,6,20,.6)");
  c.fillStyle = v; c.fillRect(0, 0, W, H);
  c.restore();
}

// ---------- backdrops ----------

export type Window = { x: number; y: number; w: number; round: boolean };
export type Layout = {
  light: Pt;
  moon: Pt & { r: number };
  front: Ground;
  skyBottom: number;
  fireflies?: [number, number, number, number];
  grassFrom?: number;
  grassTo?: number;
  warm?: Pt;
  horizon?: number;
  waterline?: number;
  arkX?: number;
  windows?: Window[];
  chimney?: Pt;
  wolf?: Pt;
  red?: Pt;
  hand?: Pt;
};

function meadowBackdrop(p: P, racers: boolean): Layout {
  p.light = { x: 455, y: 95 };
  sky(p, [[0, "#050919"], [0.45, "#131c47"], [0.75, "#283270"], [1, "#3b3a6c"]]);
  stars(p, 260, 300, p.light);
  moon(p, 455, 95, 34);
  clouds(p, 190, 128, 260, "#2a3470", 0.28);
  clouds(p, 530, 178, 220, "#303a7a", 0.22);
  mist(p, 262, 26, "#5c68b4", 0.16);
  const far = ridge(p, { base: 268, amp: 20, freq: 0.006, off: 10, top: "#283066", bottom: "#212957", rim: "#9fb0ff", rimA: 0.3 });
  treeline(p, far, 0, 600, 9, 22, "#1f2752", "#8090e0", 0.5, 0.6);
  mist(p, 298, 22, "#6c78c0", 0.14);
  const mid = ridge(p, { base: 316, amp: 24, freq: 0.004, off: 50, top: "#1b2347", bottom: "#141a39", rim: "#a9b6ff", rimA: 0.45 });
  if (racers) {
    // the finish line, far away on the hill
    const fx = 528, fy = mid(fx);
    p.c.strokeStyle = "#0d1230"; p.c.lineWidth = 1.2;
    p.c.beginPath(); p.c.moveTo(fx, fy); p.c.lineTo(fx, fy - 22); p.c.stroke();
    rimLit(p, { x: fx + 6, y: fy - 19 }, c => { c.moveTo(fx, fy - 22); c.quadraticCurveTo(fx + 7, fy - 21, fx + 13, fy - 18.5); c.lineTo(fx, fy - 15); c.closePath(); }, "#8a2a2a", "#ffb07a", 0.8);
  }
  tree(p, 44, 402, 270, "#0b1030", "#5d6dbb");
  tree(p, 132, 392, 190, "#0e1438", "#6979c6");
  tree(p, 572, 408, 240, "#0b1030", "#7c8ce0");
  const front = ridge(p, { base: 372, amp: 15, freq: 0.005, off: 90, top: "#111734", bottom: "#090d22", rim: "#b9c4ff", rimA: 0.5 });
  grass(p, front, 0, 600, 900, "#090e25", "#8d9be0", 4, 12, 50);
  flowers(p, front, 70, ["#e8dcff", "#ffe2b8", "#fff1b8"], 50);
  if (!racers) pool(p, 300, 390, 160, "#7f8de0", 0.1);
  return { light: p.light, moon: { x: 455, y: 95, r: 34 }, front, skyBottom: 260, fireflies: [30, 570, 230, 400], grassFrom: 0, grassTo: 600 };
}

function arkBackdrop(p: P): Layout {
  p.light = { x: 150, y: 90 };
  const horizon = 300;
  sky(p, [[0, "#04081a"], [0.5, "#121a45"], [0.68, "#2a3470"], [0.7, "#3c4380"], [1, "#3c4380"]]);
  stars(p, 280, 280, p.light);
  const { c } = p;
  // a pale moonbow behind the ark
  c.save();
  c.beginPath(); c.rect(0, 0, ART_W, horizon); c.clip();
  blur(p, 4);
  c.globalCompositeOperation = "screen";
  ["#ff9a8a", "#ffd086", "#fff1a0", "#a6efb6", "#98c4ff", "#c1a8ff"].forEach((col, i) => {
    c.strokeStyle = rgba(col, 0.085); c.lineWidth = 8;
    c.beginPath(); c.arc(400, horizon + 40, 215 - i * 7.5, Math.PI, TAU); c.stroke();
  });
  c.restore();
  moon(p, 150, 90, 30);
  clouds(p, 330, 250, 560, "#323c7c", 0.3);
  // a mountain far away, where the ark will land
  rimLit(p, { x: 545, y: 270 }, cc => { cc.moveTo(470, horizon); cc.quadraticCurveTo(520, 262, 548, 246); cc.quadraticCurveTo(575, 262, 610, horizon); cc.closePath(); }, "#262d62", "#8592da", 1.4);
  mist(p, horizon - 4, 14, "#7d88cc", 0.2);
  const sea = c.createLinearGradient(0, horizon, 0, ART_H);
  sea.addColorStop(0, "#2b346f"); sea.addColorStop(0.25, "#1a2253"); sea.addColorStop(1, "#080d28");
  c.fillStyle = sea; c.fillRect(0, horizon, ART_W, ART_H - horizon);
  c.save(); c.lineCap = "round";
  for (let i = 0; i < 1500; i++) {
    const t = Math.pow(p.r(), 1.7), y = horizon + t * (ART_H - horizon), x = rnd(p, -10, 610), len = 2 + t * 26 * p.r();
    const lit = p.r() < 0.55;
    c.strokeStyle = lit ? rgba("#6a78bd", rnd(p, 0.1, 0.3) * (1 - t * 0.4)) : rgba("#050820", rnd(p, 0.25, 0.55));
    c.lineWidth = 0.35 + t * 1.3;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + len / 2, y - 0.6 - t, x + len, y); c.stroke();
  }
  c.restore();
  glow(p, 150, horizon + 4, 90, "#ffe7b8", 0.18);
  return { light: p.light, moon: { x: 150, y: 90, r: 30 }, front: () => ART_H, skyBottom: horizon - 20, horizon, waterline: 362, arkX: 368 };
}

function house(p: P, kind: "straw" | "sticks" | "brick", x: number, y: number, w: number, h: number): { window: Window; chimney?: Pt } {
  const { c } = p;
  const L = x - w / 2, R = x + w / 2, T = y - h;
  const wall = (cc: C) => cc.rect(L, T, w, h);
  const walls = { straw: "#4f4028", sticks: "#3f3124", brick: "#45241f" }[kind];
  const rim = "#aab3ea";
  if (kind === "brick") rimLit(p, { x: R - 14, y: T - 30 }, cc => cc.rect(R - 20, T - 44, 11, 34), "#3a1d1a", rim, 1.2);
  rimLit(p, { x, y: y - h / 2 }, wall, walls, rim, 1.6);
  c.save(); c.beginPath(); wall(c); c.clip();
  if (kind === "brick") {
    for (let row = 0, yy = T; yy < y; row++, yy += 5.5) {
      for (let xx = L - (row % 2) * 5.5; xx < R; xx += 11) {
        c.fillStyle = rgba(pick(p, ["#7b3a30", "#5e2a24", "#8a4536"]), rnd(p, 0.15, 0.4));
        c.fillRect(xx + 0.5, yy + 0.5, 10, 4.5);
      }
    }
  } else if (kind === "sticks") {
    for (let xx = L; xx < R; xx += rnd(p, 2.5, 4.5)) {
      c.strokeStyle = rgba(pick(p, ["#6a5238", "#2a1f16", "#7a6040"]), rnd(p, 0.4, 0.8)); c.lineWidth = rnd(p, 1.2, 2.4);
      c.beginPath(); c.moveTo(xx, T - 2); c.lineTo(xx + rnd(p, -1.5, 1.5), y + 1); c.stroke();
    }
  } else {
    for (let i = 0; i < 260; i++) {
      const xx = rnd(p, L, R), yy = rnd(p, T, y);
      c.strokeStyle = rgba(pick(p, ["#9c8656", "#2a2012"]), rnd(p, 0.15, 0.4)); c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + rnd(p, -1, 1), yy + rnd(p, 3, 7)); c.stroke();
    }
  }
  const shade = c.createLinearGradient(L, 0, R, 0);
  const lit = p.light.x > x;
  shade.addColorStop(0, lit ? "rgba(5,7,25,.45)" : "rgba(150,165,240,.12)");
  shade.addColorStop(1, lit ? "rgba(150,165,240,.12)" : "rgba(5,7,25,.45)");
  c.fillStyle = shade; c.fillRect(L, T, w, h);
  c.restore();
  const over = 8;
  const roof = kind === "straw"
    ? (cc: C) => { cc.moveTo(L - over, T + 5); cc.quadraticCurveTo(L - 2, T - h * 0.85, x, T - h * 0.9); cc.quadraticCurveTo(R + 2, T - h * 0.85, R + over, T + 5); cc.closePath(); }
    : (cc: C) => { cc.moveTo(L - over, T + 3); cc.lineTo(x, T - h * 0.72); cc.lineTo(R + over, T + 3); cc.closePath(); };
  rimLit(p, { x, y: T - h * 0.35 }, roof, { straw: "#3a2e1a", sticks: "#2b2018", brick: "#26161c" }[kind], kind === "straw" ? "#cdbf8e" : rim, 1.8);
  c.save(); c.beginPath(); roof(c); c.clip();
  for (let i = 0; i < (kind === "straw" ? 520 : 160); i++) {
    const xx = rnd(p, L - over, R + over), yy = rnd(p, T - h * 0.9, T + 5), len = rnd(p, 4, 9);
    const dir = xx < x ? -1 : 1;
    c.strokeStyle = rgba(pick(p, kind === "straw" ? ["#b39a5c", "#1d160b", "#8a7444"] : ["#4a3428", "#120c0a"]), rnd(p, 0.18, 0.45));
    c.lineWidth = kind === "straw" ? 0.6 : 1.4;
    c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + dir * len * 0.5, yy + len); c.stroke();
  }
  c.restore();
  c.fillStyle = "#0f0906";
  const dw = w * 0.2, dh = h * 0.5, dx = x + (kind === "brick" ? w * 0.18 : -w * 0.16);
  c.beginPath(); c.moveTo(dx - dw / 2, y); c.lineTo(dx - dw / 2, y - dh + dw / 2); c.arc(dx, y - dh + dw / 2, dw / 2, Math.PI, TAU); c.lineTo(dx + dw / 2, y); c.closePath(); c.fill();
  if (kind === "straw") { c.fillStyle = rgba("#ffb555", 0.85); c.fillRect(dx + dw / 2 - 1.6, y - dh + dw / 2, 1.6, dh - dw / 2); }
  const wx = x + (kind === "brick" ? -w * 0.18 : w * 0.2), wy = y - h * 0.58, ww = w * 0.22, round = kind === "straw";
  glow(p, wx, wy, w * 0.9, "#ffaa48", 0.3);
  const g = c.createRadialGradient(wx, wy, 0, wx, wy, ww);
  g.addColorStop(0, "#fff0b8"); g.addColorStop(1, "#ffa63f");
  c.fillStyle = g;
  c.beginPath();
  if (round) c.arc(wx, wy, ww * 0.5, 0, TAU); else c.rect(wx - ww / 2, wy - ww * 0.45, ww, ww * 0.9);
  c.fill();
  c.strokeStyle = "#140c08"; c.lineWidth = 1.1;
  c.beginPath();
  if (round) c.arc(wx, wy, ww * 0.5, 0, TAU);
  else { c.rect(wx - ww / 2, wy - ww * 0.45, ww, ww * 0.9); c.moveTo(wx, wy - ww * 0.45); c.lineTo(wx, wy + ww * 0.45); c.moveTo(wx - ww / 2, wy); c.lineTo(wx + ww / 2, wy); }
  c.stroke();
  pool(p, wx, y + 10, w * 1.1, "#ffa848", 0.26);
  return { window: { x: wx, y: wy, w: ww, round }, chimney: kind === "brick" ? { x: R - 14.5, y: T - 44 } : undefined };
}

function pigsBackdrop(p: P): Layout {
  p.light = { x: 432, y: 168 };
  sky(p, [[0, "#050a1c"], [0.45, "#17204d"], [0.75, "#353870"], [1, "#4a4170"]]);
  stars(p, 220, 250, p.light);
  moon(p, 432, 168, 46, 1);
  clouds(p, 150, 110, 280, "#2b3572", 0.26);
  const far = ridge(p, { base: 222, amp: 16, freq: 0.005, off: 200, top: "#1f2652", bottom: "#1a2149", rim: "#b7c2ff", rimA: 0.45 });
  const wolfAt = { x: 438, y: far(438) + 2 };
  mist(p, 240, 18, "#6f7bc4", 0.18);
  const mid = ridge(p, { base: 286, amp: 28, freq: 0.0035, off: 330, top: "#19203f", bottom: "#121733", rim: "#aeb9ff", rimA: 0.4 });
  for (let x = 6; x < 150; x += rnd(p, 7, 14)) { const h = rnd(p, 28, 62); conifer(p, x, mid(x) + 4, h, h * 0.45, "#0f1430", "#6b79c4", 1); }
  for (let x = 560; x < 610; x += rnd(p, 8, 14)) { const h = rnd(p, 24, 48); conifer(p, x, mid(x) + 4, h, h * 0.45, "#0f1430", "#8090e0", 1); }
  mist(p, 300, 20, "#6f7bc4", 0.1);
  const front = ridge(p, { base: 348, amp: 12, freq: 0.004, off: 420, top: "#151b3a", bottom: "#0b0f26", rim: "#b9c4ff", rimA: 0.45 });
  const { c } = p;
  const pg = c.createLinearGradient(0, 330, 0, ART_H);
  pg.addColorStop(0, rgba("#5a6098", 0)); pg.addColorStop(0.2, rgba("#5a6098", 0.35)); pg.addColorStop(1, rgba("#3b4070", 0.6));
  c.fillStyle = pg;
  c.beginPath(); c.moveTo(292, 338); c.bezierCurveTo(270, 370, 330, 390, 250, ART_H); c.lineTo(380, ART_H); c.bezierCurveTo(390, 390, 320, 370, 312, 338); c.closePath(); c.fill();
  const a = house(p, "straw", 150, front(150) + 8, 66, 50);
  const b = house(p, "sticks", 300, front(300) + 4, 70, 56);
  const d = house(p, "brick", 458, front(458) + 8, 82, 64);
  const fg = ridge(p, { base: 412, amp: 8, freq: 0.006, off: 600, top: "#0c1029", bottom: "#070a1d" });
  grass(p, front, 0, 600, 500, "#0b1029", "#8d9be0", 3, 9, 30);
  grass(p, fg, 0, 600, 500, "#070a1d", "#8d9be0", 5, 12, 30);
  flowers(p, front, 40, ["#e8dcff", "#ffe2b8"], 50);
  return { light: p.light, moon: { x: 432, y: 168, r: 46 }, front: fg, skyBottom: 215, fireflies: [40, 560, 270, 400], windows: [a.window, b.window, d.window], chimney: d.chimney, wolf: wolfAt, grassFrom: 0, grassTo: 600 };
}

function redBackdrop(p: P): Layout {
  p.light = { x: 330, y: 60 };
  sky(p, [[0, "#070e26"], [0.5, "#19244f"], [1, "#2a356a"]]);
  stars(p, 120, 170, p.light);
  moon(p, 330, 62, 24);
  const far = ridge(p, { base: 236, amp: 8, freq: 0.008, off: 40, top: "#252f66", bottom: "#212a5c" });
  for (let x = -10; x < 620; x += rnd(p, 7, 13)) { const h = rnd(p, 60, 125); conifer(p, x, far(x) + 4, h, h * 0.36, "#252f66", "#7d8bd6", 0.8); }
  mist(p, 246, 26, "#8390d4", 0.22);
  const floor = ridge(p, { base: 300, amp: 5, freq: 0.01, off: 80, top: "#151c45", bottom: "#070a1e" });
  for (let x = -20; x < 640; x += rnd(p, 20, 34)) {
    if (x > 250 && x < 372) continue;
    const h = rnd(p, 140, 215); conifer(p, x, floor(x) + 6, h, h * 0.38, "#161d46", "#6c7bd0", 1.2);
  }
  mist(p, 306, 18, "#7d89cc", 0.13);
  const { c } = p;
  const pg = c.createLinearGradient(0, 300, 0, ART_H);
  pg.addColorStop(0, rgba("#6a76b8", 0.35)); pg.addColorStop(1, rgba("#3a4478", 0.75));
  c.fillStyle = pg;
  c.beginPath(); c.moveTo(304, 302); c.bezierCurveTo(286, 330, 360, 350, 300, 390); c.quadraticCurveTo(250, 420, 230, ART_H); c.lineTo(430, ART_H); c.quadraticCurveTo(400, 410, 360, 390); c.bezierCurveTo(400, 350, 320, 330, 318, 302); c.closePath(); c.fill();
  for (let i = 0; i < 90; i++) {
    const y = rnd(p, 320, 440), x = rnd(p, 250, 420);
    c.fillStyle = rgba("#9aa4dc", rnd(p, 0.08, 0.25));
    c.beginPath(); ellipse(c, x, y, rnd(p, 0.6, 2) * (y / 300), rnd(p, 0.4, 1) * (y / 300)); c.fill();
  }
  const warm = { x: 362, y: 340 };
  grass(p, floor, 0, 260, 380, "#070b20", "#7f8ad0", 4, 12, 120);
  grass(p, floor, 400, 600, 380, "#070b20", "#7f8ad0", 4, 12, 120);
  for (const [tx, tw] of [[30, 34], [96, 20], [528, 26], [590, 40]] as const) {
    rimLit(p, { x: tx, y: 280 }, cc => { cc.moveTo(tx - tw / 2, ART_H); cc.lineTo(tx - tw * 0.4, -10); cc.lineTo(tx + tw * 0.4, -10); cc.lineTo(tx + tw / 2, ART_H); cc.closePath(); }, "#04071a", "#6b4038", 2.4, warm);
  }
  const near: Ground = x => 428 + Math.sin(x * 0.02) * 4;
  return { light: p.light, moon: { x: 330, y: 62, r: 24 }, front: near, skyBottom: 150, fireflies: [140, 520, 240, 330], warm, red: { x: 334, y: 372 }, hand: { x: 334 + 15 * 1.15, y: 372 - 37 * 1.15 }, grassFrom: 0, grassTo: 600 };
}

// ---------- sprites (rigid things that move as one piece) ----------

export type Sprite = { x: number; y: number; w: number; h: number; paint: (p: P) => void };

const arkSprite: Sprite = {
  x: -170, y: -148, w: 345, h: 156,
  paint(p) {
    const { c } = p, s = 0.95;
    p.light = { x: -240, y: -290 };
    const f = frame(c, 0, 0, s);
    const portX = [-60, -20, 20, 60];
    const hull = () => { f.m(-162, -84); f.q(-140, -26, -100, -6); f.l(100, -6); f.q(140, -26, 164, -82); f.l(132, -60); f.l(-132, -60); f.l(-162, -84); };
    const cabin = () => { f.m(-90, -60); f.l(-90, -108); f.l(90, -108); f.l(90, -60); f.l(-90, -60); };
    const roof = () => { f.m(-102, -106); f.l(0, -142); f.l(102, -106); f.l(-102, -106); };
    rimLit(p, f.pt(112, -80), () => { f.e(112, -72, 14, 7); f.e(104, -64, 1.8, 7); f.e(120, -64, 1.8, 7); f.e(121, -94, 3.4, 18, 0.32); f.e(128, -112, 6, 2.8, 0.3); f.e(126, -116, 0.9, 2.6); f.e(129, -116, 0.9, 2.6); }, "#130e1c", "#b9b4ee", 1.4);
    rimLit(p, f.pt(-112, -74), () => { f.e(-110, -72, 15, 11); f.e(-125, -76, 8, 8); f.e(-119, -76, 6, 7); f.e(-132, -66, 2.4, 8, 0.25); f.e(-118, -62, 3.5, 5); f.e(-102, -62, 3.5, 5); }, "#130e1c", "#b9b4ee", 1.4);
    rimLit(p, f.pt(0, -122), roof, "#120d19", "#a39fe0", 1.6);
    rimLit(p, f.pt(0, -84), cabin, "#21182a", "#9a92d4", 1.6);
    rimLit(p, f.pt(0, -40), hull, "#1b1322", "#a7a0e0", 2);
    c.save(); c.beginPath(); hull(); c.clip();
    c.strokeStyle = rgba("#8d84bb", 0.16); c.lineWidth = 0.7;
    for (let k = 0; k < 9; k++) {
      const yy = -66 + k * 6.5;
      c.beginPath(); const a = f.pt(-170, yy - 14 + k * 1.2), m = f.pt(0, yy + 3), b = f.pt(170, yy - 14 + k * 1.2);
      c.moveTo(a.x, a.y); c.quadraticCurveTo(m.x, m.y, b.x, b.y); c.stroke();
    }
    c.restore();
    c.save(); c.beginPath(); cabin(); c.clip();
    c.strokeStyle = rgba("#8d84bb", 0.12); c.lineWidth = 0.6;
    for (let k = -84; k <= 84; k += 9) { const a = f.pt(k, -108), b = f.pt(k, -60); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
    c.restore();
    for (const px of portX) {
      const q = f.pt(px, -86);
      const g = c.createRadialGradient(q.x - 1, q.y - 1, 0, q.x, q.y, 6 * s);
      g.addColorStop(0, "#fff3c2"); g.addColorStop(1, "#ffab45");
      c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, 6 * s, 0, TAU); c.fill();
      c.strokeStyle = "#160f17"; c.lineWidth = 1.2; c.beginPath(); c.arc(q.x, q.y, 6.3 * s, 0, TAU); c.stroke();
    }
  },
};
export const ARK_PORTHOLES = [-60, -20, 20, 60].map(x => ({ x: x * 0.95, y: -86 * 0.95 }));

const redSprite: Sprite = {
  x: -36, y: -82, w: 66, h: 86,
  paint(p) {
    const { c } = p, s = 1.15;
    const lantern = { x: 32, y: -40 };
    const f = frame(c, 0, 0, s);
    c.fillStyle = "#120a0c"; c.beginPath(); f.e(-6, -4, 2.4, 6); f.e(5, -4, 2.4, 6); c.fill();
    const cape = () => { f.m(0, -64); f.q(-11, -62, -12, -48); f.q(-15, -30, -24, -8); f.q(-10, -2, 0, -4); f.q(12, -2, 24, -8); f.q(15, -30, 12, -48); f.q(10, -62, 0, -64); };
    rimLit(p, f.pt(0, -34), cape, "#6e1420", "#ff7048", 3.4, lantern);
    c.save(); c.beginPath(); cape(); c.clip();
    c.globalCompositeOperation = "screen";
    const lg = c.createRadialGradient(lantern.x, lantern.y, 0, lantern.x, lantern.y, 60);
    lg.addColorStop(0, "rgba(255,130,60,.55)"); lg.addColorStop(1, "rgba(255,130,60,0)");
    c.fillStyle = lg; c.fillRect(-40, -80, 80, 80);
    c.globalCompositeOperation = "source-over";
    c.strokeStyle = rgba("#2a0509", 0.5); c.lineWidth = 1.2;
    for (const fx of [-12, -4, 6, 14]) { const a = f.pt(fx * 0.4, -46), b = f.pt(fx, -6); c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(a.x + fx * 0.3, (a.y + b.y) / 2, b.x, b.y); c.stroke(); }
    c.restore();
    c.fillStyle = "#1a0a0c"; c.beginPath(); f.e(1.5, -52, 6.5, 7.5); c.fill();
    const face = f.pt(3, -51);
    const fg = c.createRadialGradient(face.x + 3, face.y, 0, face.x, face.y, 6 * s);
    fg.addColorStop(0, "#ffd2a6"); fg.addColorStop(1, "#8a4a36");
    c.fillStyle = fg; c.beginPath(); ellipse(c, face.x, face.y, 4.6 * s, 5.4 * s); c.fill();
    rimLit(p, f.pt(-16, -26), () => { f.e(-17, -24, 7.5, 5); }, "#2e1c12", "#8a5a3a", 1.2, lantern);
    c.strokeStyle = "#3a2416"; c.lineWidth = 1.4; c.beginPath(); const h1 = f.pt(-23, -26); c.moveTo(h1.x, h1.y); const hc = f.pt(-17, -40), h2 = f.pt(-11, -26); c.quadraticCurveTo(hc.x, hc.y, h2.x, h2.y); c.stroke();
    c.fillStyle = rgba("#f0e6d8", 0.55); c.beginPath(); f.e(-17, -28, 6, 1.8); c.fill();
  },
};

// ---------- entry points ----------

const BACKDROPS: Record<string, (p: P) => Layout> = {
  "tortoise-and-hare": p => meadowBackdrop(p, true),
  "noahs-ark": arkBackdrop,
  "three-little-pigs": pigsBackdrop,
  "little-red-riding-hood": redBackdrop,
};

export const SPRITES: Record<string, Sprite | undefined> = { "noahs-ark": arkSprite, "little-red-riding-hood": redSprite };

const LABELS: Record<string, string> = {
  "tortoise-and-hare": "A hare watches a tortoise on roller skates in a moonlit meadow full of fireflies",
  "noahs-ark": "The ark rocking on a moonlit sea while a dove flies under a pale moonbow",
  "three-little-pigs": "Three little houses with glowing windows while a wolf howls at the moon",
  "little-red-riding-hood": "Little Red Riding Hood swinging a lantern on a path through the night forest",
};

export function sceneLabel(kind: string) {
  return LABELS[kind] ?? "A moonlit meadow full of fireflies";
}

export function makePainter(c: C, kind: string, s: number): P {
  const r = mulberry32(hash(kind));
  return { c, r, n: new Noise(r), light: { x: 300, y: 100 }, s };
}

/**
 * Paint the static layer for `kind`. The context's transform must already map
 * design units (600 × 440) to device pixels; `s` is device pixels per unit.
 */
export function paintBackdrop(canvas: HTMLCanvasElement, c: C, kind: string, s: number): Layout {
  const p = makePainter(c, kind, s);
  const layout = (BACKDROPS[kind] ?? (q => meadowBackdrop(q, false)))(p);
  c.filter = "none";
  grain(canvas);
  return layout;
}

/** Paint a sprite; the transform must put the sprite's origin where it belongs. */
export function paintSprite(c: C, sprite: Sprite, kind: string, s: number) {
  sprite.paint(makePainter(c, kind + ":sprite", s));
  c.filter = "none";
}
