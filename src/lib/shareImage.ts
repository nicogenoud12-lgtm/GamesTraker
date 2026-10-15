import { resizeImage } from './rawg';
import type { Game } from './types';

// Story-sized images (1080×1920) drawn on a canvas, for sharing a rating or
// the year in review. Covers go through our server (/api/img) because a canvas
// with images from other sites can't be exported.

export const W = 1080;
export const H = 1920;

export function coverUrl(game: Game): string | null {
  if (!game.cover) return null;
  if (game.cover.startsWith('data:')) return game.cover;
  const src = resizeImage(game.cover, 640) ?? game.cover;
  return `/api/img?${new URLSearchParams({ url: src })}`;
}

export function loadImage(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), 8000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

export async function loadFonts() {
  await Promise.all(
    ['700 80px "Space Grotesk"', '500 40px "Space Grotesk"', '400 36px "Inter Variable"', '600 36px "Inter Variable"'].map((f) =>
      document.fonts.load(f).catch(() => null),
    ),
  );
}

export function newCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  return [canvas, canvas.getContext('2d')!];
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws an image filling the box (like object-fit: cover), or a gradient when there is none. */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  colors: [string, string] = ['#2a2440', '#14121c'],
) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  if (img) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

/** Splits text into at most `maxLines` lines that fit `maxWidth`, with "…" when cut. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return lines;
}

/** "GamesTraker" with the second half in the accent color, centred at y. */
export function drawLogo(ctx: CanvasRenderingContext2D, y: number, accent: string, size = 44) {
  ctx.font = `700 ${size}px "Space Grotesk"`;
  ctx.textBaseline = 'alphabetic';
  const a = 'Games';
  const b = 'Traker';
  const wa = ctx.measureText(a).width;
  const wb = ctx.measureText(b).width;
  const x = (W - wa - wb) / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(a, x, y);
  ctx.fillStyle = accent;
  ctx.fillText(b, x + wa, y);
  ctx.textAlign = 'center';
}

export function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))), 'image/png'),
  );
}

export function canShareFiles(): boolean {
  try {
    return Boolean(navigator.canShare?.({ files: [new File([], 'x.png', { type: 'image/png' })] }));
  } catch {
    return false;
  }
}

export async function shareImage(blob: Blob, filename: string, title: string) {
  const file = new File([blob], filename, { type: 'image/png' });
  await navigator.share({ files: [file], title });
}

export function downloadImage(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
