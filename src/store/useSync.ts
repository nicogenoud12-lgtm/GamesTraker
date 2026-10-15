import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SyncStatus = 'off' | 'syncing' | 'ok' | 'error';

interface SyncState {
  /** Shared secret set as SYNC_TOKEN on the server; kept per device. */
  token: string;
  status: SyncStatus;
  error: string | null;
  lastSyncAt: number | null;
  setToken: (token: string) => void;
}

export const useSync = create<SyncState>()(
  persist(
    (set) => ({
      token: '',
      status: 'off',
      error: null,
      lastSyncAt: null,
      setToken: (token) => set({ token: token.trim(), status: token.trim() ? 'syncing' : 'off', error: null }),
    }),
    { name: 'gamestraker-sync', partialize: (s) => ({ token: s.token, lastSyncAt: s.lastSyncAt }) },
  ),
);
