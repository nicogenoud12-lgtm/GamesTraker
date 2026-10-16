import { useSync } from '../store/useSync';
import type { Game } from './types';

// The ~10,000 most popular games, downloaded once from our server (the browser
// keeps the file and only checks every few hours whether it changed), so search
// finds them while typing instead of waiting a couple of seconds for RAWG.

type Entry = [id: number, name: string, released: string | null, image: string | null, genres: string[], platforms: string[], score: number | null, rawgScore: 0 | 1];

interface Indexed {
  game: Game;
  /** Lowercase, no accents or punctuation: "the legend of zelda breath of the wild". */
  words: string;
  /** The same without spaces, for "godofwar" or "fifa23". */
  joined: string;
  rank: number;
}

let index: Indexed[] | null = null;
let loading: Promise<Indexed[] | null> | null = null;

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Downloads the index once per visit; null when there's none (signed out, older server). */
export function loadGameIndex(): Promise<Indexed[] | null> {
  if (index) return Promise.resolve(index);
  const token = useSync.getState().token;
  if (!token) return Promise.resolve(null);
  loading ??= fetch('/api/games/index', { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => (res.ok ? (res.json() as Promise<{ media: string; games: Entry[] }>) : null))
    .then((data) => {
      if (!data) return null;
      index = data.games.map(([id, name, released, image, genres, platforms, score, rawgScore], rank) => {
        const words = normalize(name);
        return {
          game: {
            id: `rawg:${id}`,
            name,
            cover: image ? (image.startsWith('http') ? image : data.media + image) : null,
            released,
            genres,
            platforms,
            // The index keeps one score: Metacritic, or RAWG's players when there's none.
            ...(rawgScore ? { metacritic: null, userScore: score, userLabel: 'RAWG' } : { metacritic: score }),
          },
          words,
          joined: words.replace(/ /g, ''),
          rank,
        };
      });
      return index;
    })
    .catch(() => null)
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Popular games whose name matches what's typed, best first; [] while the index isn't there yet. */
export function searchGameIndex(query: string, limit = 20): Game[] {
  if (!index) return [];
  const q = normalize(query);
  if (q.length < 2) return [];
  const tokens = q.split(' ');
  const joined = q.replace(/ /g, '');
  const found: { game: Game; tier: number; rank: number }[] = [];
  for (const g of index) {
    let tier: number;
    if (g.joined === joined) tier = 0;
    // The name starts like that, or every typed word starts one of its words
    // ("zelda brea" → "The Legend of Zelda: Breath of the Wild"): the most popular first.
    else if (g.joined.startsWith(joined) || tokens.every((t) => g.words.startsWith(t) || g.words.includes(` ${t}`))) tier = 1;
    else if (g.joined.includes(joined)) tier = 2;
    else continue;
    found.push({ game: g.game, tier, rank: g.rank });
  }
  return found
    .sort((a, b) => a.tier - b.tier || a.rank - b.rank)
    .slice(0, limit)
    .map((f) => f.game);
}
