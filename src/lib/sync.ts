import { mergeData, stableStringify, type SyncData } from './merge';
import type { Game, GameList, Rating } from './types';
import { useStore } from '../store/useStore';
import { useSync } from '../store/useSync';

interface RemoteDoc {
  version: number;
  updatedAt: string | null;
  data: SyncData | null;
}

const EMPTY: SyncData = { games: {}, ratings: {}, lists: [], ratingTombs: {}, listTombs: {}, starts: {} };
const PUSH_DELAY_MS = 1500;
const POLL_MS = 60_000;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function pick(): SyncData {
  const { games, ratings, lists, ratingTombs, listTombs, logs, logTombs, starts, startsAt, goals, apiKey, apiKeyUpdatedAt, tmdbKey, tmdbKeyUpdatedAt } =
    useStore.getState();
  return {
    games,
    ratings,
    lists,
    ratingTombs,
    listTombs,
    logs,
    logTombs,
    starts,
    startsAt,
    goals,
    settings: { apiKey, updatedAt: apiKeyUpdatedAt, tmdbKey, tmdbUpdatedAt: tmdbKeyUpdatedAt },
  };
}

/** Writes merged data back into the store (settings live in separate store fields). */
function apply(data: SyncData) {
  const { settings, ...rest } = data;
  useStore.setState({
    ...rest,
    starts: rest.starts ?? {},
    startsAt: rest.startsAt ?? {},
    goals: rest.goals ?? {},
    logs: rest.logs ?? {},
    logTombs: rest.logTombs ?? {},
    ...(settings
      ? {
          apiKey: settings.apiKey,
          apiKeyUpdatedAt: settings.updatedAt,
          tmdbKey: settings.tmdbKey ?? '',
          tmdbKeyUpdatedAt: settings.tmdbUpdatedAt ?? 0,
        }
      : {}),
  });
}

async function api<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown, token = useSync.getState().token): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Sin conexión con el servidor', 0);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 409) throw new ApiError(json.error ?? `Error del servidor (${res.status})`, res.status);
  return { ...json, __status: res.status } as T;
}

/** Asks the server whether accounts exist; null when there is no sync server. */
export async function checkServer(): Promise<void> {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    const json = res.ok ? await res.json() : null;
    useSync.setState({
      server: json?.ok ? { hasUsers: Boolean(json.hasUsers), signupOpen: Boolean(json.signupOpen) } : null,
    });
  } catch {
    useSync.setState({ server: null });
  }
}

interface AuthResult {
  token: string;
  user: { username: string };
}

export async function login(username: string, password: string): Promise<void> {
  const r = await api<AuthResult>('POST', '/auth/login', { username, password }, '');
  useSync.getState().setSession(r.token, r.user.username);
}

export async function register(username: string, password: string): Promise<void> {
  const r = await api<AuthResult>('POST', '/auth/register', { username, password }, '');
  useSync.getState().setSession(r.token, r.user.username);
  void checkServer();
}

export async function changePassword(current: string, next: string): Promise<void> {
  const r = await api<{ token: string }>('POST', '/auth/password', { current, next });
  useSync.setState({ token: r.token });
}

export interface Profile {
  username: string;
  public: boolean;
}

export async function getProfile(): Promise<Profile> {
  return (await api<{ user: Profile }>('GET', '/auth/me')).user;
}

/** Turns the read-only public profile (#/p/usuario) on or off. */
export async function setProfilePublic(value: boolean): Promise<Profile> {
  return (await api<{ user: Profile }>('POST', '/profile', { public: value })).user;
}

/** What the server shares of a public profile: no notes, platforms or keys. */
export interface PublicProfile {
  username: string;
  updatedAt: string | null;
  games: Record<string, Game>;
  ratings: Record<string, Pick<Rating, 'gameId' | 'score' | 'tier' | 'status' | 'finishedAt'>>;
  lists: (Pick<GameList, 'id' | 'name' | 'emoji' | 'mode' | 'system' | 'gameIds'>)[];
}

export function fetchPublicProfile(username: string): Promise<PublicProfile> {
  return api<PublicProfile>('GET', `/public/${encodeURIComponent(username)}`, undefined, '');
}

/** The shareable link to someone's public profile in this app. */
export const profileUrl = (username: string) => `${window.location.origin}${window.location.pathname}#/p/${encodeURIComponent(username)}`;

let running = false;
let again = false;
let applyingRemote = false;
let pushTimer: ReturnType<typeof setTimeout> | undefined;

/** Pulls the server copy, merges it with this device's and pushes the result if it changed. */
export async function syncNow(): Promise<void> {
  if (!useSync.getState().token) {
    useSync.setState({ status: 'off' });
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
      const remote = await api<RemoteDoc>('GET', '/state');
      const remoteData = remote.data ?? EMPTY;
      const local = pick();
      const merged = mergeData(local, remoteData);

      if (stableStringify(merged) !== stableStringify(local)) {
        applyingRemote = true;
        apply(merged);
        applyingRemote = false;
      }
      if (remote.data && stableStringify(merged) === stableStringify(remoteData)) break;

      const put = await api<{ __status: number }>('PUT', '/state', { baseVersion: remote.version, data: merged });
      if (put.__status !== 409) break;
      // Another device wrote in between: loop to merge its changes too.
    }
    useSync.setState({ status: 'ok', error: null, lastSyncAt: Date.now() });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) useSync.getState().logout(e.message);
    else useSync.setState({ status: 'error', error: (e as Error).message });
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
    if (
      s.ratings !== prev.ratings ||
      s.lists !== prev.lists ||
      s.games !== prev.games ||
      s.starts !== prev.starts ||
      s.startsAt !== prev.startsAt ||
      s.goals !== prev.goals ||
      s.logs !== prev.logs ||
      s.logTombs !== prev.logTombs ||
      s.apiKey !== prev.apiKey ||
      s.tmdbKey !== prev.tmdbKey
    ) {
      schedule();
    }
  });
  const unsubToken = useSync.subscribe((s, prev) => {
    if (s.token && s.token !== prev.token && s.username !== prev.username) void syncNow();
  });
  const onVisible = () => document.visibilityState === 'visible' && void syncNow();
  const onOnline = () => void syncNow();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  const poll = setInterval(() => document.visibilityState === 'visible' && void syncNow(), POLL_MS);
  void checkServer();
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
