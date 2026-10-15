import { DEMO_GAMES, demoSearch } from '../data/demo';
import { rawgDetail, rawgPopular, rawgSearch } from './rawg';
import type { Game, GameDetail } from './types';

// Single entry point for game data: RAWG when a key is configured, otherwise
// the bundled demo catalog.

const ENV_KEY = (import.meta.env.VITE_RAWG_KEY as string | undefined) ?? '';

export function effectiveKey(userKey: string): string {
  return userKey.trim() || ENV_KEY;
}

export function hasEnvKey(): boolean {
  return ENV_KEY.length > 0;
}

export async function searchGames(key: string, query: string, signal?: AbortSignal): Promise<Game[]> {
  if (!key) return demoSearch(query);
  return rawgSearch(key, query, signal);
}

export async function popularGames(key: string, signal?: AbortSignal): Promise<Game[]> {
  if (!key) return DEMO_GAMES.slice().sort((a, b) => (b.released ?? '').localeCompare(a.released ?? '')).slice(0, 12);
  return rawgPopular(key, signal);
}

const detailCache = new Map<string, GameDetail>();

export async function gameDetail(key: string, id: string): Promise<GameDetail | null> {
  const cached = detailCache.get(id);
  if (cached) return cached;
  const [source, ref] = id.split(':');
  let detail: GameDetail | null = null;
  if (source === 'demo') detail = DEMO_GAMES.find((g) => g.id === id) ?? null;
  else if (source === 'rawg' && key) detail = await rawgDetail(key, ref);
  if (detail) detailCache.set(id, detail);
  return detail;
}
