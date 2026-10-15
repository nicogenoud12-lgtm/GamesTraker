import { useSync } from '../store/useSync';

// Scores our own server looks up, since browsers can't get them directly: for
// games, the Metacritic Steam shows for the PC version (or, if configured,
// IGDB's critics) and Steam users' reviews rated like SteamDB does; for movies
// and series, the IMDb rating from IMDb's daily public file.

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
