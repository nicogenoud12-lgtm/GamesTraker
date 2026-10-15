import type { RawgQuery } from './rawg';
import type { Game } from './types';

export type PeriodId = 'year' | 'last-year' | 'recent' | 'upcoming' | 'decade' | '2010s' | '2000s' | '90s' | 'all';
export type OrderId = 'best' | 'popular' | 'new';

export interface DiscoverFilters {
  period: PeriodId;
  genre: string | null;
  platform: string | null;
  order: OrderId;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};
const thisYear = () => new Date().getFullYear();

export const PERIODS: { id: PeriodId; label: string; range: () => [string, string] | null }[] = [
  { id: 'year', label: `Este año`, range: () => [`${thisYear()}-01-01`, `${thisYear()}-12-31`] },
  { id: 'last-year', label: 'Año pasado', range: () => [`${thisYear() - 1}-01-01`, `${thisYear() - 1}-12-31`] },
  { id: 'recent', label: 'Últimos 30 días', range: () => [iso(shift(-30)), iso(new Date())] },
  { id: 'upcoming', label: 'Próximamente', range: () => [iso(shift(1)), iso(shift(365))] },
  { id: 'decade', label: 'Esta década', range: () => ['2020-01-01', '2029-12-31'] },
  { id: '2010s', label: '2010s', range: () => ['2010-01-01', '2019-12-31'] },
  { id: '2000s', label: '2000s', range: () => ['2000-01-01', '2009-12-31'] },
  { id: '90s', label: '90s', range: () => ['1990-01-01', '1999-12-31'] },
  { id: 'all', label: 'Todos', range: () => null },
];

/** RAWG genre slugs, plus the labels used by the demo catalog. */
export const GENRES: { slug: string; label: string; demo: string[] }[] = [
  { slug: 'action', label: 'Acción', demo: ['Acción'] },
  { slug: 'role-playing-games-rpg', label: 'RPG', demo: ['RPG', 'JRPG'] },
  { slug: 'adventure', label: 'Aventura', demo: ['Aventura', 'Exploración'] },
  { slug: 'shooter', label: 'Shooter', demo: ['Shooter'] },
  { slug: 'indie', label: 'Indie', demo: ['Indie'] },
  { slug: 'platformer', label: 'Plataformas', demo: ['Plataformas', 'Metroidvania'] },
  { slug: 'strategy', label: 'Estrategia', demo: ['Estrategia'] },
  { slug: 'puzzle', label: 'Puzzle', demo: ['Puzzle'] },
  { slug: 'simulation', label: 'Simulación', demo: ['Simulación', 'Sandbox'] },
  { slug: 'racing', label: 'Carreras', demo: [] },
  { slug: 'sports', label: 'Deportes', demo: ['Deportes'] },
  { slug: 'fighting', label: 'Pelea', demo: [] },
  { slug: 'arcade', label: 'Arcade', demo: ['Roguelike'] },
  { slug: 'casual', label: 'Casual', demo: ['Cartas'] },
];

/** RAWG parent platform ids. */
export const PLATFORMS: { id: string; label: string; match: RegExp }[] = [
  { id: '1', label: 'PC', match: /^PC$/ },
  { id: '2', label: 'PlayStation', match: /^PlayStation/ },
  { id: '3', label: 'Xbox', match: /^Xbox/ },
  { id: '7', label: 'Nintendo', match: /Nintendo|Wii|GameCube|Game Boy/ },
  { id: '4', label: 'iOS', match: /^iOS$/ },
  { id: '8', label: 'Android', match: /^Android$/ },
];

export const ORDERS: { id: OrderId; label: string }[] = [
  { id: 'best', label: 'Mejor puntuados' },
  { id: 'popular', label: 'Más populares' },
  { id: 'new', label: 'Más nuevos' },
];

export const DEFAULT_FILTERS: DiscoverFilters = { period: 'year', genre: null, platform: null, order: 'best' };

export function toRawgQuery(f: DiscoverFilters): RawgQuery {
  const range = PERIODS.find((p) => p.id === f.period)?.range() ?? null;
  return {
    dates: range ? range.join(',') : undefined,
    genres: f.genre ?? undefined,
    parent_platforms: f.platform ?? undefined,
    ordering: f.order === 'best' ? '-metacritic' : f.order === 'popular' ? '-added' : '-released',
    // Ranking by Metacritic only makes sense among games that have a score.
    metacritic: f.order === 'best' ? '1,100' : undefined,
  };
}

export function filtersFromParams(params: URLSearchParams): DiscoverFilters {
  const period = params.get('periodo') as PeriodId | null;
  const order = params.get('orden') as OrderId | null;
  return {
    period: period && PERIODS.some((p) => p.id === period) ? period : DEFAULT_FILTERS.period,
    genre: GENRES.some((g) => g.slug === params.get('genero')) ? params.get('genero') : null,
    platform: PLATFORMS.some((p) => p.id === params.get('plataforma')) ? params.get('plataforma') : null,
    order: order && ORDERS.some((o) => o.id === order) ? order : DEFAULT_FILTERS.order,
  };
}

export function filtersToParams(f: DiscoverFilters): Record<string, string> {
  const out: Record<string, string> = { periodo: f.period, orden: f.order };
  if (f.genre) out.genero = f.genre;
  if (f.platform) out.plataforma = f.platform;
  return out;
}

export function exploreLink(f: Partial<DiscoverFilters>): string {
  return `/descubrir/explorar?${new URLSearchParams(filtersToParams({ ...DEFAULT_FILTERS, ...f }))}`;
}

/** Applies the same filters to the offline demo catalog. */
export function filterDemo(games: Game[], f: DiscoverFilters): Game[] {
  const range = PERIODS.find((p) => p.id === f.period)?.range() ?? null;
  const genre = GENRES.find((g) => g.slug === f.genre);
  const platform = PLATFORMS.find((p) => p.id === f.platform);
  const out = games.filter(
    (g) =>
      (!range || (g.released != null && g.released >= range[0] && g.released <= range[1])) &&
      (!genre || g.genres.some((x) => genre.demo.includes(x))) &&
      (!platform || g.platforms.some((x) => platform.match.test(x))),
  );
  if (f.order === 'new') out.sort((a, b) => (b.released ?? '').localeCompare(a.released ?? ''));
  return out;
}

/** RAWG genre name (as stored on games) → slug used by the API. */
export function genreSlug(name: string): string {
  if (name === 'RPG') return 'role-playing-games-rpg';
  return name.toLowerCase().replace(/\s+/g, '-');
}
