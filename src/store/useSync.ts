import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SyncStatus = 'off' | 'syncing' | 'ok' | 'error';

export interface ServerInfo {
  hasUsers: boolean;
  signupOpen: boolean;
}

interface SyncState {
  /** Session token from logging in; kept per device. */
  token: string;
  username: string;
  status: SyncStatus;
  error: string | null;
  lastSyncAt: number | null;
  /** null while unknown or when the app runs without the sync server (e.g. local dev). */
  server: ServerInfo | null;
  /** The home screen invite to log in was closed. */
  inviteDismissed: boolean;
  setSession: (token: string, username: string) => void;
  logout: (reason?: string) => void;
}

export const useSync = create<SyncState>()(
  persist(
    (set) => ({
      token: '',
      username: '',
      status: 'off',
      error: null,
      lastSyncAt: null,
      server: null,
      inviteDismissed: false,
      setSession: (token, username) => set({ token, username, status: 'syncing', error: null }),
      logout: (reason) => set({ token: '', username: '', status: 'off', error: reason ?? null, lastSyncAt: null }),
    }),
    {
      name: 'gamestraker-sync',
      version: 2,
      partialize: (s) => ({ token: s.token, username: s.username, lastSyncAt: s.lastSyncAt, inviteDismissed: s.inviteDismissed }),
      // v1 stored the old shared SYNC_TOKEN, which is no longer a valid session.
      migrate: (persisted, version) => (version < 2 ? { inviteDismissed: false } : persisted) as SyncState,
    },
  ),
);
