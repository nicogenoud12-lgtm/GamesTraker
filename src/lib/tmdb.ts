import type { Game, GameDetail, Provider } from './types';
import type { ScreenKind } from './mode';

// TMDB (themoviedb.org) client for series & movies. Accepts either a v3 API
// key or a v4 read access token (the long "eyJ…" one).

const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';
const LANG = 'es-AR';
const REGION = 'AR';

export const MOVIE_GENRES: Record<number, string> = {
  28: 'Acción', 12: 'Aventura', 16: 'Animación', 35: 'Comedia', 80: 'Crimen', 99: 'Documental', 18: 'Drama',
  10751: 'Familia', 14: 'Fantasía', 36: 'Historia', 27: 'Terror', 10402: 'Música', 9648: 'Misterio',
  10749: 'Romance', 878: 'Ciencia ficción', 10770: 'Película de TV', 53: 'Suspenso', 10752: 'Bélica', 37: 'Western',
};
export const TV_GENRES: Record<number, string> = {
  10759: 'Acción y aventura', 16: 'Animación', 35: 'Comedia', 80: 'Crimen', 99: 'Documental', 18: 'Drama',
  10751: 'Familia', 10762: 'Infantil', 9648: 'Misterio', 10763: 'Noticias', 10764: 'Reality',
  10765: 'Ciencia ficción y fantasía', 10766: 'Telenovela', 10767: 'Talk show', 10768: 'Bélica y política', 37: 'Western',
};

export class TmdbError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

interface TmdbItem {
  id: number;
  media_type?: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  vote_average?: number;
  vote_count?: number;
}

const img = (path: string | null | undefined, size: 'w342' | 'w500' | 'w780' | 'w1280' | 'w92') =>
  path ? `${IMG}/${size}${path}` : null;

function toItem(t: TmdbItem, kind: ScreenKind): Game {
  const genreNames = t.genres?.map((g) => g.name) ?? (t.genre_ids ?? []).map((id) => (kind === 'tv' ? TV_GENRES : MOVIE_GENRES)[id]).filter(Boolean);
  return {
    id: `tmdb:${kind}:${t.id}`,
    name: (kind === 'tv' ? t.name : t.title) ?? t.name ?? t.title ?? '',
    cover: img(t.poster_path, 'w500'),
    released: (kind === 'tv' ? t.first_air_date : t.release_date) || null,
    genres: genreNames,
    platforms: [],
    // TMDB rates 0–10; shown as 0–100 next to Metacritic-style badges.
    metacritic: t.vote_count && t.vote_count >= 20 && t.vote_average ? Math.round(t.vote_average * 10) : null,
  };
}

// Responses are reused for a while: Discover rows are revisited often.
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: unknown }>();

