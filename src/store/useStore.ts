import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { localDay, uid } from '../lib/format';
import { bestCover } from '../lib/covers';
import type { Game, GameList, LogEntry, Rating } from '../lib/types';

import {
  MODES,
  NEXT_LIST_ID,
  PLAYING_LIST_ID,
  TOWATCH_LIST_ID,
  WATCHING_LIST_ID,
  modeOf,
  type Mode,
} from '../lib/mode';

export { NEXT_LIST_ID, PLAYING_LIST_ID, TOWATCH_LIST_ID, WATCHING_LIST_ID };

const SYSTEM_LISTS: GameList[] = [
  { id: PLAYING_LIST_ID, name: 'Jugando ahora', emoji: 'playing', gameIds: [], system: true, mode: 'games', createdAt: 0, updatedAt: 0 },
  { id: NEXT_LIST_ID, name: 'Próximos a jugar', emoji: 'next', gameIds: [], system: true, mode: 'games', createdAt: 1, updatedAt: 0 },
  { id: WATCHING_LIST_ID, name: 'Viendo ahora', emoji: 'watching', gameIds: [], system: true, mode: 'screen', createdAt: 2, updatedAt: 0 },
  { id: TOWATCH_LIST_ID, name: 'Quiero ver', emoji: 'towatch', gameIds: [], system: true, mode: 'screen', createdAt: 3, updatedAt: 0 },
];

/** "Jugando ahora" / "Viendo ahora": being in one records the start date. */
const NOW_LISTS = new Set([PLAYING_LIST_ID, WATCHING_LIST_ID]);

interface State {
  apiKey: string;
  /** When the key was last changed, so the newest one wins when syncing. */
  apiKeyUpdatedAt: number;
  /** TMDB key for series & movies, synced like the RAWG one. */
  tmdbKey: string;
  tmdbKeyUpdatedAt: number;
  /** Day each game was moved to "Jugando ahora" (YYYY-MM-DD), to prefill the start date. */
  starts: Record<string, string>;
  /** When each start date was set (for syncing edits). */
  startsAt: Record<string, number>;
  /** Yearly goals: "games-2026" → how many titles to finish. */
  goals: Record<string, { target: number; updatedAt: number }>;
  /** Replays and rewatches, by id (the diary). */
  logs: Record<string, LogEntry>;
  logTombs: Record<string, number>;
  /** Local snapshots of every game the user has rated or listed. */
  games: Record<string, Game>;
  ratings: Record<string, Rating>;
  lists: GameList[];
  /** Deletion times, so a delete on one device wins over older copies on another. */
  ratingTombs: Record<string, number>;
  listTombs: Record<string, number>;

  setApiKey: (key: string) => void;
  setTmdbKey: (key: string) => void;
  /** Changes the day a game/series was started (YYYY-MM-DD). */
  setStart: (gameId: string, date: string) => void;
  setGoal: (key: string, target: number) => void;
  rememberGame: (game: Game) => void;
  /** Records that a title was played or watched again on `date`. */
  addLog: (game: Game, date: string, note: string) => void;
  deleteLog: (id: string) => void;
  saveRating: (game: Game, rating: Omit<Rating, 'gameId' | 'createdAt' | 'updatedAt'>) => void;
  deleteRating: (gameId: string) => void;

  createList: (name: string, emoji: string, mode: Mode) => string;
  updateList: (id: string, patch: Partial<Pick<GameList, 'name' | 'emoji'>>) => void;
  deleteList: (id: string) => void;
  addToList: (listId: string, game: Game, position?: 'top' | 'bottom') => void;
  removeFromList: (listId: string, gameId: string) => void;
  reorderList: (listId: string, gameIds: string[]) => void;

  importData: (data: unknown) => void;
}

/** Applies `fn` to the matching list and stamps it as changed. */
function touch(lists: GameList[], id: string, fn: (l: GameList) => GameList): GameList[] {
  return lists.map((l) => (l.id === id ? { ...fn(l), updatedAt: Date.now() } : l));
}

