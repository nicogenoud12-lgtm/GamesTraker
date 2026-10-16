import { useStore } from '../store/useStore';
import { useSync } from '../store/useSync';
import { askAll, isRawg } from './covers';
import { tmdbItem } from './tmdb';
import type { ScreenKind } from './mode';

// The saved copy of each rated or listed title (its name and cover, used by
// lists, share images and friends) is brought up to date once per device when
// where they come from changes.

// Movies and series used to be looked up with TMDB's es-AR, which falls back to
// Spain's titles and posters ("El club de la lucha"). Now they come in Latin
// American Spanish.

const NAMES_DONE = 'gamestraker-latam-names';

let running = false;

export async function refreshSavedTitles(): Promise<void> {
  const key = useStore.getState().tmdbKey;
  if (running || !key) return;
  try {
    if (localStorage.getItem(NAMES_DONE)) return;
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
    localStorage.setItem(NAMES_DONE, String(Date.now()));
  } catch {
    // Offline or TMDB down: tried again next time the app opens.
  } finally {
    running = false;
  }
}

// Games rated or listed before covers came from IGDB keep RAWG's in their saved
// copy (used by lists, share images, friends). Swapped once per device.
const COVERS_DONE = 'gamestraker-igdb-covers';
let refreshing = false;

export async function refreshSavedCovers(): Promise<void> {
  if (refreshing || !useSync.getState().token) return;
  try {
    if (localStorage.getItem(COVERS_DONE)) return;
  } catch {
    return;
  }
  refreshing = true;
  try {
    const saved = Object.values(useStore.getState().games).filter((g) => isRawg(g.id) && !g.cover?.includes('images.igdb.com/'));
    const found = await askAll(saved.map((g) => ({ id: g.id, name: g.name, year: Number(g.released?.slice(0, 4)) || null })));
    if (!found) return;
    useStore.setState((s) => {
      const games = { ...s.games };
      let changed = false;
      for (const [id, url] of Object.entries(found)) {
        if (!url || !games[id] || games[id].cover === url) continue;
        games[id] = { ...games[id], cover: url };
        changed = true;
      }
      return changed ? { games } : {};
    });
    localStorage.setItem(COVERS_DONE, String(Date.now()));
  } finally {
    refreshing = false;
  }
}
