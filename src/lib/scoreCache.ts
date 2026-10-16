import type { GameLength, ImdbRating, Scores, Tomatoes } from './critics';

// The scores of a title, kept in this browser so its page shows them at once
// while they're asked again; a fresh answer replaces them, a failed one doesn't.
// Its own storage key: it's a cache, not part of what syncs between devices.

export interface CachedScores {
  /** Games: critics' and players' scores, and how long it takes. */
  scores?: Scores;
  length?: GameLength | null;
  /** Series & movies. */
  imdb?: ImdbRating | null;
  tomatoes?: Tomatoes | null;
  /** When it was last refreshed. */
  at: number;
}

const KEY = 'gamestraker-scores';
/** Plenty for a whole library; the least recently refreshed go first. */
const MAX_ENTRIES = 1500;

let entries: Record<string, CachedScores> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function load(): Record<string, CachedScores> {
  if (entries) return entries;
  try {
    entries = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, CachedScores>;
  } catch {
    entries = {};
  }
  return entries;
}

function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const all = load();
    const ids = Object.keys(all);
    if (ids.length > MAX_ENTRIES) {
      ids
        .sort((a, b) => all[a].at - all[b].at)
        .slice(0, ids.length - MAX_ENTRIES)
        .forEach((id) => delete all[id]);
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      // Storage full or blocked: the cache just lives until the page closes.
    }
  }, 1000);
}

export function cachedScores(id: string): CachedScores | undefined {
  return load()[id];
}

export function saveScores(id: string, patch: Omit<Partial<CachedScores>, 'at'>) {
  const all = load();
  all[id] = { ...all[id], ...patch, at: Date.now() };
  saveSoon();
}

/** Whether an answer has anything worth keeping (an empty one usually means a source was down). */
export function hasScores(s: Scores | null | undefined): s is Scores {
  return Boolean(s && (s.critic || s.steam || s.metacritic || s.igdb));
}

/** Each site that answered replaces what was saved from it; one that didn't (down, or slow) keeps its saved scores. */
export function mergeScores(saved: Scores | null | undefined, fresh: Scores): Scores {
  if (!saved) return fresh;
  return {
    critic: fresh.critic ?? saved.critic,
    steam: fresh.steam ?? saved.steam,
    metacritic: fresh.metacritic ?? saved.metacritic,
    igdb: fresh.igdb ?? saved.igdb,
  };
}
