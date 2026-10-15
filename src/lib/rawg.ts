import type { Game, GameDetail } from './types';

const API = 'https://api.rawg.io/api';

interface RawgGame {
  id: number;
  name: string;
  background_image: string | null;
  released: string | null;
  genres?: { name: string }[];
  platforms?: { platform: { name: string } }[] | null;
}

interface RawgDetail extends RawgGame {
  description_raw?: string;
  developers?: { name: string }[];
  publishers?: { name: string }[];
  metacritic: number | null;
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

function toGame(g: RawgGame): Game {
  return {
    id: `rawg:${g.id}`,
    name: g.name,
    cover: g.background_image,
    released: g.released,
    genres: (g.genres ?? []).map((x) => x.name),
    platforms: (g.platforms ?? []).map((x) => x.platform.name),
  };
}

async function get<T>(key: string, path: string, params: Record<string, string> = {}, signal?: AbortSignal): Promise<T> {
  const qs = new URLSearchParams({ key, ...params });
  let res: Response;
  try {
    res = await fetch(`${API}${path}?${qs}`, { signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new RawgError('No se pudo conectar con RAWG', 0);
  }
  if (!res.ok) {
    throw new RawgError(res.status === 401 ? 'API key inválida' : `Error de RAWG (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
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
    metacritic: g.metacritic,
    playtime: g.playtime || null,
    website: g.website || null,
    screenshots: shots.results.map((s) => s.image),
  };
}
