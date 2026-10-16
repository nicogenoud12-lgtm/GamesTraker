import { useEffect, useState } from 'react';
import { coverUrl, loadImage } from './shareImage';
import { useGameCover } from './covers';
import type { Game } from './types';

// The detail page takes on the cover's color. The cover is fetched through our
// server (/api/img) so its pixels can be read, shrunk to a few pixels and the
// most vivid, common color picked. Results are cached per title.

// "-2": games' colors now come from IGDB's box art instead of RAWG's image.
const KEY = 'gamestraker-tints-2';
const MAX = 400;

type Cache = Record<string, string>;

try {
  localStorage.removeItem('gamestraker-tints');
} catch {
  // Storage blocked: nothing to clean up.
}

function readCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Cache;
  } catch {
    return {};
  }
}

function remember(id: string, color: string) {
  try {
    const cache = readCache();
    delete cache[id];
    cache[id] = color;
    const ids = Object.keys(cache);
    for (const old of ids.slice(0, Math.max(0, ids.length - MAX))) delete cache[old];
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // A full or blocked storage only means we compute it again next time.
  }
}

function hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

/** Picks a vivid color that covers a good part of the image; falls back to its average. */
export function dominantColor(img: HTMLImageElement): string | null {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return null;
  }

  // Bucket pixels by hue; each pixel weighs more the more saturated it is.
  const buckets = Array.from({ length: 12 }, () => ({
    w: 0,
    r: 0,
    g: 0,
    b: 0,
  }));
  let ar = 0;
  let ag = 0;
  let ab = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    ar += r;
    ag += g;
    ab += b;
    const [h, s, l] = hsl(r, g, b);
    if (l < 0.12 || l > 0.9 || s < 0.2) continue;
    const w = s * s * (1 - Math.abs(l - 0.5));
    const bucket = buckets[Math.floor(h / 30) % 12];
    bucket.w += w;
    bucket.r += r * w;
    bucket.g += g * w;
    bucket.b += b * w;
  }
  const best = buckets.reduce((a, b) => (b.w > a.w ? b : a));
  // Too little color (black & white posters): use the average, which will be greyish.
  const [r, g, b] = best.w > n * 0.02 ? [best.r / best.w, best.g / best.w, best.b / best.w] : [ar / n, ag / n, ab / n];
  return toCss(r, g, b);
}

/** Keeps the hue but makes sure it reads as a glow on the dark background. */
function toCss(r: number, g: number, b: number): string {
  const [h, s, l] = hsl(r, g, b);
  const light = Math.min(0.62, Math.max(0.45, l));
  const sat = Math.min(0.85, s * 1.15);
  return `hsl(${Math.round(h)} ${Math.round(sat * 100)}% ${Math.round(light * 100)}%)`;
}

const inFlight = new Map<string, Promise<string | null>>();

export function coverTint(game: Pick<Game, 'id' | 'cover' | 'name'>): Promise<string | null> {
  const cached = readCache()[game.id];
  if (cached) return Promise.resolve(cached);
  const src = coverUrl(game as Game);
  if (!src) return Promise.resolve(null);
  let job = inFlight.get(game.id);
  if (!job) {
    job = loadImage(src)
      .then((img) => (img ? dominantColor(img) : null))
      .then((color) => {
        if (color) remember(game.id, color);
        return color;
      })
      .finally(() => inFlight.delete(game.id));
    inFlight.set(game.id, job);
  }
  return job;
}

/** The cover's color as a CSS color, or null while it's not known. */
export function useCoverTint(game: Pick<Game, 'id' | 'cover' | 'name' | 'released'> | null): string | null {
  const id = game?.id;
  const { cover, waiting } = useGameCover(game ?? { name: '', cover: null });
  const [tint, setTint] = useState<string | null>(() => (id ? (readCache()[id] ?? null) : null));
  useEffect(() => {
    if (!id || waiting) return;
    let alive = true;
    setTint(readCache()[id] ?? null);
    coverTint({ id, cover: cover ?? null, name: '' }).then((c) => alive && c && setTint(c));
    return () => {
      alive = false;
    };
  }, [id, cover, waiting]);
  return tint;
}
