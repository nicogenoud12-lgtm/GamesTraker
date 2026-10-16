import { gameLength, gameScores } from './critics';
import { cachedScores, hasScores, mergeScores, saveScores } from './scoreCache';
import { useStore } from '../store/useStore';
import { useSync } from '../store/useSync';

// Scores of the games on this account (rated or on a list) are fetched quietly in
// the background, a few at a time, so opening any of them shows its scores at once.
// Titles saved later get theirs too. Series and movies don't need it: their IMDb
// score comes from our own server's copy and answers right away.

/** Per run, so a big library fills in over a few visits without hammering the server. */
const PER_RUN = 40;
const PAUSE_MS = 1500;
/** Scores change slowly; refreshed in the background after this long (the game page refreshes on every visit). */
const STALE_MS = 14 * 864e5;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function startScoreWarmup(): () => void {
  let stopped = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const { ratings, lists, games } = useStore.getState();
      const saved = new Set([...Object.keys(ratings), ...lists.flatMap((l) => l.gameIds)]);
      const todo = [...saved]
        .filter((id) => id.startsWith('rawg:') && games[id])
        .filter((id) => {
          const c = cachedScores(id);
          return !c || Date.now() - c.at > STALE_MS;
        })
        .slice(0, PER_RUN);
      for (const id of todo) {
        if (stopped || !useSync.getState().token) break;
        const g = games[id];
        const [scores, length] = await Promise.all([gameScores(g.name, g.released), gameLength(g.name, g.released)]);
        // Kept even when empty, so a title nobody scores isn't asked again until it's stale.
        saveScores(id, {
          ...(hasScores(scores) ? { scores: mergeScores(cachedScores(id)?.scores, scores) } : {}),
          ...(length !== undefined ? { length } : {}),
        });
        await wait(PAUSE_MS);
      }
    } finally {
      running = false;
    }
  };

  timer = setTimeout(run, 8000);
  // A newly rated or listed game: its scores a moment later.
  const unsubscribe = useStore.subscribe((s, prev) => {
    if (s.ratings === prev.ratings && s.lists === prev.lists) return;
    clearTimeout(timer);
    timer = setTimeout(run, 5000);
  });
  return () => {
    stopped = true;
    clearTimeout(timer);
    unsubscribe();
  };
}
