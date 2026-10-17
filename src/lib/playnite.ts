import { create } from 'zustand';
import { api } from './sync';
import { currentKeys, itemDetail } from './catalog';
import { rawgSearch } from './rawg';
import { localDay } from './format';
import type { Game } from './types';
import { useSync } from '../store/useSync';
import { NEXT_LIST_ID, PLAYING_LIST_ID, useStore } from '../store/useStore';
import { useToast } from '../store/useToast';

// Playnite (the PC launcher), through a small extension that reports to our server:
// games started go into "Jugando ahora" on their own, the ones marked beaten or
// completed wait to be rated, and the hours played show on each game.

export interface PlayniteItem {
  key: string;
  /** App id, "rawg:123". */
  id: string;
  title: string;
  year: number | null;
  /** Started (playing) or finished (to rate), ms. */
  at: number;
  /** To rate: hours in Playnite and how it was finished. */
  hours?: number | null;
  status?: 'terminado' | 'completado';
}

export interface PlayniteStatus {
  connected: boolean;
  /** The extension's last report; null until it's installed and Playnite opened. */
  lastReportAt?: string | null;
  /** What the last report was: Playnite opening ("library"), or a game started or stopped, and which. */
  lastEvent?: 'library' | 'started' | 'stopped' | null;
  lastGame?: string | null;
  lastCount?: number;
  /** Reported games the server didn't find in RAWG by that name; the app looks them up itself. */
  unmatched?: { name: string; year: number | null }[];
  /** Why the server couldn't search RAWG (no key, RAWG's error), when it couldn't. */
  matchError?: string | null;
  games?: number;
  pending: PlayniteItem[];
  playing: PlayniteItem[];
  /** Hours played per game, by app id. */
  hours: Record<string, number>;
}

export const usePlaynite = create<{ status: PlayniteStatus | null }>()(() => ({ status: null }));

export async function refreshPlaynite(): Promise<PlayniteStatus | null> {
  if (!useSync.getState().token) {
    usePlaynite.setState({ status: null });
    return null;
  }
  try {
    const status = await api<PlayniteStatus>('GET', '/playnite');
    usePlaynite.setState({ status });
    void addPlaying(status.playing);
    void resolveUnmatched(status.unmatched);
    return status;
  } catch {
    // An older server without Playnite, or offline.
    return usePlaynite.getState().status;
  }
}

const simplify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\s*\((19|20)\d{2}\)\s*$/, '')
    .replace(/[^a-z0-9]/g, '');

/** The same name (and a year off by one at most); a longer or shorter subtitle only from the same year. */
function pickGame(results: Game[], name: string, year: number | null): Game | null {
  const want = simplify(name);
  const yearOf = (g: Game) => (g.released ? Number(g.released.slice(0, 4)) : null);
  const near = (g: Game) => !year || !yearOf(g) || Math.abs(yearOf(g)! - year) <= 1;
  const exact = results.filter((g) => simplify(g.name) === want);
  return (
    exact.find(near) ??
    exact[0] ??
    results.find((g) => near(g) && year && (simplify(g.name).startsWith(want) || want.startsWith(simplify(g.name)))) ??
    null
  );
}

// Asked once per session: the ones RAWG doesn't have by that name stay listed in Ajustes.
const tried = new Set<string>();
let resolving = false;

/**
 * When the server can't find a Playnite game in RAWG (it has no key, or RAWG
 * failed it), the app looks it up with its own key and tells the server.
 */
async function resolveUnmatched(items: PlayniteStatus['unmatched']): Promise<void> {
  const key = currentKeys().rawg;
  const todo = (items ?? []).filter((u) => !tried.has(u.name)).slice(0, 40);
  if (resolving || !key || !todo.length) return;
  resolving = true;
  try {
    const matches: { name: string; game: { id: number; name: string; released: string | null; image: string | null; genres: string[]; platforms: string[] } }[] = [];
    for (let i = 0; i < todo.length; i += 4) {
      await Promise.all(
        todo.slice(i, i + 4).map(async (u) => {
          tried.add(u.name);
          const g = pickGame(await rawgSearch(key, u.name).catch(() => []), u.name, u.year);
          if (g) {
            matches.push({
              name: u.name,
              game: { id: Number(g.id.slice(5)), name: g.name, released: g.released, image: g.cover, genres: g.genres.slice(0, 3), platforms: g.platforms.slice(0, 4) },
            });
          }
        }),
      );
    }
    if (!matches.length) return;
    const status = await api<PlayniteStatus>('POST', '/playnite/resolve', { matches });
    usePlaynite.setState({ status });
    void addPlaying(status.playing);
  } catch {
    // Tried again next session.
  } finally {
    resolving = false;
  }
}

let adding = false;

/** Puts what was started in Playnite at the top of "Jugando ahora", once per game, from the day it was started. */
async function addPlaying(items: PlayniteItem[] | undefined): Promise<void> {
  if (adding || !items?.length) return;
  adding = true;
  try {
    const added: string[] = [];
    for (const p of [...items].reverse()) {
      const store = useStore.getState();
      if (store.ratings[p.id] || store.lists.find((l) => l.id === PLAYING_LIST_ID)?.gameIds.includes(p.id)) continue;
      const fallback: Game = { id: p.id, name: p.title, cover: null, released: p.year ? `${p.year}-01-01` : null, genres: [], platforms: [] };
      const game = (await itemDetail(currentKeys(), p.id).catch(() => null)) ?? fallback;
      store.addToList(PLAYING_LIST_ID, game, 'top');
      // Like "Empezar a jugar": it leaves "Próximos a jugar".
      store.removeFromList(NEXT_LIST_ID, p.id);
      useStore.getState().setStart(p.id, localDay(new Date(p.at)));
      added.push(p.title);
    }
    await api('POST', '/playnite/playing', { ids: items.map((p) => p.id) });
    const status = usePlaynite.getState().status;
    if (status) usePlaynite.setState({ status: { ...status, playing: [] } });
    if (added.length) {
      useToast.getState().show(added.length === 1 ? `${added[0]} pasó a Jugando ahora (Playnite)` : `${added.length} juegos pasaron a Jugando ahora (Playnite)`);
    }
  } catch {
    // Offered again on the next check.
  } finally {
    adding = false;
  }
}

export async function dismissPlaynite(key: string): Promise<void> {
  const status = usePlaynite.getState().status;
  if (status) usePlaynite.setState({ status: { ...status, pending: status.pending.filter((p) => p.key !== key) } });
  await api('POST', '/playnite/dismiss', { key }).catch(() => {});
}

/** The extension with this account's key in it, saved as GamesTracker.pext (Playnite installs it with a double click). */
export async function downloadPlayniteExtension(): Promise<void> {
  const token = useSync.getState().token;
  const res = await fetch(`/api/playnite/extension?${new URLSearchParams({ origin: window.location.origin })}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = 'GamesTracker.pext';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  await refreshPlaynite();
}

export async function disconnectPlaynite(): Promise<void> {
  await api('POST', '/playnite/disconnect');
  await refreshPlaynite();
}
