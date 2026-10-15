import { KIND_LABEL, kindOf, MODES, type Mode, statusLabel } from './mode';
import {
  H,
  W,
  coverUrl,
  drawCover,
  drawLogo,
  loadFonts,
  loadImage,
  newCanvas,
  roundRect,
  wrapText,
} from './shareImage';
import { TIER_BY_ID } from './tiers';
import type { Game, Rating } from './types';

// The two shareable images: one rating, and the year in review.

const ACCENT: Record<Mode, [string, string]> = { games: ['#a78bfa', '#f472b6'], screen: ['#fbbf24', '#fb7185'] };

function background(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, mode: Mode) {
  ctx.fillStyle = '#0b0b10';
  ctx.fillRect(0, 0, W, H);
  if (img) {
    ctx.save();
    // Safari ignores canvas filters; the dark overlay below keeps text readable anyway.
    ctx.filter = 'blur(70px) saturate(1.3)';
    ctx.globalAlpha = 0.55;
    drawCover(ctx, img, -200, -200, W + 400, H + 400, 0);
    ctx.restore();
  } else {
    const [a, b] = ACCENT[mode];
    const g = ctx.createRadialGradient(W / 2, 300, 50, W / 2, 300, 1100);
    g.addColorStop(0, `${a}66`);
    g.addColorStop(0.6, `${b}22`);
    g.addColorStop(1, '#0b0b1000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(11,11,16,0.35)');
  shade.addColorStop(0.45, 'rgba(11,11,16,0.6)');
  shade.addColorStop(1, 'rgba(11,11,16,0.95)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
}

export async function ratingCard(game: Game, rating: Rating, mode: Mode): Promise<HTMLCanvasElement> {
  await loadFonts();
  const img = await loadImage(coverUrl(game));
  const [canvas, ctx] = newCanvas();
  const tier = TIER_BY_ID[rating.tier];
  background(ctx, img, mode);
  ctx.textAlign = 'center';
  drawLogo(ctx, 150, ACCENT[mode][0], MODES[mode].brand);

  // Cover with a soft shadow.
  const cw = 540;
  const ch = 720;
  const cx = (W - cw) / 2;
  const cy = 230;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 80;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = '#000';
  roundRect(ctx, cx, cy, cw, ch, 40);
  ctx.fill();
  ctx.restore();
  drawCover(ctx, img, cx, cy, cw, ch, 40);

  // Title and what it is.
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 76px "Space Grotesk"';
  const lines = wrapText(ctx, game.name, 940, 2);
  let y = cy + ch + 120;
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += 84;
  }
  const kind = kindOf(game.id);
  ctx.font = '400 38px "Inter Variable"';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText([kind ? KIND_LABEL[kind] : null, game.released?.slice(0, 4), statusLabel(game.id, rating.status)].filter(Boolean).join(' · '), W / 2, y);

  // Score in the tier's colour, with the word under it.
  y += 210;
  ctx.font = '700 230px "Space Grotesk"';
  ctx.fillStyle = tier.color;
  const scoreText = String(rating.score);
  const sw = ctx.measureText(scoreText).width;
  ctx.fillText(scoreText, W / 2 - 40, y);
  ctx.font = '500 52px "Space Grotesk"';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'left';
  ctx.fillText('/100', W / 2 - 40 + sw / 2 + 12, y);
  ctx.textAlign = 'center';

  const label = `${tier.emoji}  ${tier.label}`;
  ctx.font = '700 50px "Space Grotesk"';
  const lw = ctx.measureText(label).width + 90;
  y += 50;
  ctx.fillStyle = `${tier.color}2e`;
  roundRect(ctx, (W - lw) / 2, y, lw, 96, 48);
  ctx.fill();
  ctx.strokeStyle = `${tier.color}88`;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = tier.color;
  ctx.fillText(label, W / 2, y + 66);

  // The note, if any.
  if (rating.note.trim()) {
    ctx.font = 'italic 400 38px "Inter Variable"';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    let ny = y + 190;
    for (const line of wrapText(ctx, `“${rating.note.trim()}”`, 900, 3)) {
      ctx.fillText(line, W / 2, ny);
      ny += 52;
    }
  }

  ctx.font = '400 30px "Inter Variable"';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText(`Mi puntaje en ${MODES[mode].brand}Tracker`, W / 2, H - 80);
  return canvas;
}

export interface YearSummary {
  year: number;
  mode: Mode;
  count: number;
  average: number;
  legendary: number;
  hours: number | null;
  movies: number;
  series: number;
  goal: number | null;
  top: { game: Game; score: number; tier: Rating['tier'] }[];
}

export async function yearCard(s: YearSummary): Promise<HTMLCanvasElement> {
  await loadFonts();
  const covers = await Promise.all(s.top.map((t) => loadImage(coverUrl(t.game))));
  const [canvas, ctx] = newCanvas();
  const [a, b] = ACCENT[s.mode];
  background(ctx, null, s.mode);
  ctx.textAlign = 'center';
  drawLogo(ctx, 150, a, MODES[s.mode].brand);

  ctx.font = '700 170px "Space Grotesk"';
  const grad = ctx.createLinearGradient(200, 0, W - 200, 0);
  grad.addColorStop(0, a);
  grad.addColorStop(1, b);
  ctx.fillStyle = grad;
  ctx.fillText(`Mi ${s.year}`, W / 2, 400);
  ctx.font = '500 56px "Space Grotesk"';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(s.mode === 'games' ? 'en juegos' : 'en series y pelis', W / 2, 480);

  // 2×2 stat tiles.
  const tiles: [string, string][] =
    s.mode === 'games'
      ? [
          [String(s.count), s.count === 1 ? 'juego' : 'juegos'],
          [s.hours ? String(Math.round(s.hours)) : '—', 'horas jugadas'],
          [String(s.average), 'promedio'],
          [String(s.legendary), s.legendary === 1 ? 'histórico' : 'históricos'],
        ]
      : [
          [String(s.movies), s.movies === 1 ? 'película' : 'películas'],
          [String(s.series), s.series === 1 ? 'serie' : 'series'],
          [String(s.average), 'promedio'],
          [String(s.legendary), s.legendary === 1 ? 'histórico' : 'históricos'],
        ];
  const tw = 440;
  const th = 230;
  tiles.forEach(([value, label], i) => {
    const x = i % 2 === 0 ? W / 2 - tw - 20 : W / 2 + 20;
    const y = 580 + Math.floor(i / 2) * (th + 40);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, x, y, tw, th, 36);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 110px "Space Grotesk"';
    ctx.fillText(value, x + tw / 2, y + 130);
    ctx.font = '500 38px "Inter Variable"';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(label, x + tw / 2, y + 190);
  });

  let y = 580 + 2 * (th + 40) + 40;
  if (s.goal) {
    const pct = Math.min(1, s.count / s.goal);
    ctx.font = '500 38px "Inter Variable"';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`Meta: ${s.count} de ${s.goal} ${pct >= 1 ? '· ¡cumplida!' : ''}`.trim(), W / 2, y + 10);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    roundRect(ctx, 120, y + 40, W - 240, 28, 14);
    ctx.fill();
    if (pct > 0) {
      const bar = ctx.createLinearGradient(120, 0, W - 120, 0);
      bar.addColorStop(0, a);
      bar.addColorStop(1, b);
      ctx.fillStyle = bar;
      roundRect(ctx, 120, y + 40, Math.max(28, (W - 240) * pct), 28, 14);
      ctx.fill();
    }
    y += 140;
  } else {
    y += 40;
  }

  // Top of the year.
  if (s.top.length) {
    ctx.font = '700 48px "Space Grotesk"';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Mi top ${s.top.length}`, W / 2, y);
    const n = s.top.length;
    const gap = 24;
    const pw = Math.min(176, (W - 120 - gap * (n - 1)) / n);
    const ph = pw * (4 / 3);
    const startX = (W - (pw * n + gap * (n - 1))) / 2;
    s.top.forEach((t, i) => {
      const x = startX + i * (pw + gap);
      const py = y + 40;
      drawCover(ctx, covers[i], x, py, pw, ph, 20);
      const tier = TIER_BY_ID[t.tier];
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      roundRect(ctx, x + pw - 74, py + ph - 52, 64, 42, 12);
      ctx.fill();
      ctx.font = '700 30px "Space Grotesk"';
      ctx.fillStyle = tier.color;
      ctx.fillText(String(t.score), x + pw - 42, py + ph - 20);
      ctx.font = '600 24px "Inter Variable"';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      wrapText(ctx, t.game.name, pw, 2).forEach((line, k) => ctx.fillText(line, x + pw / 2, py + ph + 40 + k * 30));
    });
  }

  ctx.font = '400 30px "Inter Variable"';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText(`Mi año en ${MODES[s.mode].brand}Tracker`, W / 2, H - 80);
  return canvas;
}
