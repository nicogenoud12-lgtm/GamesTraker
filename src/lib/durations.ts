import { useEffect, useState } from 'react';
import { type Keys, itemDetail } from './catalog';

// How long each listed title takes, for the totals of a list and the
// "¿Qué hago ahora?" roulette. Kept on the device for a month so a list of
// 30 titles isn't looked up again every visit.

const KEY = 'gamestraker-durations';
const TTL = 30 * 864e5;

type Cache = Record<string, { h: number | null; at: number }>;
let memory: Cache | null = null;

function cache(): Cache {
  if (!memory) {
    try {
      memory = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    } catch {
      memory = {};
    }
  }
  return memory!;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache()));
  } catch {
    // Storage blocked or full: durations are just looked up again next time.
  }
}

export async function itemHours(keys: Keys, id: string): Promise<number | null> {
  const hit = cache()[id];
  if (hit && Date.now() - hit.at < TTL) return hit.h;
  const detail = await itemDetail(keys, id);
  const h = detail ? (detail.hours ?? detail.playtime ?? null) : null;
  // Without a key there's no detail; don't remember that as "unknown".
  if (detail) {
    cache()[id] = { h, at: Date.now() };
    save();
  }
  return h;
}

/** Hours per id, filled in as they arrive (known ones right away). */
export function useHours(keys: Keys, ids: string[]): Record<string, number | null> {
  const [hours, setHours] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(ids.filter((id) => cache()[id]).map((id) => [id, cache()[id].h])),
  );
  const idsKey = ids.join('|');
  const keysKey = `${keys.rawg}|${keys.tmdb}`;
  useEffect(() => {
    let alive = true;
    const pending = ids.filter((id) => !(id in hours));
    (async () => {
      for (let i = 0; i < pending.length; i += 4) {
        const batch = pending.slice(i, i + 4);
        const found = await Promise.all(batch.map((id) => itemHours(keys, id).catch(() => null)));
        if (!alive) return;
        setHours((prev) => ({ ...prev, ...Object.fromEntries(batch.map((id, k) => [id, found[k]])) }));
      }
    })();
    return () => {
      alive = false;
    };
    // `hours` is only read to skip known ids; re-running on it would loop.
  }, [idsKey, keysKey]);
  return hours;
}

/** An estimate, rounded: "45 min", "2,5 h", "38 h". */
export function roughHours(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 10) return `${Math.round(h * 2) / 2} h`.replace('.', ',');
  return `${Math.round(h)} h`;
}
