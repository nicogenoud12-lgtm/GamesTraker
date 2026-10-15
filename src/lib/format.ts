export function year(released: string | null): string {
  return released ? released.slice(0, 4) : '';
}

export function shortPlatforms(platforms: string[], max = 3): string {
  const map: Record<string, string> = {
    'PlayStation 5': 'PS5',
    'PlayStation 4': 'PS4',
    'PlayStation 3': 'PS3',
    'PlayStation 2': 'PS2',
    PlayStation: 'PS1',
    'Xbox Series S/X': 'Xbox Series',
    'Xbox One': 'Xbox One',
    'Xbox 360': 'X360',
    'Nintendo Switch': 'Switch',
    'Nintendo 3DS': '3DS',
    'Nintendo DS': 'DS',
    'Nintendo 64': 'N64',
    GameCube: 'GC',
    'Game Boy Advance': 'GBA',
    macOS: 'Mac',
  };
  const names = platforms.map((p) => map[p] ?? p);
  const extra = names.length - max;
  return names.slice(0, max).join(' · ') + (extra > 0 ? ` +${extra}` : '');
}

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Whole days from one YYYY-MM-DD date to another (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 864e5);
}

export function formatHours(h: number): string {
  return `${String(h).replace('.', ',')} h`;
}

/** "Día 5" for a game started on `start` (YYYY-MM-DD), counting today. */
export function playingDay(start: string | undefined): string | null {
  if (!start) return null;
  const today = new Date().toISOString().slice(0, 10);
  const n = daysBetween(start, today) + 1;
  return n >= 1 ? `Día ${n}` : null;
}
