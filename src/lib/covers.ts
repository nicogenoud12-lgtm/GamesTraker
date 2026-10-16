import { create } from 'zustand';
import { useEffect, useState } from 'react';
import { useSync } from '../store/useSync';
import type { Game } from './types';

// Game covers from IGDB (the actual box art) instead of RAWG's landscape
// background. Asked to our server in batches, as covers come on screen, and
// remembered on the device: a found cover for good, a missing one for a week.

const KEY = 'gamestraker-covers';
const MISS_TTL = 7 * 864e5;
/** How long a cover waits for IGDB's before showing RAWG's. */
const WAIT_MS = 2500;

type Saved = Record<string, { url: string | null; at: number }>;

function load(): Record<string, string | null> {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Saved;
    return Object.fromEntries(
      Object.entries(saved)
        .filter(([, v]) => v.url || Date.now() - v.at < MISS_TTL)
        .map(([id, v]) => [id, v.url]),
    );
  } catch {
    return {};
  }
}

function save(found: Record<string, string | null>) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Saved;
    for (const [id, url] of Object.entries(found)) saved[id] = { url, at: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Storage full or blocked: asked again next time.
  }
}

/** id → IGDB cover, or null when IGDB has none (RAWG's is used). Missing: not known yet. */
const useCovers = create<{ covers: Record<string, string | null> }>(() => ({ covers: load() }));

export const isRawg = (id: string | undefined) => Boolean(id?.startsWith('rawg:'));

const queue = new Map<string, { id: string; name: string; year: number | null }>();
const asked = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function settle(found: Record<string, string | null>, remember: boolean) {
  useCovers.setState((s) => ({ covers: { ...s.covers, ...found } }));
  if (remember) save(found);
}

async function flush() {
  timer = null;
  const batch = [...queue.values()];
  queue.clear();
  const token = useSync.getState().token;
  const fallback = Object.fromEntries(batch.map((g) => [g.id, null]));
  // Signed out (or an older server): RAWG's covers, without remembering it.
  if (!token) return settle(fallback, false);
  for (let i = 0; i < batch.length; i += 40) {
    const part = batch.slice(i, i + 40);
    try {
      const res = await fetch('/api/covers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ games: part }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { covers } = (await res.json()) as { covers: Record<string, string | null> };
      settle(covers, true);
      // Left out by the server: it couldn't ask IGDB now. RAWG's for this visit.
      settle(Object.fromEntries(part.filter((g) => !(g.id in covers)).map((g) => [g.id, null])), false);
    } catch {
      settle(Object.fromEntries(part.map((g) => [g.id, null])), false);
    }
  }
}

function request(game: Pick<Game, 'id' | 'name' | 'released'>) {
  if (asked.has(game.id)) return;
  asked.add(game.id);
  queue.set(game.id, { id: game.id, name: game.name, year: Number(game.released?.slice(0, 4)) || null });
  timer ??= setTimeout(() => void flush(), 40);
}

/** The best known cover right now, without asking: for snapshots, share images and the like. */
export function bestCover(game: Pick<Game, 'cover'> & { id?: string }): string | null {
  if (!isRawg(game.id)) return game.cover;
  return useCovers.getState().covers[game.id!] ?? game.cover;
}

/**
 * The cover to show: IGDB's for RAWG games. `waiting` is true for a moment while
 * IGDB's is looked up, so RAWG's doesn't flash before being replaced.
 */
export function useGameCover(game: Pick<Game, 'name' | 'cover'> & { id?: string; released?: string | null }): {
  cover: string | null;
  waiting: boolean;
} {
  const id = isRawg(game.id) ? game.id! : null;
  // A string or null (never a fresh object), so the selector is stable.
  const known = useCovers((s) => (id ? s.covers[id] : undefined));
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!id || known !== undefined || !game.name) return;
    request({ id, name: game.name, released: game.released ?? null });
    setLate(false);
    const t = setTimeout(() => setLate(true), WAIT_MS);
    return () => clearTimeout(t);
  }, [id, known, game.name]);
  if (!id) return { cover: game.cover, waiting: false };
  if (known === undefined) return { cover: late ? game.cover : null, waiting: !late };
  return { cover: known ?? game.cover, waiting: false };
}

/** Asks the server for many covers at once; null when it couldn't answer for all of them. */
export async function askAll(games: { id: string; name: string; year: number | null }[]): Promise<Record<string, string | null> | null> {
  const token = useSync.getState().token;
  if (!token) return null;
  const all: Record<string, string | null> = {};
  for (let i = 0; i < games.length; i += 40) {
    const part = games.slice(i, i + 40);
    try {
      const res = await fetch('/api/covers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ games: part }),
      });
      if (!res.ok) return null;
      const { covers } = (await res.json()) as { covers: Record<string, string | null> };
      settle(covers, true);
      Object.assign(all, covers);
      if (part.some((g) => !(g.id in covers))) return null;
    } catch {
      return null;
    }
  }
  return all;
}
