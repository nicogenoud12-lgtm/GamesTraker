import { useSync } from '../store/useSync';

// Critic score from IGDB, through our own server (IGDB needs a secret and
// doesn't allow browsers). Used when RAWG has no Metacritic for a game.

export interface CriticScore {
  score: number;
  reviews: number | null;
  url: string | null;
}

const cache = new Map<string, CriticScore | null>();

export async function criticScore(name: string, released: string | null): Promise<CriticScore | null> {
  const token = useSync.getState().token;
  if (!token) return null;
  const year = released?.slice(0, 4) ?? '';
  const key = `${name}|${year}`;
  if (cache.has(key)) return cache.get(key)!;
  let value: CriticScore | null = null;
  try {
    const res = await fetch(`/api/critics?${new URLSearchParams({ name, year })}`, { headers: { Authorization: `Bearer ${token}` } });
    // 503: the server has no IGDB credentials. Anything else that fails just leaves the score out.
    if (!res.ok) return null;
    const json = (await res.json()) as { score: number | null; reviews?: number | null; url?: string | null };
    if (json.score != null) value = { score: json.score, reviews: json.reviews ?? null, url: json.url ?? null };
  } catch {
    return null;
  }
  cache.set(key, value);
  return value;
}
