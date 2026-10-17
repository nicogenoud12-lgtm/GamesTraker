import { create } from 'zustand';
import { api } from './sync';
import { currentKeys, itemDetail } from './catalog';
import { localDay } from './format';
import type { Game } from './types';
import { useSync } from '../store/useSync';
import { PLAYING_LIST_ID, useStore } from '../store/useStore';
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
  /** Reported games that RAWG doesn't know by that name. */
  unmatched?: string[];
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
    return status;
  } catch {
    // An older server without Playnite, or offline.
    return usePlaynite.getState().status;
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