function snapshot(game: Game): Game {
  const { id, name, released, genres, platforms } = game;
  // IGDB's box art when it's known (it is, once the game was on screen).
  return { id, name, cover: bestCover(game), released, genres, platforms };
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      apiKey: '',
      apiKeyUpdatedAt: 0,
      tmdbKey: '',
      tmdbKeyUpdatedAt: 0,
      starts: {},
      startsAt: {},
      goals: {},
      logs: {},
      logTombs: {},
      games: {},
      ratings: {},
      lists: SYSTEM_LISTS,
      ratingTombs: {},
      listTombs: {},

      setApiKey: (apiKey) => set({ apiKey, apiKeyUpdatedAt: Date.now() }),
      setTmdbKey: (tmdbKey) => set({ tmdbKey, tmdbKeyUpdatedAt: Date.now() }),
      setGoal: (key, target) => set((s) => ({ goals: { ...s.goals, [key]: { target, updatedAt: Date.now() } } })),
      setStart: (gameId, date) =>
        set((s) => ({ starts: { ...s.starts, [gameId]: date }, startsAt: { ...s.startsAt, [gameId]: Date.now() } })),

      rememberGame: (game) => set((s) => ({ games: { ...s.games, [game.id]: snapshot(game) } })),

      addLog: (game, date, note) =>
        set((s) => {
          const now = Date.now();
          const id = uid();
          return {
            games: { ...s.games, [game.id]: snapshot(game) },
            logs: { ...s.logs, [id]: { id, gameId: game.id, date, note, createdAt: now, updatedAt: now } },
          };
        }),

      deleteLog: (id) =>
        set((s) => {
          const logs = { ...s.logs };
          delete logs[id];
          return { logs, logTombs: { ...s.logTombs, [id]: Date.now() } };
        }),

      saveRating: (game, rating) =>
        set((s) => {
          const prev = s.ratings[game.id];
          const now = Date.now();
          return {
            games: { ...s.games, [game.id]: snapshot(game) },
            ratings: {
              ...s.ratings,
              [game.id]: { ...rating, gameId: game.id, createdAt: prev?.createdAt ?? now, updatedAt: now },
            },
            // A freshly rated game has been played: drop it from the queue lists.
            lists: prev
              ? s.lists
              : s.lists.map((l) =>
                  (l.id === MODES[modeOf(game.id)].nowListId || l.id === MODES[modeOf(game.id)].nextListId) &&
                  l.gameIds.includes(game.id)
                    ? { ...l, gameIds: l.gameIds.filter((id) => id !== game.id), updatedAt: now }
                    : l,
                ),
          };
        }),

      deleteRating: (gameId) =>
        set((s) => {
          const ratings = { ...s.ratings };
          delete ratings[gameId];
          return { ratings, ratingTombs: { ...s.ratingTombs, [gameId]: Date.now() } };
        }),

      createList: (name, emoji, mode) => {
        const id = uid();
        const now = Date.now();
        set((s) => ({ lists: [...s.lists, { id, name, emoji, gameIds: [], system: false, mode, createdAt: now, updatedAt: now }] }));
        return id;
      },

      updateList: (id, patch) => set((s) => ({ lists: touch(s.lists, id, (l) => ({ ...l, ...patch })) })),

      deleteList: (id) =>
        set((s) => {
          if (s.lists.find((l) => l.id === id)?.system !== false) return s;
          return { lists: s.lists.filter((l) => l.id !== id), listTombs: { ...s.listTombs, [id]: Date.now() } };
        }),

      addToList: (listId, game, position = 'bottom') =>
        set((s) => ({
          games: { ...s.games, [game.id]: snapshot(game) },
          ...(NOW_LISTS.has(listId) && !s.starts[game.id]
            ? {
                starts: { ...s.starts, [game.id]: localDay() },
                startsAt: { ...s.startsAt, [game.id]: Date.now() },
              }
            : {}),
          lists: s.lists.map((l) => {
            if (l.id !== listId || l.gameIds.includes(game.id)) return l;
            const gameIds = position === 'top' ? [game.id, ...l.gameIds] : [...l.gameIds, game.id];
            return { ...l, gameIds, updatedAt: Date.now() };
          }),
        })),

      removeFromList: (listId, gameId) =>
        set((s) => ({ lists: touch(s.lists, listId, (l) => ({ ...l, gameIds: l.gameIds.filter((id) => id !== gameId) })) })),

      reorderList: (listId, gameIds) =>
        set((s) => ({ lists: touch(s.lists, listId, (l) => ({ ...l, gameIds })) })),

      importData: (data) => {
        const d = data as Partial<Pick<State, 'games' | 'ratings' | 'lists' | 'logs'>>;
        if (!d || typeof d !== 'object' || !d.games || !d.ratings || !Array.isArray(d.lists)) {
          throw new Error('El archivo no es un backup de GamesTracker');
        }
        // Imported lists count as the newest edit so syncing keeps them; what the
        // backup doesn't have is marked deleted. Ratings keep their own dates.
        const now = Date.now();
        const ratings = d.ratings;
        const lists = d.lists.map((l) => ({ ...l, updatedAt: now }));
        for (const sys of SYSTEM_LISTS) if (!lists.some((l) => l.id === sys.id)) lists.unshift({ ...sys, updatedAt: now });
        set((s) => ({
          games: { ...s.games, ...d.games },
          ratings,
          lists,
          // Backups from before the diary have no replays; keep the ones here.
          logs: d.logs && typeof d.logs === 'object' ? { ...s.logs, ...d.logs } : s.logs,
          ratingTombs: {
            ...s.ratingTombs,
            ...Object.fromEntries(Object.keys(s.ratings).filter((id) => !ratings[id]).map((id) => [id, now])),
          },
          listTombs: {
            ...s.listTombs,
            ...Object.fromEntries(s.lists.filter((l) => !lists.some((x) => x.id === l.id)).map((l) => [l.id, now])),
          },
        }));
      },
    }),
    {
      name: 'gamestraker',
      version: 4,
      migrate: (persisted, version) => {
        const s = persisted as Partial<State>;
        if (version < 4) {
          // Series & movies arrive with their own fixed lists.
          const lists = s.lists ?? [];
          for (const sys of SYSTEM_LISTS) if (!lists.some((l) => l.id === sys.id)) lists.push(sys);
          s.lists = lists;
          s.tmdbKey = s.tmdbKey ?? '';
          s.tmdbKeyUpdatedAt = s.tmdbKeyUpdatedAt ?? 0;
        }
        if (version < 3) {
          s.starts = s.starts ?? {};
          // A key typed before syncing existed should win over devices that have none.
          s.apiKeyUpdatedAt = s.apiKey ? Date.now() : 0;
        }
        if (version < 2) {
          s.lists = (s.lists ?? SYSTEM_LISTS).map((l) => ({ ...l, updatedAt: l.updatedAt ?? 0 }));
          s.ratingTombs = s.ratingTombs ?? {};
          s.listTombs = s.listTombs ?? {};
        }
        return s as State;
      },
    },
  ),
);

export function useRating(gameId: string | undefined): Rating | undefined {
  return useStore((s) => (gameId ? s.ratings[gameId] : undefined));
}
