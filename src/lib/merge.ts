import type { Game, GameList, Rating } from './types';

/** The part of the app state that is shared between devices. */
export interface SyncData {
  games: Record<string, Game>;
  ratings: Record<string, Rating>;
  lists: GameList[];
  ratingTombs: Record<string, number>;
  listTombs: Record<string, number>;
  /** Start dates per game; missing in documents saved by older versions. */
  starts?: Record<string, string>;
  /** When each start date was set, so an edited date wins over an older one. */
  startsAt?: Record<string, number>;
  /** Yearly goals per mode ("games-2026" → 30 titles); the most recently set wins. */
  goals?: Record<string, { target: number; updatedAt: number }>;
  /** API keys shared across devices; for each one, the most recently changed wins. */
  settings?: { apiKey: string; updatedAt: number; tmdbKey?: string; tmdbUpdatedAt?: number };
}

function newestTombs(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a };
  for (const [id, t] of Object.entries(b)) out[id] = Math.max(out[id] ?? 0, t);
  return out;
}

function newest<T extends { updatedAt: number }>(x: T | undefined, y: T | undefined): T | undefined {
  if (!x) return y;
  if (!y) return x;
  return y.updatedAt > x.updatedAt ? y : x;
}

/**
 * Combines two copies record by record: the most recently edited rating or
 * list wins, and a deletion wins over anything edited before it.
 */
export function mergeData(a: SyncData, b: SyncData): SyncData {
  const ratingTombs = newestTombs(a.ratingTombs ?? {}, b.ratingTombs ?? {});
  const listTombs = newestTombs(a.listTombs ?? {}, b.listTombs ?? {});

  const ratings: Record<string, Rating> = {};
  for (const id of new Set([...Object.keys(a.ratings), ...Object.keys(b.ratings)])) {
    const r = newest(a.ratings[id], b.ratings[id])!;
    if ((ratingTombs[id] ?? -1) < r.updatedAt) ratings[id] = r;
  }

  const byId = new Map<string, GameList>();
  for (const l of [...a.lists, ...b.lists]) byId.set(l.id, newest(byId.get(l.id), l)!);
  const lists = [...byId.values()]
    .filter((l) => l.system || (listTombs[l.id] ?? -1) < l.updatedAt)
    .sort((x, y) => x.createdAt - y.createdAt);

  const sa = a.settings ?? { apiKey: '', updatedAt: 0 };
  const sb = b.settings ?? { apiKey: '', updatedAt: 0 };
  const rawg = sb.updatedAt > sa.updatedAt ? sb : sa;
  const tmdb = (sb.tmdbUpdatedAt ?? 0) > (sa.tmdbUpdatedAt ?? 0) ? sb : sa;
  const settings = {
    apiKey: rawg.apiKey,
    updatedAt: rawg.updatedAt,
    tmdbKey: tmdb.tmdbKey ?? '',
    tmdbUpdatedAt: tmdb.tmdbUpdatedAt ?? 0,
  };

  return {
    games: { ...b.games, ...a.games },
    ratings,
    lists,
    ratingTombs,
    listTombs,
    ...mergeStarts(a, b),
    goals: mergeGoals(a.goals ?? {}, b.goals ?? {}),
    settings,
  };
}

function mergeGoals(a: NonNullable<SyncData['goals']>, b: NonNullable<SyncData['goals']>): NonNullable<SyncData['goals']> {
  const out = { ...a };
  for (const [key, goal] of Object.entries(b)) out[key] = newest(out[key], goal)!;
  return out;
}

/** Per game, the most recently set start date wins (dates from before edits existed count as oldest). */
function mergeStarts(a: SyncData, b: SyncData): Pick<SyncData, 'starts' | 'startsAt'> {
  const starts: Record<string, string> = {};
  const startsAt: Record<string, number> = {};
  for (const id of new Set([...Object.keys(a.starts ?? {}), ...Object.keys(b.starts ?? {})])) {
    const ta = a.starts?.[id] ? (a.startsAt?.[id] ?? 0) : -1;
    const tb = b.starts?.[id] ? (b.startsAt?.[id] ?? 0) : -1;
    const from = tb > ta ? b : a;
    starts[id] = from.starts![id];
    if (from.startsAt?.[id]) startsAt[id] = from.startsAt[id];
  }
  return { starts, startsAt };
}

/** JSON with sorted keys, so equal data always serialises the same way. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
