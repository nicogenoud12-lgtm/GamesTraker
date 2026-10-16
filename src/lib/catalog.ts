import { DEMO_GAMES, demoSearch } from '../data/demo';
import { DEMO_SCREEN, demoScreenSearch } from '../data/demoScreen';
import { type DiscoverFilters, filterDemo, filterDemoScreen, genreSlug, toRawgQuery, toTmdbQuery } from './discover';
import { kindOf, type Mode } from './mode';
import { rawgDetail, rawgDiscover, rawgPopular, rawgSearch, rawgSeries } from './rawg';
import { tmdbCollection, tmdbDetail, tmdbList, tmdbRecommendations, tmdbSearch, tmdbTrending } from './tmdb';
import type { Game, GameDetail } from './types';
import { useStore } from '../store/useStore';

// Single entry point for catalog data. Games come from RAWG, series & movies
// from TMDB; without a key each mode falls back to its bundled demo catalog.

export interface Keys {
  rawg: string;
  tmdb: string;
}

const ENV = {
  rawg: (import.meta.env.VITE_RAWG_KEY as string | undefined) ?? '',
  tmdb: (import.meta.env.VITE_TMDB_KEY as string | undefined) ?? '',
};

export function hasEnvKey(which: keyof Keys): boolean {
  return ENV[which].length > 0;
}

/** The keys in use right now, outside of React. */
export function currentKeys(): Keys {
  const { apiKey, tmdbKey } = useStore.getState();
  return { rawg: apiKey.trim() || ENV.rawg, tmdb: tmdbKey.trim() || ENV.tmdb };
}

/** Keys typed in Ajustes (or synced from the account) win over the server's build-time ones. */
export function useKeys(): Keys {
  const rawg = useStore((s) => s.apiKey);
  const tmdb = useStore((s) => s.tmdbKey);
  return { rawg: rawg.trim() || ENV.rawg, tmdb: tmdb.trim() || ENV.tmdb };
}

export const keyFor = (mode: Mode, keys: Keys) => (mode === 'games' ? keys.rawg : keys.tmdb);

const demoScreenId = (id: string) => id.startsWith('dscr:');

export async function searchItems(mode: Mode, keys: Keys, query: string, signal?: AbortSignal): Promise<Game[]> {
  if (mode === 'games') return keys.rawg ? rawgSearch(keys.rawg, query, signal) : demoSearch(query);
  return keys.tmdb ? tmdbSearch(keys.tmdb, query, signal) : demoScreenSearch(query);
}

export async function popularItems(mode: Mode, keys: Keys, signal?: AbortSignal): Promise<Game[]> {
  const byDate = (a: Game, b: Game) => (b.released ?? '').localeCompare(a.released ?? '');
  if (mode === 'games') return keys.rawg ? rawgPopular(keys.rawg, signal) : DEMO_GAMES.slice().sort(byDate).slice(0, 12);
  return keys.tmdb ? tmdbTrending(keys.tmdb, signal) : DEMO_SCREEN.slice().sort(byDate).slice(0, 12);
}

const detailCache = new Map<string, GameDetail>();

export async function itemDetail(keys: Keys, id: string): Promise<GameDetail | null> {
  const cached = detailCache.get(id);
  if (cached) return cached;
  const parts = id.split(':');
  let detail: GameDetail | null = null;
  if (parts[0] === 'demo') detail = DEMO_GAMES.find((g) => g.id === id) ?? null;
  else if (parts[0] === 'dscr') detail = DEMO_SCREEN.find((g) => g.id === id) ?? null;
  else if (parts[0] === 'rawg' && keys.rawg) detail = await rawgDetail(keys.rawg, parts[1]);
  else if (parts[0] === 'tmdb' && keys.tmdb) detail = await tmdbDetail(keys.tmdb, kindOf(id)!, parts[2]);
  if (detail) detailCache.set(id, detail);
  return detail;
}

const oldestFirst = (games: Game[], id: string) =>
  games.filter((g) => g.id !== id).sort((a, b) => (a.released ?? '9999').localeCompare(b.released ?? '9999'));

/**
 * Other entries of the same saga, oldest first: RAWG's game series, a TMDB
 * movie collection, or a name/saga match in the demo catalogs.
 */
