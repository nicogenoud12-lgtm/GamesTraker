import { DEMO_GAMES, demoSearch } from '../data/demo';
import { type DiscoverFilters, filterDemo, genreSlug, toRawgQuery } from './discover';
import { rawgDetail, rawgDiscover, rawgPopular, rawgSearch } from './rawg';
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

export async function discoverGames(
  key: string,
  filters: DiscoverFilters,
  page = 1,
  signal?: AbortSignal,
): Promise<{ games: Game[]; hasMore: boolean }> {
  if (!key) return { games: page === 1 ? filterDemo(DEMO_GAMES, filters) : [], hasMore: false };
  return rawgDiscover(key, toRawgQuery(filters), page, signal);
}

/**
 * Well-rated games from the user's favourite genres, skipping anything they
 * already rated or listed. Each genre is queried on its own and interleaved so
 * one dominant genre doesn't take over the row.
 */
export async function recommendGames(
  key: string,
  genres: string[],
  exclude: Set<string>,
  signal?: AbortSignal,
): Promise<Game[]> {
  let batches: Game[][];
  if (!key) {
    batches = genres.map((name) => DEMO_GAMES.filter((g) => g.genres.includes(name)));
  } else {
    batches = await Promise.all(
      genres.map((name) =>
        rawgDiscover(key, { genres: genreSlug(name), ordering: '-metacritic', metacritic: '80,100' }, 1, signal).then(
          (r) => r.games,
        ),
      ),
    );
  }
  const out: Game[] = [];
  const seen = new Set(exclude);
  for (let i = 0; out.length < 20 && batches.some((b) => i < b.length); i++) {
    for (const b of batches) {
      const g = b[i];
      if (g && !seen.has(g.id)) {
        seen.add(g.id);
        out.push(g);
      }
    }
  }
  return out;
}
