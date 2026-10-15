export type TierId = 'malo' | 'aburrido' | 'safa' | 'bueno' | 'buenisimo' | 'historico';

export type PlayStatus = 'terminado' | 'completado' | 'abandonado';

/** Snapshot of a game kept locally so lists and ratings render offline. */
export interface Game {
  id: string;
  name: string;
  cover: string | null;
  released: string | null;
  genres: string[];
  platforms: string[];
  /** Only present on fresh API results; not kept in local snapshots. */
  metacritic?: number | null;
}

export interface GameDetail extends Game {
  description: string;
  developers: string[];
  publishers: string[];
  metacritic: number | null;
  playtime: number | null;
  website: string | null;
  screenshots: string[];
}

export interface Rating {
  gameId: string;
  score: number;
  tier: TierId;
  status: PlayStatus;
  platform: string | null;
  finishedAt: string | null;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface GameList {
  id: string;
  name: string;
  emoji: string;
  gameIds: string[];
  system: boolean;
  createdAt: number;
  /** Bumped on every change so devices can merge lists when syncing. */
  updatedAt: number;
}
