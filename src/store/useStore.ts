import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../lib/format';
import type { Game, GameList, Rating } from '../lib/types';

export const NEXT_LIST_ID = 'next';
export const PLAYING_LIST_ID = 'playing';

const SYSTEM_LISTS: GameList[] = [
  { id: PLAYING_LIST_ID, name: 'Jugando ahora', emoji: 'playing', gameIds: [], system: true, createdAt: 0, updatedAt: 0 },
  { id: NEXT_LIST_ID, name: 'Próximos a jugar', emoji: 'next', gameIds: [], system: true, createdAt: 1, updatedAt: 0 },
];

interface State {
  apiKey: string;
  /** Local snapshots of every game the user has rated or listed. */
  games: Record<string, Game>;
  ratings: Record<string, Rating>;
  lists: GameList[];
  /** Deletion times, so a delete on one device wins over older copies on another. */
  ratingTombs: Record<string, number>;
  listTombs: Record<string, number>;

  setApiKey: (key: string) => void;
  rememberGame: (game: Game) => void;
  saveRating: (game: Game, rating: Omit<Rating, 'gameId' | 'createdAt' | 'updatedAt'>) => void;
  deleteRating: (gameId: string) => void;

  createList: (name: string, emoji: string) => string;
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
  const { id, name, cover, released, genres, platforms } = game;
  return { id, name, cover, released, genres, platforms };
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      apiKey: '',
      games: {},
      ratings: {},
      lists: SYSTEM_LISTS,
      ratingTombs: {},
      listTombs: {},

      setApiKey: (apiKey) => set({ apiKey }),

      rememberGame: (game) => set((s) => ({ games: { ...s.games, [game.id]: snapshot(game) } })),

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
                  (l.id === NEXT_LIST_ID || l.id === PLAYING_LIST_ID) && l.gameIds.includes(game.id)
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

      createList: (name, emoji) => {
        const id = uid();
        const now = Date.now();
        set((s) => ({ lists: [...s.lists, { id, name, emoji, gameIds: [], system: false, createdAt: now, updatedAt: now }] }));
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
        const d = data as Partial<Pick<State, 'games' | 'ratings' | 'lists'>>;
        if (!d || typeof d !== 'object' || !d.games || !d.ratings || !Array.isArray(d.lists)) {
          throw new Error('El archivo no es un backup de GamesTraker');
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
      version: 2,
      migrate: (persisted, version) => {
        const s = persisted as Partial<State>;
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
