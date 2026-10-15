import { useSync } from '../store/useSync';

// Scores our own server looks up for a game, since browsers can't call these
// services directly: the Metacritic Steam shows for the PC version (or, if
// configured, IGDB's critics) and Steam users' reviews rated like SteamDB does.

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
