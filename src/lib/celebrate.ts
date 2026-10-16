// Fireworks for a Histórico: a few rockets rise from the bottom of the screen
// and burst, one after another, into sparks that fall, twinkle and fade.
// About two seconds in total, drawn on a throwaway canvas above everything.

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds this spark lives. */
  life: number;
  age: number;
  color: string;
  size: number;
  /** Recent positions, for the short glowing trail. */
  trail: { x: number; y: number }[];
}

interface Rocket {
  /** When it launches, in seconds from the start. */
  at: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Seconds it takes to reach the top. */
  rise: number;
  palette: string[];
  burst: boolean;
}

// Each burst has its own colors; the whole show stays in the Histórico tones.
const PALETTES = [
  ['#fde68a', '#facc15', '#fff7d6'], // gold
  ['#e9d5ff', '#c084fc', '#f0abfc'], // violet
  ['#cffafe', '#67e8f9', '#ffffff'], // ice
  ['#fbcfe8', '#f472b6', '#fde68a'], // pink & gold
];

const GRAVITY = 260; // px/s²
const DRAG = 1.9; // per second
const DURATION = 2.1; // seconds

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function celebrate() {
  // Little buzzes timed with the bursts (phones that allow it).
  try {
    navigator.vibrate?.([0, 560, 26, 220, 30, 220, 40]);
  } catch {
    // Some browsers throw when vibration isn't allowed; it's just a bonus.
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: `${w}px`,
    height: `${h}px`,
    pointerEvents: 'none',
    zIndex: '100',
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.remove();
  ctx.scale(dpr, dpr);

  // Three rockets, staggered, spread across the screen (a fourth on wide screens).
  const count = w > 700 ? 4 : 3;
  const palettes = [...PALETTES].sort(() => Math.random() - 0.5);
  const rockets: Rocket[] = Array.from({ length: count }, (_, i) => {
    const lane = (i + 0.5) / count;
    const x1 = w * (lane + rand(-0.06, 0.06));
    return {
      at: i * 0.22 + rand(0, 0.06),
      x0: x1 + rand(-30, 30),
      y0: h + 10,
      x1,
      y1: h * rand(0.2, 0.38),
      rise: rand(0.5, 0.62),
      palette: palettes[i % palettes.length],
      burst: false,
    };
  });
  // The middle one goes first: it reads as the main firework.
  rockets.sort((a, b) => Math.abs(a.x1 - w / 2) - Math.abs(b.x1 - w / 2)).forEach((r, i) => (r.at = i * 0.22 + rand(0, 0.05)));

  const sparks: Spark[] = [];
  const flashes: { x: number; y: number; at: number; color: string }[] = [];

  const explode = (r: Rocket, t: number) => {
    r.burst = true;
    flashes.push({ x: r.x1, y: r.y1, at: t, color: r.palette[0] });
    const n = Math.round(rand(70, 90));
    const speed = Math.min(w, h) * rand(0.62, 0.74);
    for (let i = 0; i < n; i++) {
      // Evenly around the circle with a little jitter, so the burst is round but not mechanical.
      const angle = (i / n) * Math.PI * 2 + rand(-0.08, 0.08);
      const v = speed * rand(0.55, 1);
      sparks.push({
        x: r.x1,
        y: r.y1,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: rand(0.9, 1.35),
        age: 0,
        color: r.palette[Math.floor(Math.random() * r.palette.length)],
        size: rand(1.2, 2.2),
        trail: [],
      });
    }
  };

  const ease = (p: number) => 1 - (1 - p) ** 3;
  let last = performance.now();
  const start = last;

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - start) / 1000;

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    // Rockets on their way up: a bright head with a fading tail.
    for (const r of rockets) {
      if (r.burst || t < r.at) continue;
      const p = (t - r.at) / r.rise;
      if (p >= 1) {
        explode(r, t);
        continue;
      }
      const e = ease(p);
      const x = r.x0 + (r.x1 - r.x0) * e;
      const y = r.y0 + (r.y1 - r.y0) * e;
      const tail = ctx.createLinearGradient(x, y, x, y + 70);
      tail.addColorStop(0, `${r.palette[0]}cc`);
      tail.addColorStop(1, `${r.palette[0]}00`);
      ctx.strokeStyle = tail;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - (r.x1 - r.x0) * 0.08, y + 70);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // A soft flash where each one bursts.
    for (const f of flashes) {
      const a = 1 - (t - f.at) / 0.35;
      if (a <= 0) continue;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 90);
      g.addColorStop(0, `${f.color}${Math.round(a * 140).toString(16).padStart(2, '0')}`);
      g.addColorStop(1, `${f.color}00`);
      ctx.fillStyle = g;
      ctx.fillRect(f.x - 90, f.y - 90, 180, 180);
    }

    // Sparks: drag slows them, gravity pulls them down, they twinkle as they die.
    const drag = Math.exp(-DRAG * dt);
    for (const s of sparks) {
      s.age += dt;
      if (s.age >= s.life) continue;
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 6) s.trail.shift();
      s.vx *= drag;
      s.vy = s.vy * drag + GRAVITY * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      const left = 1 - s.age / s.life;
      const twinkle = left < 0.45 ? 0.45 + 0.55 * Math.abs(Math.sin(s.age * 38 + s.x)) : 1;
      const alpha = Math.min(1, left * 1.6) * twinkle;

      ctx.globalAlpha = alpha * 0.55;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.beginPath();
      ctx.moveTo(s.trail[0].x, s.trail[0].y);
      for (const p of s.trail) ctx.lineTo(p.x, p.y);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
