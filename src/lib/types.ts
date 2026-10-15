export type TierId = 'malo' | 'aburrido' | 'safa' | 'bueno' | 'buenisimo' | 'historico';

export type PlayStatus = 'terminado' | 'completado' | 'abandonado';

export type Replay = 'si' | 'quizas' | 'no';

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

export interface Provider {
  name: string;
  logo: string | null;
}

export interface GameDetail extends Game {
  description: string;
  developers: string[];
  publishers: string[];
  metacritic: number | null;
  playtime: number | null;
  website: string | null;
  screenshots: string[];
  /** Label for `metacritic` when the score comes from elsewhere (e.g. "TMDB"). */
  scoreLabel?: string;
  /** Extra facts for the info grid (runtime, seasons…). */
  facts?: { label: string; value: string }[];
  /** Streaming services in Argentina. */
  providers?: Provider[];
  trailer?: string | null;
  /** TMDB collection id, used for the "same saga" row of movies. */
  collectionId?: number | null;
  tagline?: string;
}

export interface Rating {
  gameId: string;
  score: number;
  tier: TierId;
  status: PlayStatus;
  platform: string | null;
  /** Older ratings don't have the fields below. */
  startedAt?: string | null;
  finishedAt: string | null;
  hours?: number | null;
  replay?: Replay | null;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface GameList {
  id: string;
  name: string;
  /** Icon id from LIST_ICONS (older lists may still hold an emoji). */
  emoji: string;
  gameIds: string[];
  system: boolean;
  /** Which collection the list belongs to; missing means games. */
  mode?: 'games' | 'screen';
  createdAt: number;
  /** Bumped on every change so devices can merge lists when syncing. */
  updatedAt: number;
}
