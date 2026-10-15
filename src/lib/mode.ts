import { Clapperboard, Gamepad2, type LucideIcon } from 'lucide-react';
import type { PlayStatus } from './types';

/** The app holds two separate collections that share every screen. */
export type Mode = 'games' | 'screen';
export type ScreenKind = 'movie' | 'tv';

export const PLAYING_LIST_ID = 'playing';
export const NEXT_LIST_ID = 'next';
export const WATCHING_LIST_ID = 'watching';
export const TOWATCH_LIST_ID = 'towatch';

interface ModeCopy {
  id: Mode;
  label: string;
  short: string;
  icon: LucideIcon;
  /** Aurora / hero colours. */
  glow: [string, string, string];
  nowListId: string;
  nextListId: string;
  nowLabel: string;
  nextLabel: string;
  doing: string;
  doingActive: string;
  start: string;
  item: string;
  items: string;
  collection: string;
  /** First half of the app's name in this mode: GamesTracker / MediaTracker. */
  brand: string;
  searchHint: string;
  emptyTitle: string;
  emptyText: string;
  discoverCta: string;
  demoHint: string;
}

export const MODES: Record<Mode, ModeCopy> = {
  games: {
    id: 'games',
    label: 'Juegos',
    short: 'Juegos',
    icon: Gamepad2,
    glow: ['#7c3aed', '#f472b6', '#22d3ee'],
    nowListId: PLAYING_LIST_ID,
    nextListId: NEXT_LIST_ID,
    nowLabel: 'Jugando ahora',
    nextLabel: 'Próximos a jugar',
    doing: 'Estoy jugando',
    doingActive: 'Jugando',
    start: 'Empezar a jugar',
    item: 'juego',
    items: 'juegos',
    collection: 'Mis juegos',
    brand: 'Games',
    searchHint: 'Zelda, Hades, Elden Ring…',
    emptyTitle: 'Empezá tu colección',
    emptyText: 'Buscá un juego que hayas jugado para puntuarlo, o agregalo a tu lista de próximos.',
    discoverCta: '¿Qué juego sigue?',
    demoHint: 'Conectá la base de RAWG (gratis) para buscar entre +800.000 juegos con carátulas.',
  },
  screen: {
    id: 'screen',
    label: 'Series y pelis',
    short: 'Series y pelis',
    icon: Clapperboard,
    glow: ['#f59e0b', '#fb7185', '#ef4444'],
    nowListId: WATCHING_LIST_ID,
    nextListId: TOWATCH_LIST_ID,
    nowLabel: 'Viendo ahora',
    nextLabel: 'Quiero ver',
    doing: 'Estoy viendo',
    doingActive: 'Viendo',
    start: 'Empezar a ver',
    item: 'título',
    items: 'títulos',
    collection: 'Mis series y pelis',
    brand: 'Media',
    searchHint: 'Breaking Bad, Dune, Relatos salvajes…',
    emptyTitle: 'Empezá tu lista de series y pelis',
    emptyText: 'Buscá algo que hayas visto para puntuarlo, o agregalo a "Quiero ver".',
    discoverCta: '¿Qué vemos hoy?',
    demoHint: 'Conectá la base de TMDB (gratis) para buscar todas las series y películas, con dónde verlas.',
  },
};

/** Screen items use ids like "tmdb:movie:603"; everything else is a game. */
export function modeOf(id: string): Mode {
  return id.startsWith('tmdb:') || id.startsWith('dscr:') ? 'screen' : 'games';
}

export function kindOf(id: string): ScreenKind | null {
  if (modeOf(id) !== 'screen') return null;
  return id.split(':')[1] === 'tv' ? 'tv' : 'movie';
}

export const KIND_LABEL: Record<ScreenKind, string> = { movie: 'Película', tv: 'Serie' };

/** Lists created before modes existed belong to games. */
export const listMode = (l: { id: string; mode?: Mode }): Mode =>
  l.mode ?? (l.id === WATCHING_LIST_ID || l.id === TOWATCH_LIST_ID ? 'screen' : 'games');

/** Status labels depend on what was rated. */
export function statusOptions(id: string): { id: PlayStatus; label: string }[] {
  const kind = kindOf(id);
  if (kind === 'movie')
    return [
      { id: 'terminado', label: 'Vista' },
      { id: 'abandonado', label: 'Abandonada' },
    ];
  if (kind === 'tv')
    return [
      { id: 'terminado', label: 'Terminada' },
      { id: 'completado', label: 'Al día' },
      { id: 'abandonado', label: 'Abandonada' },
    ];
  return [
    { id: 'terminado', label: 'Terminado' },
    { id: 'completado', label: '100%' },
    { id: 'abandonado', label: 'Abandonado' },
  ];
}

export function statusLabel(id: string, status: PlayStatus): string {
  return statusOptions(id).find((s) => s.id === status)?.label ?? '';
}

/** Where people watch things in Argentina; ids are TMDB watch providers. */
export const STREAMING = [
  { id: '8', label: 'Netflix' },
  { id: '119', label: 'Prime Video' },
  { id: '337', label: 'Disney+' },
  { id: '1899', label: 'Max' },
  { id: '350', label: 'Apple TV+' },
  { id: '531', label: 'Paramount+' },
];
