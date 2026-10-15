import { mergeData, stableStringify, type SyncData } from './merge';
import { useStore } from '../store/useStore';
import { useSync } from '../store/useSync';

interface RemoteDoc {
  version: number;
  updatedAt: string | null;
  data: SyncData | null;
}

const EMPTY: SyncData = { games: {}, ratings: {}, lists: [], ratingTombs: {}, listTombs: {} };
const PUSH_DELAY_MS = 1500;
const POLL_MS = 60_000;

class SyncError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function pick(): SyncData {
  const { games, ratings, lists, ratingTombs, listTombs } = useStore.getState();
  return { games, ratings, lists, ratingTombs, listTombs };
}

async function request<T>(method: 'GET' | 'PUT', token: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api/state', {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new SyncError('Sin conexión con el servidor', 0);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 409) throw new SyncError(json.error ?? `Error del servidor (${res.status})`, res.status);
  return { ...json, __status: res.status } as T;
}

let running = false;
let again = false;
let applyingRemote = false;
let pushTimer: ReturnType<typeof setTimeout> | undefined;

/** Pulls the server copy, merges it with this device's and pushes the result if it changed. */
export async function syncNow(): Promise<void> {
  const { token } = useSync.getState();
  if (!token) {
    useSync.setState({ status: 'off', error: null });
    return;
  }
  if (running) {
    again = true;
    return;
  }
  running = true;
  useSync.setState({ status: 'syncing' });
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const remote = await request<RemoteDoc>('GET', token);
      const remoteData = remote.data ?? EMPTY;
      const local = pick();
      const merged = mergeData(local, remoteData);

      if (stableStringify(merged) !== stableStringify(local)) {
        applyingRemote = true;
        useStore.setState(merged);
        applyingRemote = false;
      }
      if (remote.data && stableStringify(merged) === stableStringify(remoteData)) break;

      const put = await request<{ __status: number }>('PUT', token, { baseVersion: remote.version, data: merged });
      if (put.__status !== 409) break;
      // Another device wrote in between: loop to merge its changes too.
    }
    useSync.setState({ status: 'ok', error: null, lastSyncAt: Date.now() });
  } catch (e) {
    useSync.setState({ status: 'error', error: (e as Error).message });
  } finally {
    running = false;
    if (again) {
      again = false;
      void syncNow();
    }
  }
}

/** Starts syncing in the background: on load, on local edits, on focus and every minute. */
export function startSync(): () => void {
  const schedule = () => {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void syncNow(), PUSH_DELAY_MS);
  };
  const unsubStore = useStore.subscribe((s, prev) => {
    if (applyingRemote || !useSync.getState().token) return;
    if (s.ratings !== prev.ratings || s.lists !== prev.lists || s.games !== prev.games) schedule();
  });
  const unsubToken = useSync.subscribe((s, prev) => {
    if (s.token !== prev.token) void syncNow();
  });
  const onVisible = () => document.visibilityState === 'visible' && void syncNow();
  const onOnline = () => void syncNow();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  const poll = setInterval(() => document.visibilityState === 'visible' && void syncNow(), POLL_MS);
  void syncNow();
  return () => {
    unsubStore();
    unsubToken();
    clearInterval(poll);
    clearTimeout(pushTimer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
  };
}

/** Checks a code against the server without saving it. */
export async function testToken(token: string): Promise<void> {
  await request('GET', token.trim());
}
