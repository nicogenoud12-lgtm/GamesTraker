// A burst of sparks (and a little buzz on phones) for the best ratings.

const COLORS = ['#c084fc', '#e9d5ff', '#facc15', '#fde68a', '#ffffff', '#f0abfc'];

export function celebrate(origin?: { x: number; y: number }) {
  try {
    navigator.vibrate?.([18, 50, 28, 50, 60]);
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

  const x0 = origin?.x ?? w / 2;
  const y0 = origin?.y ?? h * 0.42;
  const parts = Array.from({ length: 90 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 8;
    return {
      x: x0,
      y: y0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: 2 + Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      star: Math.random() < 0.35,
      spin: Math.random() * Math.PI,
      life: 0.75 + Math.random() * 0.5,
    };
  });

  const duration = 1500;
  const start = performance.now();
  const frame = (now: number) => {
    const t = (now - start) / duration;
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.vx *= 0.975;
      p.vy = p.vy * 0.975 + 0.22;
      p.x += p.vx;
      p.y += p.vy;
      p.spin += 0.15;
      const alpha = Math.max(0, 1 - t / p.life);
      if (!alpha) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.star) drawStar(ctx, p.x, p.y, p.size * 1.8, p.spin);
      else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (t < 1.3) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 ? r * 0.38 : r;
    const a = rot + (i * Math.PI) / 4;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
}
