import { useSync } from '../store/useSync';

// Scores our own server looks up, since browsers can't get them directly: for
// games, the Metacritic Steam shows for the PC version (or, if configured,
// IGDB's critics), Steam users' reviews rated like SteamDB does and how long
// the game takes (HowLongToBeat); for movies and series, the IMDb rating from
// IMDb's daily public file and Rotten Tomatoes' critics and audience.

export interface CriticScore {
  score: number;
  source: 'metacritic' | 'igdb';
  reviews: number | null;
  url: string | null;
}

export interface SteamRating {
  /** SteamDB-style rating, 0–100. */
  rating: number;
  /** Plain share of positive reviews, 0–100. */
  positive: number;
  total: number;
  label: string | null;
  url: string;
}

export interface Scores {
  critic: CriticScore | null;
  steam: SteamRating | null;
}

const NONE: Scores = { critic: null, steam: null };
const cache = new Map<string, Scores>();

export async function gameScores(name: string, released: string | null, steamAppId?: string | null): Promise<Scores> {
  const token = useSync.getState().token;
  if (!token) return NONE;
  const year = released?.slice(0, 4) ?? '';
  const steam = steamAppId ?? '';
  const key = `${name}|${year}|${steam}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const res = await fetch(`/api/critics?${new URLSearchParams({ name, year, steam })}`, { headers: { Authorization: `Bearer ${token}` } });
    // If the server is older or a source is down, the scores are just left out.
    if (!res.ok) return NONE;
    const json = (await res.json()) as Partial<CriticScore> & { score: number | null; steam?: SteamRating | null };
    const value: Scores = {
      critic:
        json.score != null
          ? { score: json.score, source: json.source ?? 'igdb', reviews: json.reviews ?? null, url: json.url ?? null }
          : null,
      steam: json.steam ?? null,
    };
    cache.set(key, value);
    return value;
  } catch {
    return NONE;
  }
}

export interface ImdbRating {
  rating: number;
  votes: number;
  url: string;
}

const imdbCache = new Map<string, ImdbRating | null>();

export async function imdbRating(id: string): Promise<ImdbRating | null> {
  if (imdbCache.has(id)) return imdbCache.get(id)!;
  try {
    const res = await fetch(`/api/imdb?${new URLSearchParams({ id })}`);
    // 503 while the server is still downloading IMDb's file: try again next time.
    if (!res.ok) return null;
    const { rating } = (await res.json()) as { rating: { rating: number; votes: number } | null };
    const value = rating ? { ...rating, url: `https://www.imdb.com/title/${id}/` } : null;
    imdbCache.set(id, value);
    return value;
  } catch {
    return null;
  }
}

async function askServer<T>(path: string, params: Record<string, string>): Promise<T | undefined> {
  const token = useSync.getState().token;
  if (!token) return undefined;
  try {
    const res = await fetch(`${path}?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${token}` } });
    // An older server or a source that's down: the data is just left out.
    return res.ok ? ((await res.json()) as T) : undefined;
  } catch {
    return undefined;
  }
}

/** How long a game takes: HowLongToBeat (all play styles together), or IGDB's estimate. */
export interface GameLength {
  hours: number;
  /** Main story, story + extras, and 100%. */
  main: number | null;
  plus: number | null;
  full: number | null;
  source: 'hltb' | 'igdb';
  url: string | null;
}

const lengthCache = new Map<string, GameLength | null>();

/** `undefined` when it couldn't be asked (signed out, offline), `null` when nobody knows. */
export async function gameLength(name: string, released: string | null): Promise<GameLength | null | undefined> {
  const year = released?.slice(0, 4) ?? '';
  const key = `${name}|${year}`;
  if (lengthCache.has(key)) return lengthCache.get(key);
  const json = await askServer<{ length: GameLength | null }>('/api/length', { name, year });
  if (!json) return undefined;
  lengthCache.set(key, json.length);
  return json.length;
}

/** Rotten Tomatoes: critics (Tomatometer) and audience (Popcornmeter), 0–100. */
export interface Tomatoes {
  critics: number | null;
  criticReviews: number | null;
  audience: number | null;
  url: string;
}

const tomatoCache = new Map<string, Tomatoes | null>();

export async function tomatoScores(imdbId: string): Promise<Tomatoes | null> {
  if (tomatoCache.has(imdbId)) return tomatoCache.get(imdbId)!;
  const json = await askServer<{ scores: Tomatoes | null }>('/api/rt', { imdb: imdbId });
  if (!json) return null;
  tomatoCache.set(imdbId, json.scores);
  return json.scores;
}