export async function sagaItems(keys: Keys, id: string, detail: GameDetail | null, signal?: AbortSignal): Promise<Game[]> {
  const parts = id.split(':');
  if (parts[0] === 'rawg' && keys.rawg) return oldestFirst(await rawgSeries(keys.rawg, parts[1], signal), id);
  if (parts[0] === 'tmdb' && keys.tmdb && detail?.collectionId) {
    return oldestFirst(await tmdbCollection(keys.tmdb, detail.collectionId, signal), id);
  }
  if (parts[0] === 'demo') {
    const self = DEMO_GAMES.find((g) => g.id === id);
    const stem = (name: string) => name.split(/[:\-–]/)[0].replace(/\s+(II|2|Part.*)$/i, '').trim().toLowerCase();
    return self ? oldestFirst(DEMO_GAMES.filter((g) => stem(g.name) === stem(self.name)), id) : [];
  }
  if (demoScreenId(id)) {
    const saga = DEMO_SCREEN.find((g) => g.id === id)?.saga;
    return saga ? oldestFirst(DEMO_SCREEN.filter((g) => g.saga === saga), id) : [];
  }
  return [];
}

/** "Te puede gustar" for series & movies (TMDB recommendations; demo: same genre). */
export async function similarItems(keys: Keys, id: string, signal?: AbortSignal): Promise<Game[]> {
  const parts = id.split(':');
  if (parts[0] === 'tmdb' && keys.tmdb) {
    return (await tmdbRecommendations(keys.tmdb, kindOf(id)!, parts[2], signal)).filter((g) => g.id !== id).slice(0, 20);
  }
  if (demoScreenId(id)) {
    const self = DEMO_SCREEN.find((g) => g.id === id);
    return self ? DEMO_SCREEN.filter((g) => g.id !== id && g.genres.some((x) => self.genres.includes(x))).slice(0, 12) : [];
  }
  return [];
}

export async function discoverItems(
  mode: Mode,
  keys: Keys,
  filters: DiscoverFilters,
  page = 1,
  signal?: AbortSignal,
): Promise<{ games: Game[]; hasMore: boolean }> {
  if (mode === 'games') {
    if (!keys.rawg) return { games: page === 1 ? filterDemo(DEMO_GAMES, filters) : [], hasMore: false };
    return rawgDiscover(keys.rawg, toRawgQuery(filters), page, signal);
  }
  if (!keys.tmdb) return { games: page === 1 ? filterDemoScreen(DEMO_SCREEN, filters) : [], hasMore: false };
  const { path, params } = toTmdbQuery(filters);
  return tmdbList(keys.tmdb, filters.kind, path, params, page, signal);
}

/** Trending this week (series & movies mode). */
export async function trendingItems(keys: Keys, signal?: AbortSignal): Promise<Game[]> {
  return keys.tmdb ? tmdbTrending(keys.tmdb, signal) : DEMO_SCREEN.slice(0, 12);
}

/** Interleaves several result lists, skipping repeats and anything in `exclude`. */
function interleave(batches: Game[][], exclude: Set<string>, max = 20): Game[] {
  const out: Game[] = [];
  const seen = new Set(exclude);
  for (let i = 0; out.length < max && batches.some((b) => i < b.length); i++) {
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

/**
 * "Para vos". Games: well-rated titles of the favourite genres. Series &
 * movies: TMDB's own recommendations for the best-rated titles.
 */
export async function recommendItems(
  mode: Mode,
  keys: Keys,
  taste: { genres: string[]; favourites: string[] },
  exclude: Set<string>,
  signal?: AbortSignal,
): Promise<Game[]> {
  if (mode === 'games') {
    const batches = keys.rawg
      ? await Promise.all(
          taste.genres.map((name) =>
            rawgDiscover(keys.rawg, { genres: genreSlug(name), ordering: '-metacritic', metacritic: '80,100' }, 1, signal).then((r) => r.games),
          ),
        )
      : taste.genres.map((name) => DEMO_GAMES.filter((g) => g.genres.includes(name)));
    return interleave(batches, exclude);
  }
  const tmdbIds = taste.favourites.filter((id) => id.startsWith('tmdb:'));
  if (keys.tmdb && tmdbIds.length) {
    return interleave(await Promise.all(tmdbIds.map((id) => similarItems(keys, id, signal))), exclude);
  }
  return interleave(
    taste.genres.map((name) => DEMO_SCREEN.filter((g) => g.genres.includes(name))),
    exclude,
  );
}
