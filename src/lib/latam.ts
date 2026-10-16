import { useStore } from '../store/useStore';
import { tmdbItem } from './tmdb';
import type { ScreenKind } from './mode';

// Movies and series used to be looked up with TMDB's es-AR, which falls back to
// Spain's titles and posters ("El club de la lucha"). Now they come in Latin
// American Spanish; this renames, once per device, the ones already saved.

const DONE = 'gamestraker-latam-names';

let running = false;

export async function refreshSavedTitles(): Promise<void> {
  const key = useStore.getState().tmdbKey;
  if (running || !key) return;
  try {
    if (localStorage.getItem(DONE)) return;
  } catch {
    return;
  }
  running = true;
  try {
    const ids = Object.keys(useStore.getState().games).filter((id) => /^tmdb:(movie|tv):\d+$/.test(id));
    const updates: Record<string, { name: string; cover: string | null }> = {};
    for (let i = 0; i < ids.length; i += 4) {
      const found = await Promise.all(
        ids.slice(i, i + 4).map((id) => {
          const [, kind, tmdbId] = id.split(':');
          // A title TMDB removed keeps its old name; anything else stops the run, to retry another day.
          return tmdbItem(key, kind as ScreenKind, tmdbId).catch((e: { status?: number }) => {
            if (e.status === 404) return null;
            throw e;
          });
        }),
      );
      for (const g of found) if (g?.name) updates[g.id] = { name: g.name, cover: g.cover };
    }
    useStore.setState((s) => {
      const games = { ...s.games };
      let changed = false;
      for (const [id, u] of Object.entries(updates)) {
        const old = games[id];
        if (!old || (old.name === u.name && old.cover === (u.cover ?? old.cover))) continue;
        games[id] = { ...old, name: u.name, cover: u.cover ?? old.cover };
        changed = true;
      }
      return changed ? { games } : {};
    });
    localStorage.setItem(DONE, String(Date.now()));
  } catch {
    // Offline or TMDB down: tried again next time the app opens.
  } finally {
    running = false;
  }
}
