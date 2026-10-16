import { create } from 'zustand';
import { api } from './sync';
import { currentKeys } from './catalog';
import { tmdbItem } from './tmdb';
import type { Game } from './types';
import { useSync } from '../store/useSync';
import { WATCHING_LIST_ID, useStore } from '../store/useStore';
import { useToast } from '../store/useToast';

// Trakt (fed by Nuvio): what was finished and is waiting to be rated, and what's
// half-watched, which goes into "Viendo ahora" on its own.

export interface ToRate {
  key: string;
  /** App id, e.g. "tmdb:tv:1396". */
  id: string;
  kind: 'movie' | 'tv';
  title: string;
  year: number | null;
  at: number;
}

export interface TraktStatus {
  /** The server has a Trakt app configured. */
  enabled: boolean;
  connected: boolean;
  /** Connected, but Trakt stopped accepting the session: connect again. */
  broken?: boolean;
  account?: string | null;
  pending: ToRate[];
  /** Half-watched on Trakt and not yet put in "Viendo ahora" (older servers don't send it). */
  watching?: ToRate[];
}

export const useTrakt = create<{ status: TraktStatus | null }>()(() => ({ status: null }));

export async function refreshTrakt(): Promise<TraktStatus | null> {
  if (!useSync.getState().token) {
    useTrakt.setState({ status: null });
    return null;
  }
  try {
    const status = await api<TraktStatus>('GET', '/trakt');
    useTrakt.setState({ status });
    void addWatching(status.watching);
    return status;
  } catch {
    return useTrakt.getState().status;
  }
}

export const startTrakt = () =>
  api<{ userCode: string; url: string; interval: number; expiresIn: number }>('POST', '/trakt/connect');
export const pollTrakt = () => api<{ status: 'pending' | 'connected' | 'expired' | 'denied' }>('POST', '/trakt/poll');

export async function checkTraktNow(): Promise<void> {
  const status = await api<TraktStatus>('POST', '/trakt/check');
  useTrakt.setState({ status });
  await addWatching(status.watching);
}

let adding = false;

/** Puts what's half-watched on Trakt at the top of "Viendo ahora", once per title. */
async function addWatching(items: ToRate[] | undefined): Promise<void> {
  if (adding || !items?.length) return;
  adding = true;
  try {
    const key = currentKeys().tmdb;
    const added: string[] = [];
    // Oldest first, so the most recent ends up on top.
    for (const w of [...items].reverse()) {
      const inList = useStore.getState().lists.find((l) => l.id === WATCHING_LIST_ID)?.gameIds.includes(w.id);
      if (!inList) {
        const fallback: Game = { id: w.id, name: w.title, cover: null, released: w.year ? `${w.year}-01-01` : null, genres: [], platforms: [] };
        const game = key ? await tmdbItem(key, w.kind, w.id.split(':')[2]).catch(() => fallback) : fallback;
        useStore.getState().addToList(WATCHING_LIST_ID, game, 'top');
        added.push(w.title);
      }
    }
    await api('POST', '/trakt/watching', { keys: items.map((w) => w.key) });
    const status = useTrakt.getState().status;
    if (status) useTrakt.setState({ status: { ...status, watching: [] } });
    if (added.length) {
      useToast.getState().show(added.length === 1 ? `${added[0]} pasó a Viendo ahora (Trakt)` : `${added.length} títulos pasaron a Viendo ahora (Trakt)`);
    }
  } catch {
    // Offered again on the next check.
  } finally {
    adding = false;
  }
}

export async function dismissToRate(key: string): Promise<void> {
  const status = useTrakt.getState().status;
  if (status) useTrakt.setState({ status: { ...status, pending: status.pending.filter((p) => p.key !== key) } });
  await api('POST', '/trakt/dismiss', { key }).catch(() => {});
}

export async function disconnectTrakt(): Promise<void> {
  await api('POST', '/trakt/disconnect');
  await refreshTrakt();
}
