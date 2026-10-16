import { create } from 'zustand';
import { api } from './sync';
import type { Game, TierId } from './types';
import { useSync } from '../store/useSync';
import { refreshTrakt } from './trakt';

// Friends: each account has an invite link; friends see each other's ratings
// (unless hidden) and, if the author turned it on, get notified of new ones.

export interface FriendSummary {
  username: string;
  /** That friend shares their ratings with me. */
  shares: boolean;
  /** I share mine with them (off until I turn it on). */
  iShare: boolean;
  games?: { count: number; average: number | null };
  screen?: { count: number; average: number | null };
}

export interface FriendsOverview {
  code: string;
  announce: boolean;
  friends: FriendSummary[];
}

export interface FriendRating {
  username: string;
  score: number;
  tier: TierId;
}

export interface FeedItem {
  username: string;
  game: Game;
  score: number;
  tier: TierId;
  at: number;
}

export interface Notice extends FeedItem {
  id: string;
}

export const getFriends = () => api<FriendsOverview>('GET', '/friends');
export const addFriend = (code: string) => api<{ username: string }>('POST', '/friends/add', { code });
export const removeFriend = (username: string) => api<{ ok: true }>('POST', '/friends/remove', { username });
export const newInviteCode = () => api<{ code: string }>('POST', '/friends/code');
export const saveSocialSettings = (s: { announce?: boolean }) => api<{ announce: boolean }>('POST', '/friends/settings', s);
/** Lets one friend see my ratings, or stops it. */
export const shareWith = (username: string, share: boolean) =>
  api<{ username: string; iShare: boolean }>('POST', '/friends/share', { username, share });
export const friendRatings = (id: string) =>
  api<{ ratings: FriendRating[] }>('GET', `/friends/ratings?${new URLSearchParams({ id })}`).then((r) => r.ratings);
export const friendFeed = () => api<{ items: FeedItem[] }>('GET', '/friends/feed').then((r) => r.items);
export const inviteInfo = (code: string) => api<{ username: string }>('GET', `/invite/${encodeURIComponent(code)}`, undefined, '');

/** Link that adds you as a friend (or lets someone without an account sign up). */
export const inviteUrl = (code: string) => `${window.location.origin}${window.location.pathname}#/amigos?agregar=${encodeURIComponent(code)}`;

// ---------- notifications ----------

interface NoticeState {
  unread: number;
  items: Notice[];
}

export const useNotices = create<NoticeState>()(() => ({ unread: 0, items: [] }));

export async function refreshNotices(): Promise<void> {
  if (!useSync.getState().token) return useNotices.setState({ unread: 0, items: [] });
  try {
    const r = await api<{ items: Notice[]; unread: number }>('GET', '/notifications');
    useNotices.setState({ unread: r.unread, items: r.items });
  } catch {
    // Offline or no server: keep what we had.
  }
}

export async function markNoticesSeen(): Promise<void> {
  if (!useNotices.getState().unread) return;
  useNotices.setState({ unread: 0 });
  await api('POST', '/notifications/seen').catch(() => {});
}

/** Keeps the unread count fresh: now, when the app comes back to the front and every few minutes. */
export function startNotices(): () => void {
  const refresh = () => {
    void refreshNotices();
    void refreshTrakt();
  };
  refresh();
  const onVisible = () => document.visibilityState === 'visible' && refresh();
  document.addEventListener('visibilitychange', onVisible);
  const timer = setInterval(() => document.visibilityState === 'visible' && refresh(), 3 * 60_000);
  const unsub = useSync.subscribe((s, prev) => s.token !== prev.token && refresh());
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(timer);
    unsub();
  };
}

// ---------- push on this device ----------

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('La app todavía no terminó de instalarse; probá de nuevo en un rato')), 8000)),
  ]);
  return reg;
}

export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return Boolean(await reg?.pushManager.getSubscription());
}

export async function enablePush(): Promise<void> {
  if (!pushSupported()) {
    throw new Error(
      /iPhone|iPad/.test(navigator.userAgent)
        ? 'En iPhone primero agregá la app a la pantalla de inicio (Compartir → Agregar a inicio) y abrila desde ahí'
        : 'Este navegador no permite notificaciones',
    );
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('No diste permiso para las notificaciones');
  const { key } = await api<{ key: string }>('GET', '/push/key');
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(key) }));
  await api('POST', '/push/subscribe', { subscription: sub.toJSON(), origin: window.location.origin });
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api('POST', '/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

function base64UrlToBytes(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** "hace 5 min", "hace 2 días"… */
export function timeAgo(ms: number): string {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'recién';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d < 30) return d === 1 ? 'ayer' : `hace ${d} días`;
  return new Date(ms).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