async function get<T>(key: string, path: string, params: Record<string, string> = {}, signal?: AbortSignal): Promise<T> {
  const bearer = key.startsWith('eyJ');
  const qs = new URLSearchParams({ language: LANG, ...params, ...(bearer ? {} : { api_key: key }) });
  const url = `${API}${path}?${qs}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data as T;
  let res: Response;
  try {
    res = await fetch(url, { signal, headers: bearer ? { Authorization: `Bearer ${key}` } : undefined });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new TmdbError('No se pudo conectar con TMDB. Revisá que la key sea válida (Ajustes).', 0);
  }
  if (!res.ok) throw new TmdbError(res.status === 401 ? 'Key de TMDB inválida' : `Error de TMDB (${res.status})`, res.status);
  const data = (await res.json()) as T;
  cache.set(url, { at: Date.now(), data });
  return data;
}

interface Page {
  results: TmdbItem[];
  page: number;
  total_pages: number;
}

export async function tmdbSearch(key: string, query: string, signal?: AbortSignal): Promise<Game[]> {
  const data = await get<Page>(key, '/search/multi', { query, include_adult: 'false' }, signal);
  return data.results
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .map((r) => toItem(r, r.media_type as ScreenKind));
}

export async function tmdbTrending(key: string, signal?: AbortSignal): Promise<Game[]> {
  const data = await get<Page>(key, '/trending/all/week', {}, signal);
  return data.results
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .map((r) => toItem(r, r.media_type as ScreenKind));
}

/** Any list endpoint (discover, upcoming, top_rated…) for one kind. */
export async function tmdbList(
  key: string,
  kind: ScreenKind,
  path: string,
  params: Record<string, string>,
  page: number,
  signal?: AbortSignal,
): Promise<{ games: Game[]; hasMore: boolean }> {
  const data = await get<Page>(key, path, { ...params, page: String(page) }, signal);
  return { games: data.results.map((r) => toItem(r, kind)), hasMore: data.page < Math.min(data.total_pages, 500) };
}

export async function tmdbRecommendations(key: string, kind: ScreenKind, id: string, signal?: AbortSignal): Promise<Game[]> {
  const data = await get<Page>(key, `/${kind}/${id}/recommendations`, {}, signal);
  return data.results.map((r) => toItem(r, kind));
}

export async function tmdbCollection(key: string, collectionId: number, signal?: AbortSignal): Promise<Game[]> {
  const data = await get<{ parts: TmdbItem[] }>(key, `/collection/${collectionId}`, {}, signal);
  return data.parts.map((p) => toItem(p, 'movie'));
}

interface TmdbDetail extends TmdbItem {
  overview?: string;
  tagline?: string;
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  episode_run_time?: number[];
  status?: string;
  created_by?: { name: string }[];
  networks?: { name: string }[];
  production_companies?: { name: string }[];
  belongs_to_collection?: { id: number } | null;
  homepage?: string;
  imdb_id?: string | null;
  external_ids?: { imdb_id?: string | null };
  credits?: { crew?: { job: string; name: string }[]; cast?: { name: string }[] };
  videos?: { results: { site: string; type: string; key: string; official?: boolean }[] };
  images?: { backdrops: { file_path: string }[] };
  'watch/providers'?: { results?: Record<string, { flatrate?: { provider_name: string; logo_path: string }[] }> };
}

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

export async function tmdbDetail(key: string, kind: ScreenKind, id: string): Promise<GameDetail> {
  const d = await get<TmdbDetail>(key, `/${kind}/${id}`, {
    append_to_response: 'credits,videos,images,watch/providers,external_ids',
    include_image_language: 'null,es,en',
    include_video_language: 'es,en',
  });
  const base = toItem(d, kind);
  const crew = d.credits?.crew ?? [];
  const makers = kind === 'tv' ? (d.created_by ?? []).map((c) => c.name) : crew.filter((c) => c.job === 'Director').map((c) => c.name);
  const facts: { label: string; value: string }[] = [];
  if (kind === 'movie' && d.runtime) facts.push({ label: 'Duración', value: duration(d.runtime) });
  if (kind === 'tv' && d.number_of_seasons) {
    facts.push({ label: 'Temporadas', value: `${d.number_of_seasons} · ${d.number_of_episodes ?? '?'} episodios` });
  }
  if (kind === 'tv' && d.episode_run_time?.[0]) facts.push({ label: 'Por episodio', value: duration(d.episode_run_time[0]) });
  const cast = (d.credits?.cast ?? []).slice(0, 4).map((c) => c.name);
  if (cast.length) facts.push({ label: 'Reparto', value: cast.join(', ') });
  const videos = d.videos?.results ?? [];
  const trailer =
    videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ??
    videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ??
    videos.find((v) => v.site === 'YouTube');
  const providers: Provider[] = (d['watch/providers']?.results?.[REGION]?.flatrate ?? []).map((p) => ({
    name: p.provider_name,
    logo: img(p.logo_path, 'w92'),
  }));
  return {
    ...base,
    platforms: kind === 'tv' ? (d.networks ?? []).map((n) => n.name) : [],
    description: d.overview ?? '',
    tagline: d.tagline || undefined,
    developers: makers,
    publishers: kind === 'tv' ? [] : (d.production_companies ?? []).slice(0, 1).map((c) => c.name),
    metacritic: base.metacritic ?? null,
    scoreLabel: 'TMDB',
    playtime: null,
    website: d.homepage || null,
    screenshots: (d.images?.backdrops ?? []).slice(0, 9).map((b) => img(b.file_path, 'w780')!),
    facts,
    providers,
    trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
    collectionId: d.belongs_to_collection?.id ?? null,
    // Movies have it at the top; series only under external_ids.
    imdbId: d.imdb_id || d.external_ids?.imdb_id || null,
  };
}
