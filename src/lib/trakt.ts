import { create } from 'zustand';
import { api } from './sync';
import { useSync } from '../store/useSync';

// Trakt (fed by Nuvio): what was finished and is waiting to be rated.

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
    return status;
  } catch {
    return useTrakt.getState().status;
  }
}

export const startTrakt = () =>
  api<{ userCode: string; url: string; interval: number; expiresIn: number }>('POST', '/trakt/connect');
export const pollTrakt = () => api<{ status: 'pending' | 'connected' | 'expired' | 'denied' }>('POST', '/trakt/poll');

export async function checkTraktNow(): Promise<void> {
  useTrakt.setState({ status: await api<TraktStatus>('POST', '/trakt/check') });
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
