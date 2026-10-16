import type { RawgQuery } from './rawg';
import type { Game } from './types';
import { STREAMING, kindOf, type Mode, type ScreenKind } from './mode';

export type PeriodId = 'year' | 'last-year' | 'recent' | 'upcoming' | 'decade' | '2010s' | '2000s' | '90s' | 'all';
export type OrderId = 'best' | 'popular' | 'new';

export interface DiscoverFilters {
  period: PeriodId;
  genre: string | null;
  platform: string | null;
  order: OrderId;
  /** Movies or series; only used in the series & movies mode. */
  kind: ScreenKind;
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

export const DEFAULT_FILTERS: DiscoverFilters = { period: 'year', genre: null, platform: null, order: 'best', kind: 'movie' };

/** TMDB genre ids for movies and series (series lump some genres together). */
export const SCREEN_GENRES: { slug: string; label: string; movie: string | null; tv: string | null }[] = [
  { slug: 'accion', label: 'Acción', movie: '28', tv: '10759' },
  { slug: 'aventura', label: 'Aventura', movie: '12', tv: '10759' },
  { slug: 'comedia', label: 'Comedia', movie: '35', tv: '35' },
  { slug: 'drama', label: 'Drama', movie: '18', tv: '18' },
  { slug: 'crimen', label: 'Crimen', movie: '80', tv: '80' },
  { slug: 'ciencia-ficcion', label: 'Ciencia ficción', movie: '878', tv: '10765' },
  { slug: 'fantasia', label: 'Fantasía', movie: '14', tv: '10765' },
  { slug: 'misterio', label: 'Misterio', movie: '9648', tv: '9648' },
  { slug: 'terror', label: 'Terror', movie: '27', tv: null },
  { slug: 'suspenso', label: 'Suspenso', movie: '53', tv: null },
  { slug: 'romance', label: 'Romance', movie: '10749', tv: null },
  { slug: 'animacion', label: 'Animación', movie: '16', tv: '16' },
  { slug: 'documental', label: 'Documental', movie: '99', tv: '99' },
  { slug: 'familia', label: 'Familia', movie: '10751', tv: '10751' },
  { slug: 'historia', label: 'Historia', movie: '36', tv: null },
  { slug: 'belica', label: 'Bélica', movie: '10752', tv: '10768' },
];

export const KINDS: { id: ScreenKind; label: string }[] = [
  { id: 'movie', label: 'Películas' },
  { id: 'tv', label: 'Series' },
];

export function genreOptions(mode: Mode, kind: ScreenKind): { slug: string; label: string }[] {
  return mode === 'games' ? GENRES : SCREEN_GENRES.filter((g) => g[kind] !== null);
}

export function platformOptions(mode: Mode): { id: string; label: string }[] {
  return mode === 'games' ? PLATFORMS : STREAMING;
}

/** TMDB discover request for the filters (movies use release dates, series first-air dates). */
export function toTmdbQuery(f: DiscoverFilters): { path: string; params: Record<string, string> } {
  const movie = f.kind === 'movie';
  const range = PERIODS.find((p) => p.id === f.period)?.range() ?? null;
  const dateKey = movie ? 'primary_release_date' : 'first_air_date';
  const params: Record<string, string> = { include_adult: 'false' };
  const today = iso(new Date());
  if (range) {
    params[`${dateKey}.gte`] = range[0];
    params[`${dateKey}.lte`] = range[1];
  }
  if (f.order === 'best') {
    params.sort_by = 'vote_average.desc';
    // Without a vote floor, obscure titles with one 10/10 vote would win.
    params['vote_count.gte'] = f.period === 'all' ? (movie ? '2000' : '500') : movie ? '200' : '80';
  } else if (f.order === 'popular') {
    params.sort_by = 'popularity.desc';
  } else {
    params.sort_by = `${dateKey}.desc`;
    if (!range || range[1] > today) params[`${dateKey}.lte`] = today;
  }
  const genre = SCREEN_GENRES.find((g) => g.slug === f.genre)?.[f.kind];
  if (genre) params.with_genres = genre;
  if (f.platform) {
    params.with_watch_providers = f.platform;
    params.watch_region = 'AR';
    params.with_watch_monetization_types = 'flatrate';
  }
  return { path: `/discover/${f.kind}`, params };
}

/** Same filters over the offline demo series & movies. */
export function filterDemoScreen(items: Game[], f: DiscoverFilters): Game[] {
  const range = PERIODS.find((p) => p.id === f.period)?.range() ?? null;
  const genre = SCREEN_GENRES.find((g) => g.slug === f.genre);
  const out = items.filter(
    (g) =>
      kindOf(g.id) === f.kind &&
      (!range || (g.released != null && g.released >= range[0] && g.released <= range[1])) &&
      (!genre || g.genres.some((x) => x.toLowerCase().includes(genre.label.toLowerCase()))),
  );
  if (f.order === 'new') out.sort((a, b) => (b.released ?? '').localeCompare(a.released ?? ''));
  return out;
}

/**
 * Recent periods ranked by critics or popularity come from IGDB through our server:
 * RAWG barely has Metacritic scores for new games, so "the best of this year" was empty.
 */
export function serverDiscoverQuery(f: DiscoverFilters, page: number): URLSearchParams | null {
  const recent = f.period === 'year' || f.period === 'last-year' || f.period === 'recent' || (f.period === 'upcoming' && f.order === 'popular');
  if (!recent || (f.order !== 'best' && f.order !== 'popular')) return null;
  const range = PERIODS.find((p) => p.id === f.period)?.range();
  if (!range) return null;
  const q = new URLSearchParams({ from: range[0], to: range[1], order: f.order, page: String(page) });
  if (f.genre) q.set('genre', f.genre);
  if (f.platform) q.set('platform', f.platform);
  return q;
}

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

export function filtersFromParams(params: URLSearchParams, mode: Mode): DiscoverFilters {
  const period = params.get('periodo') as PeriodId | null;
  const order = params.get('orden') as OrderId | null;
  const kind: ScreenKind = params.get('tipo') === 'tv' ? 'tv' : 'movie';
  return {
    period: period && PERIODS.some((p) => p.id === period) ? period : DEFAULT_FILTERS.period,
    genre: genreOptions(mode, kind).some((g) => g.slug === params.get('genero')) ? params.get('genero') : null,
    platform: platformOptions(mode).some((p) => p.id === params.get('plataforma')) ? params.get('plataforma') : null,
    order: order && ORDERS.some((o) => o.id === order) ? order : DEFAULT_FILTERS.order,
    kind,
  };
}

export function filtersToParams(f: DiscoverFilters, mode: Mode): Record<string, string> {
  const out: Record<string, string> = { periodo: f.period, orden: f.order };
  if (mode === 'screen') out.tipo = f.kind;
  if (f.genre) out.genero = f.genre;
  if (f.platform) out.plataforma = f.platform;
  return out;
}

export function exploreLink(f: Partial<DiscoverFilters>, mode: Mode = 'games'): string {
  return `/descubrir/explorar?${new URLSearchParams(filtersToParams({ ...DEFAULT_FILTERS, ...f }, mode))}`;
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
