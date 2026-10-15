import { localDay } from './format';
import { MODES, modeOf, statusLabel, type Mode } from './mode';
import type { Game, GameList, LogEntry, Rating } from './types';

export type DiaryKind = 'rated' | 'again' | 'started';

export interface DiaryEntry {
  key: string;
  kind: DiaryKind;
  game: Game;
  /** YYYY-MM-DD */
  date: string;
  label: string;
  rating?: Rating;
  log?: LogEntry;
}

interface Source {
  games: Record<string, Game>;
  ratings: Record<string, Rating>;
  logs: Record<string, LogEntry>;
  starts: Record<string, string>;
  lists: GameList[];
}

/** "Lo volví a jugar" / "La volví a ver", for buttons. */
export const againLabel = (mode: Mode) => (mode === 'games' ? 'Lo volví a jugar' : 'La volví a ver');
const againDone = (mode: Mode) => (mode === 'games' ? 'Lo volviste a jugar' : 'La volviste a ver');
const startedLabel = (mode: Mode) => (mode === 'games' ? 'Lo empezaste' : 'La empezaste');

/** The day a rating counts for: when it was finished, or when it was rated. */
export const ratedDay = (r: Rating) => r.finishedAt ?? localDay(new Date(r.createdAt));

// Same-day order, newest first: what was finished, then replays, then starts.
const ORDER: Record<DiaryKind, number> = { rated: 0, again: 1, started: 2 };

/** Everything that happened with this mode's titles, newest first. */
export function diaryEntries(s: Source, mode: Mode): DiaryEntry[] {
  const out: DiaryEntry[] = [];
  for (const r of Object.values(s.ratings)) {
    const game = s.games[r.gameId];
    if (!game || modeOf(r.gameId) !== mode) continue;
    out.push({ key: `r:${r.gameId}`, kind: 'rated', game, date: ratedDay(r), label: statusLabel(r.gameId, r.status), rating: r });
  }
  for (const log of Object.values(s.logs)) {
    const game = s.games[log.gameId];
    if (!game || modeOf(log.gameId) !== mode) continue;
    out.push({ key: `l:${log.id}`, kind: 'again', game, date: log.date, label: againDone(mode), rating: s.ratings[log.gameId], log });
  }
  // Starts are kept for everything that was ever "now"; only show the ones still meaningful.
  const nowIds = new Set([MODES.games.nowListId, MODES.screen.nowListId]);
  const now = new Set(s.lists.flatMap((l) => (nowIds.has(l.id) ? l.gameIds : [])));
  for (const [id, date] of Object.entries(s.starts)) {
    const game = s.games[id];
    if (!game || modeOf(id) !== mode || (!s.ratings[id] && !now.has(id))) continue;
    out.push({ key: `s:${id}`, kind: 'started', game, date, label: startedLabel(mode) });
  }
  return out.sort((a, b) => (a.date === b.date ? ORDER[a.kind] - ORDER[b.kind] : a.date < b.date ? 1 : -1));
}

/** Groups entries by month ("2026-10"), keeping their order. */
export function byMonth(entries: DiaryEntry[]): [string, DiaryEntry[]][] {
  const groups = new Map<string, DiaryEntry[]>();
  for (const e of entries) {
    const key = e.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups];
}
