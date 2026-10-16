import type { Game } from './types';

export interface SplitScores {
  /** Critics' average, 0–100, and where it comes from ("Metacritic", "IGDB"). */
  critic: number | null;
  criticFrom: string;
  /** Players' (or audience's) average, 0–100, and where it comes from ("RAWG", "IGDB", "TMDB"). */
  users: number | null;
  usersFrom: string;
}

/** A title's critics' and players' scores kept apart, whatever catalog it came from. */
export function scoresOf(game: Game): SplitScores {
  // TMDB's score is its users' vote; older saved results labelled RAWG's players the same way.
  if (game.scoreLabel === 'TMDB' || game.scoreLabel === 'RAWG') {
    return { critic: null, criticFrom: '', users: game.metacritic ?? null, usersFrom: game.scoreLabel };
  }
  return {
    critic: game.metacritic ?? null,
    criticFrom: game.scoreLabel ?? 'Metacritic',
    users: game.userScore ?? null,
    usersFrom: game.userLabel ?? '',
  };
}
