import type { Game, GameDetail } from './types';

const API = 'https://api.rawg.io/api';

interface RawgGame {
  id: number;
  name: string;
  background_image: string | null;
  released: string | null;
  genres?: { name: string }[];
  platforms?: { platform: { name: string } }[] | null;
  metacritic?: number | null;
  /** Users' average, 0–5. */
  rating?: number;
  ratings_count?: number;
}

interface RawgDetail extends RawgGame {
  description_raw?: string;
  developers?: { name: string }[];
  publishers?: { name: string }[];
  metacritic: number | null;
  metacritic_platforms?: { metascore: number }[];
  playtime: number | null;
  website: string | null;
}

export class RawgError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** RAWG serves resized images when the path is prefixed with /resize/<w>/-/. */
export function resizeImage(url: string | null, width: 420 | 640 | 1280): string | null {
  if (!url) return null;
  return url.replace('/media/games/', `/media/resize/${width}/-/games/`).replace(
    '/media/screenshots/',
    `/media/resize/${width}/-/screenshots/`,
  );
}

/**
 * Metacritic when RAWG has it; otherwise its users' average (0–5 → 0–100),
 * which most games have even when the Metacritic field is empty.
 */
function score(g: RawgGame): { metacritic: number | null; scoreLabel?: string } {
  if (g.metacritic) return { metacritic: g.metacritic };
  if (g.rating && (g.ratings_count ?? 0) >= 20) return { metacritic: Math.round(g.rating * 20), scoreLabel: 'RAWG' };
  return { metacritic: null };
}

function toGame(g: RawgGame): Game {
  return {
    id: `rawg:${g.id}`,
    name: g.name,
    cover: g.background_image,
    released: g.released,
    genres: (g.genres ?? []).map((x) => x.name),
    platforms: (g.platforms ?? []).map((x) => x.platform.name),
    ...score(g),
  };
}

// Discover rows are revisited often; keep responses for a while to save API calls.
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: unknown }>();

async function get<T>(key: string, path: string, params: Record<string, string> = {}, signal?: AbortSignal): Promise<T> {
  const qs = new URLSearchParams({ key, ...params });
  const url = `${API}${path}?${qs}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data as T;
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new RawgError('No se pudo conectar con RAWG. Revisá que la API key sea válida (Ajustes).', 0);
  }
  if (!res.ok) {
    throw new RawgError(res.status === 401 ? 'API key inválida' : `Error de RAWG (${res.status})`, res.status);
  }
  const data = (await res.json()) as T;
  cache.set(url, { at: Date.now(), data });
  return data;
}

export async function rawgSearch(key: string, query: string, signal?: AbortSignal): Promise<Game[]> {
  const data = await get<{ results: RawgGame[] }>(
    key,
    '/games',
    { search: query, page_size: '25', search_precise: 'true' },
    signal,
  );
  return data.results.map(toGame);
}

export async function rawgPopular(key: string, signal?: AbortSignal): Promise<Game[]> {
  const today = new Date();
  const from = new Date(today);
  from.setFullYear(today.getFullYear() - 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const data = await get<{ results: RawgGame[] }>(
    key,
    '/games',
    { dates: `${iso(from)},${iso(today)}`, ordering: '-added', page_size: '20' },
    signal,
  );
  return data.results.map(toGame);
}

export async function rawgDetail(key: string, rawgId: string): Promise<GameDetail> {
  const [g, shots] = await Promise.all([
    get<RawgDetail>(key, `/games/${rawgId}`),
    get<{ results: { image: string }[] }>(key, `/games/${rawgId}/screenshots`).catch(() => ({ results: [] })),
  ]);
  return {
    ...toGame(g),
    description: g.description_raw ?? '',
    developers: (g.developers ?? []).map((x) => x.name),
    publishers: (g.publishers ?? []).map((x) => x.name),
    // The detail sometimes only has the per-platform metascores.
    ...score({ ...g, metacritic: g.metacritic || Math.max(0, ...(g.metacritic_platforms ?? []).map((p) => p.metascore)) || null }),
    playtime: g.playtime || null,
    website: g.website || null,
    screenshots: shots.results.map((s) => s.image),
  };
}

export interface RawgQuery {
  dates?: string;
  genres?: string;
  parent_platforms?: string;
  ordering?: string;
  metacritic?: string;
}

export async function rawgDiscover(
  key: string,
  query: RawgQuery,
  page: number,
  signal?: AbortSignal,
): Promise<{ games: Game[]; hasMore: boolean }> {
  const params: Record<string, string> = { page: String(page), page_size: '20' };
  for (const [k, v] of Object.entries(query)) if (v) params[k] = v;
  const data = await get<{ results: RawgGame[]; next: string | null }>(key, '/games', params, signal);
  return { games: data.results.map(toGame), hasMore: Boolean(data.next) };
}

/** Other games of the same series (RAWG's game-series endpoint). */
export async function rawgSeries(key: string, rawgId: string, signal?: AbortSignal): Promise<Game[]> {
  const data = await get<{ results: RawgGame[] }>(key, `/games/${rawgId}/game-series`, { page_size: '40' }, signal);
  return data.results.map(toGame);
}
