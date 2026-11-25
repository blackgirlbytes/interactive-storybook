// Living story scenes. The static world is painted once (./paint.ts); this p5
// sketch animates everything with a pulse on top of it:
//   - fireflies that drift on noise and slowly fall into sync, the way real
//     fireflies do (pulse-coupled oscillators: a flash nudges its neighbours)
//   - grass that bends under gusts of wind travelling across the field
//   - stars that twinkle on their own rhythms
//   - hand-drawn characters with ink outlines and a small surprise each:
//     a tortoise on roller skates, a dove circling the ark, a wolf whose howl
//     sends a dancing pig ducking under the window, moths around Red's lantern.
import type p5 from "p5";
import { ART_H, ART_W, ARK_PORTHOLES, SPRITES, paintBackdrop, paintSprite, paintVignette, type Layout, type Pt } from "./paint";

export type ScenePlayer = p5 & { relayout: () => void };
type Ctx = CanvasRenderingContext2D;
type Actor = { draw: (t: number, dt: number) => void };

const smooth = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

export function sceneSketch(kind: string, host: HTMLElement, reduced: boolean) {
  return (sk: p5) => {
    const p = sk as ScenePlayer;
    let bg: p5.Graphics | undefined, vig: p5.Graphics | undefined, sprite: p5.Graphics | undefined;
    let layout: Layout;
    let w = 0, h = 0, d = 1, s = 1, ox = 0, oy = 0, density = 1;
    let actors: Actor[] = [];
    const ctx = () => p.drawingContext as Ctx;
    const rand = (a: number, b: number) => a + (b - a) * Math.random();

    function measure() {
      const r = host.getBoundingClientRect();
      // clamp so a layout bug can never turn into a runaway canvas
      w = Math.min(2400, Math.max(40, Math.round(r.width))); h = Math.min(1800, Math.max(40, Math.round(r.height)));
    }

    function build() {
      d = Math.min(2, window.devicePixelRatio || 1);
      s = Math.max(w / ART_W, h / ART_H);
      ox = (w - ART_W * s) / 2; oy = (h - ART_H * s) / 2;
      density = Math.min(1, Math.max(0.3, (w * h) / (560 * 410)));
      // p5 1.x Graphics.remove() throws in instance mode; drop the hidden canvases directly
      for (const g of [bg, vig, sprite]) (g?.elt as HTMLCanvasElement | undefined)?.remove();
      bg = p.createGraphics(w, h); bg.pixelDensity(d);
      const c = bg.drawingContext as Ctx;
      c.save(); c.setTransform(d * s, 0, 0, d * s, d * ox, d * oy);
      layout = paintBackdrop(bg.elt as HTMLCanvasElement, c, kind, d * s);
      c.restore();
      vig = p.createGraphics(w, h); vig.pixelDensity(d);
      paintVignette(vig.elt as HTMLCanvasElement);
      const spr = SPRITES[kind];
      sprite = undefined;
      if (spr) {
        sprite = p.createGraphics(Math.ceil(spr.w * s), Math.ceil(spr.h * s)); sprite.pixelDensity(d);
        const sc = sprite.drawingContext as Ctx;
        sc.save(); sc.setTransform(d * s, 0, 0, d * s, -spr.x * d * s, -spr.y * d * s);
        paintSprite(sc, spr, kind, d * s);
        sc.restore();
      }
      actors = cast();
    }

    // ---------- shared systems ----------

    function twinkles(count: number): Actor {
      const stars = [] as { x: number; y: number; size: number; rate: number; seed: number; hue: number; sat: number }[];
      while (stars.length < count) {
        const x = rand(0, ART_W), y = Math.pow(Math.random(), 1.4) * layout.skyBottom;
        if (Math.hypot(x - layout.moon.x, y - layout.moon.y) < layout.moon.r * 3) continue;
        const warm = Math.random() < 0.3;
        stars.push({ x, y, size: rand(0.7, 1.6), rate: rand(0.25, 1.3), seed: rand(0, 999), hue: warm ? 42 : 222, sat: warm ? 25 : 18 });
      }
      return {
        draw(t) {
          for (const st of stars) {
            const b = Math.min(1, Math.max(0, (p.noise(st.seed, t * st.rate) - 0.38) * 2.6));
            if (b < 0.05) continue;
            const L = st.size * (2 + b * 4);
            p.stroke(st.hue, st.sat, 100, b * 85); p.strokeWeight(0.35);
            p.line(st.x - L, st.y, st.x + L, st.y); p.line(st.x, st.y - L, st.x, st.y + L);
            p.noStroke(); p.fill(st.hue, st.sat * 0.5, 100, 40 + b * 60); p.circle(st.x, st.y, st.size * (0.8 + b * 0.7));
          }
        },
      };
    }

    function fireflies(count: number, zone: [number, number, number, number], hueBase = 52): Actor {
      const [x0, x1, y0, y1] = zone;
      const flies = Array.from({ length: Math.max(3, Math.round(count)) }, () => ({
        x: rand(x0, x1), y: rand(y0, y1), heading: rand(0, Math.PI * 2), speed: rand(0.12, 0.32),
        phase: Math.random(), period: rand(2.2, 3.4), seed: rand(0, 999), hue: hueBase + rand(-8, 10),
      }));
      return {
        draw(t, dt) {
          const flashed: number[] = [];
          flies.forEach((f, i) => {
            f.heading += (p.noise(f.seed, t * 0.35) - 0.5) * 0.16;
            const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
            if (f.x < x0 || f.x > x1 || f.y < y0 || f.y > y1) {
              const want = Math.atan2(cy - f.y, cx - f.x);
              f.heading += Math.atan2(Math.sin(want - f.heading), Math.cos(want - f.heading)) * 0.06;
            }
            f.x += Math.cos(f.heading) * f.speed * dt * 60;
            f.y += Math.sin(f.heading) * f.speed * 0.55 * dt * 60 + Math.sin(t * 1.3 + f.seed) * 0.05;
            f.phase += dt / f.period;
            if (f.phase >= 1) { f.phase -= 1; flashed.push(i); }
          });
          // a flash pulls nearby fireflies' clocks forward, so groups drift into sync
          for (const i of flashed) {
            for (const g of flies) {
              if (g === flies[i]) continue;
              if (Math.hypot(g.x - flies[i].x, g.y - flies[i].y) < 90) g.phase = Math.min(0.999, g.phase + 0.06);
            }
          }
          const c = ctx();
          c.save(); c.globalCompositeOperation = "screen";
          for (const f of flies) {
            const ph = f.phase, flash = ph < 0.08 ? ph / 0.08 : ph < 0.32 ? 1 - (ph - 0.08) / 0.24 : 0;
            const b = 0.12 + flash * 0.88, r = 3 + flash * 9;
            const col = p.color(f.hue, 70, 100);
            const [R, G, B] = [p.red(col), p.green(col), p.blue(col)];
            const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
            g.addColorStop(0, `rgba(${R},${G},${B},${0.7 * b})`); g.addColorStop(0.35, `rgba(${R},${G},${B},${0.25 * b})`); g.addColorStop(1, `rgba(${R},${G},${B},0)`);
            c.fillStyle = g; c.fillRect(f.x - r, f.y - r, r * 2, r * 2);
            c.fillStyle = `rgba(255,250,210,${0.25 + b * 0.75})`;
            c.beginPath(); c.arc(f.x, f.y, 0.5 + flash * 0.6, 0, Math.PI * 2); c.fill();
          }
          c.restore();
        },
      };
    }

    function meadowGrass(count: number, ground: (x: number) => number, depth: [number, number], warm?: () => Pt & { f: number }): Actor {
      const from = layout.grassFrom ?? 0, to = layout.grassTo ?? ART_W;
      const blades = Array.from({ length: Math.round(count) }, () => {
        const x = rand(from, to), dy = rand(depth[0], depth[1]), lit = Math.random() < 0.14;
        return {
          x, y: ground(x) + dy, h: rand(5, 15) * (0.7 + dy / 40), lean: rand(-3, 3), seed: rand(0, 99), weight: rand(0.45, 1.1),
          hue: rand(212, 246), sat: lit ? rand(18, 30) : rand(35, 55), bri: lit ? rand(42, 60) : rand(8, 20), a: lit ? rand(50, 80) : rand(80, 100),
        };
      }).sort((a, b) => a.y - b.y);
      return {
        draw(t) {
          p.noFill();
          const light = warm?.();
          for (const b of blades) {
            const flutter = (p.noise(b.seed, t * 1.6) - 0.5) * 0.5;
            const lean = b.lean + (gust(b.x, t) + flutter) * b.h * 0.5;
            let hue = b.hue, sat = b.sat, bri = b.bri;
            if (light) {
              const k = Math.max(0, 1 - Math.hypot(b.x - light.x, b.y - light.y) / 150) * light.f;
              hue = hue + (392 - hue) * k; sat = sat + (70 - sat) * k; bri = bri + 50 * k;
            }
            p.stroke(hue % 360, sat, bri, b.a); p.strokeWeight(b.weight);
            p.beginShape(); p.vertex(b.x, b.y); p.quadraticVertex(b.x + lean * 0.3, b.y - b.h * 0.6, b.x + lean, b.y - b.h); p.endShape();
          }
        },
      };
    }

    const gust = (x: number, t: number) => (p.noise(x * 0.011 - t * 0.5, 4.2) - 0.42) * 2.2;

    function wildflowers(count: number, ground: (x: number) => number, depth: [number, number]): Actor {
      // gold, cream, lilac, cornflower, marigold: muted by moonlight, never neon
      const palette: [number, number, number][] = [[46, 58, 92], [48, 16, 97], [270, 28, 84], [214, 34, 90], [32, 52, 92]];
      const flowers = Array.from({ length: Math.round(count) }, () => {
        const x = rand(0, ART_W), dy = rand(depth[0], depth[1]), [hue, sat, bri] = palette[Math.floor(Math.random() * palette.length)];
        return { x, y: ground(x) + dy, h: rand(8, 20) * (0.7 + dy / 50), size: rand(1.5, 3) * (0.8 + dy / 60), hue: hue + rand(-6, 6), sat, bri: bri * rand(0.62, 0.85), seed: rand(0, 99), spin: rand(0, 6.28), petals: Math.random() < 0.3 ? 6 : 5 };
      }).sort((a, b) => a.y - b.y);
      return {
        draw(t) {
          for (const f of flowers) {
            const lean = (gust(f.x, t) + (p.noise(f.seed, t * 1.2) - 0.5) * 0.4) * f.h * 0.45;
            const tx = f.x + lean, ty = f.y - f.h;
            p.noFill(); p.stroke(222, 35, 20, 90); p.strokeWeight(0.6);
            p.beginShape(); p.vertex(f.x, f.y); p.quadraticVertex(f.x + lean * 0.2, f.y - f.h * 0.6, tx, ty); p.endShape();
            p.push(); p.translate(tx, ty); p.rotate(f.spin + lean * 0.05);
            p.noStroke(); p.fill(f.hue, f.sat, f.bri, 92);
            for (let k = 0; k < f.petals; k++) { const a = (k / f.petals) * Math.PI * 2; p.ellipse(Math.cos(a) * f.size * 0.6, Math.sin(a) * f.size * 0.6, f.size * 1.1, f.size * 0.7); }
            p.fill(44, 70, 70); p.circle(0, 0, f.size * 0.6);
            p.pop();
          }
        },
      };
    }

    const ink = (weight = 1.1) => { p.stroke(236, 55, 9); p.strokeWeight(weight); };
    const rimStroke = (a = 55, weight = 0.9) => { p.noFill(); p.stroke(222, 22, 96, a); p.strokeWeight(weight); };

    // ---------- characters ----------

    function hare(x: number, y: number, sc: number): Actor {
      const ears = [{ a: 0, v: 0, next: rand(1, 4) }, { a: 0, v: 0, next: rand(2, 6) }];
      let blinkAt = rand(2, 5), lookX = 0;
      return {
        draw(t, dt) {
          for (const e of ears) {
            if (t > e.next) { e.v += rand(-5, 5); e.next = t + rand(1.5, 6); }
            e.v += -e.a * 90 * dt - e.v * 6 * dt; e.a += e.v * dt;
          }
          if (t > blinkAt + 0.16) blinkAt = t + rand(2.5, 6);
          const blink = t > blinkAt ? 0.1 : 1;
          const breath = (p.noise(31, t * 0.6) - 0.5) * 0.03 + Math.sin(t * 2.3) * 0.012;
          lookX += ((watch.x - x) / 120 - lookX) * Math.min(1, dt * 3);
          const look = Math.max(-1, Math.min(1, lookX));
          p.noStroke(); p.fill(236, 60, 4, 50); p.ellipse(x + 6 * sc, y + 0.5 * sc, 52 * sc, 6 * sc);
          p.push(); p.translate(x, y); p.scale(sc);
          const ear = (bx: number, by: number, rot: number, shade: number) => {
            p.push(); p.translate(bx, by); p.rotate(rot);
            p.fill(26, 26, 38 * shade); ink(1);
            p.beginShape(); p.vertex(0, 0); p.bezierVertex(-6, -8, -6, -27, -1, -33); p.bezierVertex(4, -27, 5, -8, 3, 0); p.endShape(p.CLOSE);
            p.noStroke(); p.fill(345, 28, 48 * shade);
            p.beginShape(); p.vertex(0.2, -4); p.bezierVertex(-3, -10, -3, -24, -0.6, -28); p.bezierVertex(1.8, -23, 2.4, -10, 1.8, -4); p.endShape(p.CLOSE);
            rimStroke(45, 0.7); p.bezier(3, 0, 5, -8, 4, -27, -1, -33);
            p.pop();
          };
          ear(-14, -46, -0.38 + ears[1].a, 0.8);
          p.push(); p.scale(1, 1 + breath);
          p.fill(27, 30, 40); ink();
          p.beginShape(); p.vertex(-8, 0); p.bezierVertex(-15, -10, -13, -30, 2, -34); p.bezierVertex(17, -37, 29, -22, 27, -9); p.bezierVertex(26, -2, 19, 0, 10, 0); p.endShape(p.CLOSE);
          p.noStroke(); p.fill(26, 20, 52, 75);
          p.beginShape(); p.vertex(4, -33); p.bezierVertex(16, -35, 26, -22, 25, -10); p.bezierVertex(20, -18, 14, -28, 4, -33); p.endShape(p.CLOSE);
          p.fill(26, 34, 30, 60);
          p.beginShape(); p.vertex(-6, -1); p.bezierVertex(0, -6, 12, -6, 22, -2); p.bezierVertex(12, 0, 2, 0, -6, -1); p.endShape(p.CLOSE);
          p.noFill(); p.stroke(236, 55, 9, 55); p.strokeWeight(0.7); p.bezier(8, -3, 4, -16, 12, -26, 22, -22);
          p.noStroke(); p.fill(33, 16, 60);
          p.beginShape(); p.vertex(-7, -2); p.bezierVertex(-12, -10, -11, -24, -4, -28); p.bezierVertex(-2, -18, -1, -8, -2, -2); p.endShape(p.CLOSE);
          // fur strokes
          p.stroke(28, 30, 26, 60); p.strokeWeight(0.5);
          for (let i = 0; i < 9; i++) { const fx = 4 + i * 2.4, fy = -30 + Math.abs(i - 4) * 2.2; p.line(fx, fy, fx + 1.6, fy + 3.2); }
          rimStroke(65, 1); p.bezier(2, -34.6, 17, -37.6, 29.6, -22, 27.6, -9);
          p.pop();
          p.fill(30, 8, 80); ink(0.9); p.circle(26, -11, 10);
          p.fill(27, 34, 30); ink(0.9);
          p.beginShape(); p.vertex(-1, 0.5); p.bezierVertex(4, -4, 20, -4, 24, 0.5); p.endShape(p.CLOSE);
          p.fill(30, 22, 52); ink(0.9); p.ellipse(-11, -1.5, 9, 4);
          p.fill(27, 28, 44); ink();
          p.beginShape(); p.vertex(-4, -46); p.bezierVertex(-8, -51, -20, -50, -24, -44); p.bezierVertex(-28, -40, -26, -34, -21, -33); p.bezierVertex(-14, -31, -6, -34, -4, -38); p.bezierVertex(-2, -41, -2, -44, -4, -46); p.endShape();
          p.noStroke(); p.fill(33, 14, 66); p.ellipse(-21, -36, 7, 4.5);
          rimStroke(60, 0.9); p.bezier(-4, -46.6, -8, -51.6, -20, -50.6, -24, -44.6);
          ear(-10, -47, -0.08 + ears[0].a, 1);
          // eye follows the tortoise
          p.fill(236, 60, 6); p.noStroke(); p.ellipse(-16.5 + look * 0.6, -41.5, 3, 3.4 * blink);
          if (blink > 0.5) { p.fill(45, 10, 100); p.circle(-15.8 + look * 0.6, -42.4, 1.1); }
          const twitch = Math.sin(t * 9) * (p.noise(t * 0.8) > 0.6 ? 0.5 : 0);
          p.fill(345, 30, 55); p.circle(-25.3, -40 + twitch, 2.4);
          p.stroke(40, 8, 90, 45); p.strokeWeight(0.35);
          for (const k of [-1, 0, 1]) p.line(-24, -38.5 + twitch, -33, -39.5 + k * 2.4 + twitch);
          p.pop();
        },
      };
    }

    const watch = { x: 220 };

    function skatingTortoise(baseY: (x: number) => number, sc: number): Actor {
      let wheel = 0, prev = 225;
      const puffs: { x: number; y: number; r: number; life: number }[] = [];
      return {
        draw(t, dt) {
          const u = t * 0.16 + p.noise(5, t * 0.05) * 0.8;
          const x = 190 + Math.sin(u * Math.PI * 2) * 66;
          const vel = (x - prev) / Math.max(dt, 1e-3); prev = x; watch.x = x;
          const dir = vel >= 0 ? 1 : -1, speed = Math.min(1, Math.abs(vel) / 70);
          wheel += vel * dt / 3;
          const stride = Math.abs(Math.sin(t * 4.2)) * speed;
          const y = baseY(x) + 6 - stride * 1.6;
          if (speed > 0.4 && Math.random() < speed * 0.5) puffs.push({ x: x - dir * 22 * sc, y: baseY(x) + 5, r: rand(1, 2.5), life: 0 });
          for (const pf of puffs) { pf.life += dt; pf.r += dt * 6; pf.y -= dt * 3; }
          while (puffs.length && puffs[0].life > 0.9) puffs.shift();
          p.noStroke();
          for (const pf of puffs) { p.fill(225, 20, 70, 30 * (1 - pf.life / 0.9)); p.circle(pf.x, pf.y, pf.r * 2); }
          if (speed > 0.55) {
            p.stroke(220, 25, 90, 35 * speed); p.strokeWeight(0.7);
            for (let k = 0; k < 3; k++) { const ly = y - 10 * sc - k * 8 * sc; p.line(x - dir * (40 + k * 6) * sc, ly, x - dir * (58 + k * 10) * sc, ly); }
          }
          p.noStroke(); p.fill(236, 60, 4, 50); p.ellipse(x, baseY(x) + 6, 66 * sc, 5 * sc);
          p.push(); p.translate(x, y); p.scale(sc * dir, sc);
          // scarf trailing behind
          const flap = Math.sin(t * 9) * 2 * (0.3 + speed);
          p.fill(4, 72, 66); ink(0.9);
          p.beginShape(); p.vertex(24, -18); p.bezierVertex(14, -20 + flap, 4, -22 - flap, -6 - speed * 8, -24 + flap * 1.5); p.bezierVertex(2, -18 - flap, 12, -16, 24, -14); p.endShape(p.CLOSE);
          // skates
          for (const lx of [-16, 16]) {
            p.fill(222, 25, 22); ink(0.9); p.rect(lx - 9, -8, 18, 3, 1.5);
            for (const wx of [lx - 5, lx + 5]) {
              p.fill(44, 78, 92); ink(0.9); p.circle(wx, -2.5, 6);
              p.stroke(236, 55, 9, 80); p.strokeWeight(0.5);
              p.line(wx + Math.cos(wheel) * 2.6, -2.5 + Math.sin(wheel) * 2.6, wx - Math.cos(wheel) * 2.6, -2.5 - Math.sin(wheel) * 2.6);
            }
          }
          // legs, tail, head
          p.fill(78, 24, 40); ink(1);
          for (const lx of [-16, 16]) { p.beginShape(); p.vertex(lx - 5, -14); p.bezierVertex(lx - 6, -10, lx - 5, -8, lx - 4, -8); p.vertex(lx + 4, -8); p.bezierVertex(lx + 5, -10, lx + 6, -12, lx + 5, -14); p.endShape(p.CLOSE); }
          p.triangle(-30, -12, -36, -10, -29, -9);
          const nod = Math.sin(t * 4.2) * 1.2 * speed;
          p.beginShape(); p.vertex(22, -16); p.bezierVertex(28, -18, 31, -22 + nod, 34, -24 + nod); p.vertex(36, -16 + nod); p.bezierVertex(32, -14, 28, -12, 22, -11); p.endShape(p.CLOSE);
          p.ellipse(39, -21 + nod, 15, 12);
          p.fill(236, 60, 6); p.noStroke(); p.circle(41.5, -23 + nod, 2.8);
          p.fill(45, 10, 100); p.circle(42, -23.6 + nod, 1);
          p.noFill(); p.stroke(236, 55, 9); p.strokeWeight(0.7); p.arc(41, -19 + nod, 6, 3, 0.2, Math.PI * 0.7);
          // shell
          p.fill(86, 40, 32); ink(1.2);
          p.beginShape(); p.vertex(-30, -12); p.bezierVertex(-29, -42, 27, -42, 30, -12); p.bezierVertex(12, -9, -12, -9, -30, -12); p.endShape(p.CLOSE);
          const scutes: [number, number][][] = [
            [[-6, -36], [6, -36], [10, -28], [4, -21], [-4, -21], [-10, -28]],
            [[-10, -28], [-4, -21], [-8, -14], [-20, -14], [-23, -21], [-17, -31]],
            [[10, -28], [4, -21], [8, -14], [20, -14], [23, -21], [17, -31]],
            [[-4, -21], [4, -21], [8, -14], [-8, -14]],
          ];
          scutes.forEach((sq, i) => {
            p.fill(80 + i * 4, 36 + (i % 2) * 8, 38 + (i % 3) * 4); ink(0.8);
            p.beginShape(); for (const [a, b] of sq) p.vertex(a, b); p.endShape(p.CLOSE);
          });
          p.fill(62, 38, 30); ink(1); p.rect(-31, -14, 62, 4, 2);
          rimStroke(55, 1); p.bezier(-28, -14, -27, -43, 25, -43, 28, -14);
          p.pop();
        },
      };
    }

    function wolf(at: Pt, sc: number): Actor & { howl: (t: number) => number } {
      const howl = (t: number) => { const ph = (t + 5) % 11; return smooth(0, 0.9, ph) * (1 - smooth(3.6, 4.5, ph)); };
      const breath: { x: number; y: number; r: number; life: number }[] = [];
      return {
        howl,
        draw(t, dt) {
          const raise = howl(t);
          p.push(); p.translate(at.x, at.y); p.scale(sc);
          p.noStroke(); p.fill(236, 60, 8);
          p.ellipse(0, -15, 40, 15); p.ellipse(-13, -19, 18, 20);
          for (const lx of [-14, -8, 12, 18]) p.ellipse(lx, -7, 4.4, 15);
          p.push(); p.translate(24, -13); p.rotate(0.55 + raise * 0.35); p.ellipse(9, 0, 20, 6.4); p.pop();
          p.push(); p.translate(-17, -24); p.rotate(-raise * 0.75);
          p.ellipse(-4, -5, 11, 18); p.ellipse(-8, -13, 12, 11);
          p.push(); p.translate(-12, -14); p.rotate(-0.5); p.ellipse(-4, 0, 13, 5.5); p.pop();
          p.triangle(-6, -17, -3, -26, -1, -16);
          p.pop();
          p.pop();
          // cold breath rising from the snout mid-howl
          if (raise > 0.85 && Math.random() < 0.5) {
            const a = -raise * 0.75, sx = -19, sy = -18;
            const nx = -17 + sx * Math.cos(a) - sy * Math.sin(a), ny = -24 + sx * Math.sin(a) + sy * Math.cos(a);
            breath.push({ x: at.x + nx * sc, y: at.y + ny * sc, r: 1, life: 0 });
          }
          for (const b of breath) { b.life += dt; b.r += dt * 5; b.y -= dt * 5; b.x -= dt * 2; }
          while (breath.length && breath[0].life > 1.4) breath.shift();
          p.noStroke();
          for (const b of breath) { p.fill(225, 12, 92, 18 * (1 - b.life / 1.4)); p.circle(b.x, b.y, b.r * 2); }
        },
      };
    }

    function dove(): Actor {
      let x = 240, y = 160, heading = 0, flap = 0;
      return {
        draw(t, dt) {
          const nx = 250 + (p.noise(3, t * 0.07) - 0.5) * 300, ny = 165 + (p.noise(7, t * 0.07) - 0.5) * 110;
          const vx = nx - x, vy = ny - y;
          if (Math.hypot(vx, vy) > 0.01) heading += Math.atan2(Math.sin(Math.atan2(vy, vx) - heading), Math.cos(Math.atan2(vy, vx) - heading)) * Math.min(1, dt * 4);
          x = nx; y = ny;
          const climb = Math.max(0, -vy / Math.max(dt, 1e-3) / 20);
          flap += dt * (7 + climb * 6);
          const wing = Math.sin(flap);
          const c = ctx();
          c.save(); c.shadowColor = "rgba(225,230,255,.7)"; c.shadowBlur = 10 * s * d;
          p.push(); p.translate(x, y); p.rotate(heading); p.scale(1.5);
          const facing = Math.cos(heading) >= 0 ? 1 : -1;
          p.scale(1, facing);
          p.fill(230, 6, 97); p.stroke(232, 30, 45); p.strokeWeight(0.5);
          p.beginShape(); p.vertex(-2, 0); p.bezierVertex(-6, -6 - wing * 8, -14, -10 - wing * 10, -8, -12 - wing * 12); p.bezierVertex(-4, -6, 2, -4, 3, 0); p.endShape(p.CLOSE);
          p.ellipse(0, 0, 14, 6);
          p.circle(7, -1.5, 5);
          p.triangle(-6, -1, -12, -3, -12, 2);
          p.beginShape(); p.vertex(1, 0); p.bezierVertex(-2, -5 - wing * 7, -9, -8 - wing * 9, -4, -10 - wing * 10); p.bezierVertex(0, -5, 4, -3, 5, 0); p.endShape(p.CLOSE);
          p.pop();
          c.restore();
          p.push(); p.translate(x, y); p.rotate(heading); p.scale(1.5, 1.5 * (Math.cos(heading) >= 0 ? 1 : -1));
          p.fill(236, 55, 9); p.noStroke(); p.circle(8, -2, 0.9);
          p.stroke(95, 45, 60); p.strokeWeight(0.6); p.line(9.5, -1.2, 13, 0.5);
          p.noStroke(); p.fill(95, 50, 70); p.ellipse(13.5, 0.8, 3, 1.4);
          p.pop();
        },
      };
    }

    function smoke(from: Pt): Actor {
      const puffs: { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number }[] = [];
      let acc = 0;
      return {
        draw(t, dt) {
          acc += dt * 8;
          while (acc > 1) { acc--; puffs.push({ x: from.x + rand(-2, 2), y: from.y, vx: rand(-0.05, 0.05), vy: rand(-0.35, -0.22), r: rand(2, 3.5), life: 0, max: rand(4, 6.5) }); }
          const c = ctx();
          c.save(); c.globalCompositeOperation = "screen";
          for (const pf of puffs) {
            pf.life += dt;
            pf.vx += ((p.noise(pf.y * 0.02, t * 0.2) - 0.5) * 0.04 + 0.006) * dt * 60;
            pf.x += pf.vx * dt * 60; pf.y += pf.vy * dt * 60; pf.r += dt * 4;
            const a = 0.16 * (1 - pf.life / pf.max) * Math.min(1, pf.life * 2);
            const g = c.createRadialGradient(pf.x, pf.y, 0, pf.x, pf.y, pf.r);
            g.addColorStop(0, `rgba(150,160,215,${a})`); g.addColorStop(1, "rgba(150,160,215,0)");
            c.fillStyle = g; c.fillRect(pf.x - pf.r, pf.y - pf.r, pf.r * 2, pf.r * 2);
          }
          c.restore();
          while (puffs.length && puffs[0].life > puffs[0].max) puffs.shift();
        },
      };
    }

    function windowLights(seedBase: number): Actor {
      const wins = layout.windows ?? [];
      return {
        draw(t) {
          const c = ctx();
          c.save(); c.globalCompositeOperation = "screen";
          wins.forEach((wn, i) => {
            const f = 0.6 + 0.4 * p.noise(seedBase + i * 10, t * 3.5);
            const r = wn.w * 2.6;
            const g = c.createRadialGradient(wn.x, wn.y, 0, wn.x, wn.y, r);
            g.addColorStop(0, `rgba(255,180,90,${0.35 * f})`); g.addColorStop(1, "rgba(255,180,90,0)");
            c.fillStyle = g; c.fillRect(wn.x - r, wn.y - r, r * 2, r * 2);
          });
          c.restore();
        },
      };
    }

    function windowPigs(howl: (t: number) => number): Actor {
      const wins = layout.windows ?? [];
      let hide = 0;
      return {
        draw(t, dt) {
          hide += ((howl(t) > 0.3 ? 1 : 0) - hide) * Math.min(1, dt * (howl(t) > 0.3 ? 9 : 1.5));
          const c = ctx();
          const pig = (wn: (typeof wins)[number], dx: number, dy: number, tilt: number) => {
            c.save(); c.beginPath();
            if (wn.round) c.arc(wn.x, wn.y, wn.w * 0.5, 0, Math.PI * 2); else c.rect(wn.x - wn.w / 2, wn.y - wn.w * 0.45, wn.w, wn.w * 0.9);
            c.clip();
            p.push(); p.translate(wn.x + dx, wn.y + dy + wn.w * 0.3); p.rotate(tilt);
            p.noStroke(); p.fill(18, 70, 14, 92);
            const u = wn.w;
            p.ellipse(0, 0, u * 0.58, u * 0.5);
            p.triangle(-u * 0.24, -u * 0.12, -u * 0.2, -u * 0.36, -u * 0.06, -u * 0.18);
            p.triangle(u * 0.24, -u * 0.12, u * 0.2, -u * 0.36, u * 0.06, -u * 0.18);
            p.ellipse(0, u * 0.06, u * 0.24, u * 0.16);
            p.ellipse(0, u * 0.42, u * 0.7, u * 0.4);
            p.pop();
            c.restore();
          };
          if (wins[0]) {
            const beat = t * 5.4;
            pig(wins[0], Math.sin(beat) * wins[0].w * 0.13, -Math.abs(Math.sin(beat)) * wins[0].w * 0.08 + hide * wins[0].w * 0.75, Math.sin(beat) * 0.18);
          }
          if (wins[2]) pig(wins[2], Math.sin(t * 0.7) * wins[2].w * 0.05, hide * wins[2].w * 0.3, 0);
        },
      };
    }

    function arkAtSea(): Actor {
      const spr = SPRITES[kind]!;
      const ax = layout.arkX ?? 368, wl = layout.waterline ?? 362, horizon = layout.horizon ?? 300;
      const glints = Array.from({ length: Math.round(170 * Math.max(0.6, density)) }, (_, i) => {
        const depth = Math.pow(Math.random(), 1.25);
        return { depth, lane: (Math.random() - 0.5) * 2 * Math.sqrt(Math.random()), seed: i * 1.7, len: rand(0.4, 1) };
      });
      return {
        draw(t) {
          const c = ctx();
          // moonlight scattered across moving water
          c.save(); c.globalCompositeOperation = "screen"; c.lineCap = "round";
          for (const g of glints) {
            const y = horizon + 1 + g.depth * (ART_H - horizon), spread = 4 + g.depth * 62;
            const x = layout.moon.x + g.lane * spread + (p.noise(g.seed, t * 0.5) - 0.5) * spread * 0.5;
            const a = Math.max(0, p.noise(g.seed + 40, t * 1.4) - 0.3) * 1.4 * (1 - g.depth * 0.5);
            const len = (2 + g.depth * 22) * g.len;
            c.strokeStyle = `rgba(255,238,200,${a})`; c.lineWidth = 0.45 + g.depth * 1.3;
            c.beginPath(); c.moveTo(x - len / 2, y); c.lineTo(x + len / 2, y); c.stroke();
          }
          c.restore();
          const bob = (p.noise(0.5, t * 0.35) - 0.5) * 5 + Math.sin(t * 1.15) * 1.1;
          const tilt = (p.noise(9.1, t * 0.3) - 0.5) * 0.06 + Math.sin(t * 1.15 + 1) * 0.008;
          // reflections wobble on the water
          for (let yy = 0; yy < 60; yy += 1.4) {
            const wdt = 300 * 0.95 * (1 - yy / 95), off = Math.sin(yy * 0.8 + t * 2.2) * 3.5;
            c.fillStyle = `rgba(4,6,26,${0.55 * (1 - yy / 60)})`;
            c.fillRect(ax - wdt / 2 + off, wl + bob + 2 + yy, wdt, 1.1);
          }
          c.save(); c.globalCompositeOperation = "screen"; c.lineCap = "round";
          ARK_PORTHOLES.forEach((ph, i) => {
            for (let yy = 8; yy < 70; yy += 3) {
              const x = ax + ph.x + Math.sin(yy * 0.45 + t * 2.6 + i) * 2.5;
              const len = (2 + p.noise(i * 7, yy * 0.2, t) * 6) * (1 + yy / 40);
              c.strokeStyle = `rgba(255,190,98,${0.5 * (1 - yy / 70) * (0.6 + 0.4 * p.noise(i, t * 3))})`; c.lineWidth = 1.1;
              c.beginPath(); c.moveTo(x - len / 2, wl + bob + yy); c.lineTo(x + len / 2, wl + bob + yy); c.stroke();
            }
          });
          c.restore();
          p.push(); p.translate(ax, wl + bob); p.rotate(tilt);
          if (sprite) p.image(sprite, spr.x, spr.y, spr.w, spr.h);
          c.save(); c.globalCompositeOperation = "screen";
          ARK_PORTHOLES.forEach((ph, i) => {
            const f = 0.65 + 0.35 * p.noise(i * 3.3, t * 4);
            const g = c.createRadialGradient(ph.x, ph.y, 0, ph.x, ph.y, 34);
            g.addColorStop(0, `rgba(255,173,77,${0.4 * f})`); g.addColorStop(1, "rgba(255,173,77,0)");
            c.fillStyle = g; c.fillRect(ph.x - 34, ph.y - 34, 68, 68);
          });
          c.restore();
          p.pop();
          // foam where the hull meets the water
          p.stroke(228, 30, 88, 40); p.strokeWeight(0.7);
          for (let i = 0; i < 26; i++) {
            const fx = ax + (p.noise(i * 2.1, t * 0.4) - 0.5) * 200, fy = wl + bob - 4 + p.noise(i, t * 0.9) * 4;
            p.line(fx, fy, fx + 4 + p.noise(i + 9, t) * 8, fy);
          }
        },
      };
    }

    function lanternWalk(): Actor {
      const spr = SPRITES[kind]!;
      const red = layout.red!, hand = layout.hand!;
      const moths = Array.from({ length: 6 }, () => ({ a: rand(0, 6.28), r: rand(9, 26), sp: rand(1.5, 3.5) * (Math.random() < 0.5 ? -1 : 1), seed: rand(0, 99), flap: rand(0, 6) }));
      const eyes = { x: 130, nextBlink: rand(2, 5) };
      const state = { x: hand.x, y: hand.y + 9, f: 1 };
      return {
        draw(t, dt) {
          const c = ctx();
          // eyes in the dark trees, drifting and blinking
          eyes.x = 112 + p.noise(77, t * 0.04) * 70;
          if (t > eyes.nextBlink + 0.18) eyes.nextBlink = t + rand(2, 6);
          const show = smooth(0.35, 0.55, p.noise(88, t * 0.05)) * (t > eyes.nextBlink ? 0 : 1);
          if (show > 0.02) {
            for (const ex of [eyes.x, eyes.x + 12]) {
              const ey = 300 + p.noise(99, t * 0.05) * 6;
              const g = c.createRadialGradient(ex, ey, 0, ex, ey, 7);
              g.addColorStop(0, `rgba(216,255,138,${0.65 * show})`); g.addColorStop(1, "rgba(216,255,138,0)");
              c.fillStyle = g; c.fillRect(ex - 7, ey - 7, 14, 14);
              p.noStroke(); p.fill(72, 30, 100, 100 * show); p.ellipse(ex, ey, 3.2, 2);
            }
          }
          const bob = -Math.abs(Math.sin(t * 2.3)) * 0.9;
          const flick = 0.8 + 0.2 * p.noise(t * 6.5);
          const swing = 0.22 * Math.sin(t * 1.9) + (p.noise(12, t * 0.6) - 0.5) * 0.2;
          const hx = hand.x, hy = hand.y + bob, L = 10;
          state.x = hx + Math.sin(swing) * L; state.y = hy + Math.cos(swing) * L; state.f = flick;
          // the pool of light on the path moves with the lantern
          c.save(); c.globalCompositeOperation = "screen";
          c.translate(state.x - 14, 374); c.scale(1, 0.3);
          const pg = c.createRadialGradient(0, 0, 0, 0, 0, 170);
          pg.addColorStop(0, `rgba(255,168,72,${0.42 * flick})`); pg.addColorStop(0.3, `rgba(255,168,72,${0.2 * flick})`); pg.addColorStop(1, "rgba(255,168,72,0)");
          c.fillStyle = pg; c.fillRect(-170, -170, 340, 340);
          c.restore();
          if (sprite) p.image(sprite, red.x + spr.x, red.y + bob + spr.y, spr.w, spr.h);
          p.stroke(20, 40, 10); p.strokeWeight(1.1); p.line(hx, hy, state.x, state.y - 5);
          c.save(); c.globalCompositeOperation = "screen";
          for (const [r, col, a] of [[210, "255,154,61", 0.2], [80, "255,178,77", 0.45], [20, "255,228,160", 0.95]] as const) {
            const g = c.createRadialGradient(state.x, state.y, 0, state.x, state.y, r);
            g.addColorStop(0, `rgba(${col},${a * flick})`); g.addColorStop(0.3, `rgba(${col},${a * 0.5 * flick})`); g.addColorStop(1, `rgba(${col},0)`);
            c.fillStyle = g; c.fillRect(state.x - r, state.y - r, r * 2, r * 2);
          }
          c.restore();
          p.push(); p.translate(state.x, state.y); p.rotate(-swing);
          p.noStroke(); p.fill(48, 30, 100); p.ellipse(0, 0, 6.4, 8.6);
          p.noFill(); p.stroke(20, 40, 10); p.strokeWeight(0.9); p.rect(-4.5, -6, 9, 12, 1);
          p.line(-4.5, -6, 0, -8); p.line(4.5, -6, 0, -8); p.line(0, -6, 0, 6);
          p.pop();
          // moths circling the light
          for (const m of moths) {
            m.a += m.sp * dt; m.flap += dt * 28;
            const jx = (p.noise(m.seed, t * 1.5) - 0.5) * 14, jy = (p.noise(m.seed + 5, t * 1.5) - 0.5) * 12;
            const mx = state.x + Math.cos(m.a) * m.r + jx, my = state.y + Math.sin(m.a) * m.r * 0.7 + jy;
            const wgt = Math.abs(Math.sin(m.flap));
            p.noStroke(); p.fill(40, 25, 96, 85);
            p.ellipse(mx - 1.2, my, 2.6, 1.4 + wgt * 1.6); p.ellipse(mx + 1.2, my, 2.6, 1.4 + wgt * 1.6);
          }
        },
      };
    }

    // ---------- casting each scene ----------

    function cast(): Actor[] {
      const k = density;
      const front = layout.front;
      if (kind === "tortoise-and-hare") {
        const hareX = 412;
        return [
          twinkles(40),
          fireflies(26 * Math.max(0.6, k), [30, 570, 200, 330]),
          meadowGrass(300 * k, front, [0, 8]),
          wildflowers(40 * k, front, [0, 8]),
          skatingTortoise(front, 1.7),
          hare(hareX, front(hareX) + 7, 2.05),
          meadowGrass(480 * k, front, [9, 46]),
          wildflowers(90 * k, front, [10, 50]),
          fireflies(30 * Math.max(0.6, k), layout.fireflies!),
        ];
      }
      if (kind === "noahs-ark") return [twinkles(36), arkAtSea(), dove()];
      if (kind === "three-little-pigs") {
        const wf = wolf(layout.wolf!, 0.62);
        return [twinkles(28), wf, smoke(layout.chimney!), windowLights(20), windowPigs(wf.howl), meadowGrass(400 * k, front, [0, 30]), wildflowers(60 * k, front, [4, 30]), fireflies(30 * Math.max(0.6, k), layout.fireflies!)];
      }
      if (kind === "little-red-riding-hood") {
        const lw = lanternWalk();
        const light = () => ({ x: layout.hand!.x, y: layout.hand!.y + 10, f: 0.9 });
        return [twinkles(14), fireflies(9, layout.fireflies!, 70), lw, meadowGrass(380 * k, front, [0, 14], light)];
      }
      return [twinkles(36), meadowGrass(560 * k, front, [0, 46]), wildflowers(120 * k, front, [0, 50]), fireflies(60 * Math.max(0.6, k), layout.fireflies ?? [30, 570, 230, 400])];
    }

    // ---------- p5 lifecycle ----------

    p.setup = () => {
      measure();
      p.createCanvas(w, h);
      p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
      p.colorMode(p.HSB, 360, 100, 100, 100);
      p.frameRate(30);
      build();
      if (reduced) { p.noLoop(); p.redraw(); }
    };

    let last = 0;
    p.draw = () => {
      if (!bg || !vig) return;
      const t = reduced ? 4.2 : p.millis() / 1000;
      const dt = reduced ? 0 : Math.min(0.05, Math.max(0, t - last));
      last = t;
      p.image(bg, 0, 0, w, h);
      p.push(); p.translate(ox, oy); p.scale(s);
      for (const a of actors) a.draw(t, dt);
      p.pop();
      p.image(vig, 0, 0, w, h);
    };

    p.relayout = () => {
      const pw = w, ph = h;
      measure();
      if (Math.abs(pw - w) < 2 && Math.abs(ph - h) < 2) return;
      p.resizeCanvas(w, h);
      build();
      if (reduced) p.redraw();
    };
  };
}
