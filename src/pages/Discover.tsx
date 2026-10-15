import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import GameRail from '../components/GameRail';
import PageHeader from '../components/PageHeader';
import ScrollRow from '../components/ScrollRow';
import { type Keys, discoverItems, keyFor, recommendItems, trendingItems, useKeys } from '../lib/catalog';
import { type DiscoverFilters, DEFAULT_FILTERS, GENRES, SCREEN_GENRES, exploreLink } from '../lib/discover';
import { MODES, STREAMING, listMode, modeOf, type Mode } from '../lib/mode';
import { gameProfile, recommendFromProfile } from '../lib/taste';
import type { Game } from '../lib/types';
import { useStore } from '../store/useStore';
import { useMode } from '../store/useUi';

const year = new Date().getFullYear();

interface RailDef {
  title: string;
  filters?: Partial<DiscoverFilters>;
  /** Rows that don't map to Explore filters load themselves. */
  load?: (keys: Keys, signal: AbortSignal) => Promise<Game[]>;
}

const RAILS: Record<Mode, RailDef[]> = {
  games: [
    { title: `Lo mejor de ${year}`, filters: { period: 'year', order: 'best' } },
    { title: 'Recién salidos', filters: { period: 'recent', order: 'popular' } },
    { title: 'Se vienen', filters: { period: 'upcoming', order: 'popular' } },
    { title: 'Lo mejor de la década', filters: { period: 'decade', order: 'best' } },
    { title: 'Clásicos de siempre', filters: { period: 'all', order: 'best' } },
    { title: 'Joyas indie', filters: { period: 'all', genre: 'indie', order: 'best' } },
  ],
  screen: [
    { title: 'Tendencias de la semana', load: trendingItems },
    { title: `Las mejores películas de ${year}`, filters: { kind: 'movie', period: 'year', order: 'best' } },
    { title: `Las mejores series de ${year}`, filters: { kind: 'tv', period: 'year', order: 'best' } },
    { title: 'Próximos estrenos', filters: { kind: 'movie', period: 'upcoming', order: 'popular' } },
    { title: 'Series para maratonear', filters: { kind: 'tv', period: 'all', order: 'best' } },
    { title: 'Clásicos del cine', filters: { kind: 'movie', period: 'all', order: 'best' } },
  ],
};

function Rail({ mode, keys, rail }: { mode: Mode; keys: Keys; rail: RailDef }) {
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = keyFor(mode, keys);
  const id = JSON.stringify(rail.filters ?? rail.title);
  useEffect(() => {
    const ctrl = new AbortController();
    setGames(null);
    setError(null);
    const run = rail.load
      ? rail.load(keys, ctrl.signal)
      : discoverItems(mode, keys, { ...DEFAULT_FILTERS, ...rail.filters }, 1, ctrl.signal).then((r) => r.games);
    run.then(setGames).catch((e: Error) => e.name !== 'AbortError' && setError(e.message));
    return () => ctrl.abort();
    // `keys` is rebuilt every render; `key` is the one this mode uses.
  }, [mode, key, id]);
  return (
    <GameRail title={rail.title} games={games} error={error} more={rail.filters ? exploreLink(rail.filters, mode) : undefined} />
  );
}

/** Favourite genres (weighted by how far above 60 each score is) and best-rated titles of this mode. */
function useTaste(mode: Mode) {
  const ratings = useStore((s) => s.ratings);
  const games = useStore((s) => s.games);
  const lists = useStore((s) => s.lists);
  return useMemo(() => {
    const liked = Object.values(ratings)
      .filter((r) => r.score >= 70 && games[r.gameId] && modeOf(r.gameId) === mode)
      .sort((a, b) => b.score - a.score);
    const weight = new Map<string, number>();
    for (const r of liked) for (const g of games[r.gameId].genres) weight.set(g, (weight.get(g) ?? 0) + r.score - 60);
    const genres = [...weight.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => g);
    const favourites = liked.slice(0, 3).map((r) => r.gameId);
    const because = (mode === 'screen' ? liked.slice(0, 2) : liked.filter((r) => games[r.gameId].genres.some((g) => genres.includes(g))).slice(0, 2)).map(
      (r) => games[r.gameId].name,
    );
    const known = new Set([...Object.keys(ratings), ...lists.filter((l) => listMode(l) === mode).flatMap((l) => l.gameIds)]);
    return { genres, favourites, because, known };
  }, [ratings, games, lists, mode]);
}

function ForYou({ mode, keys }: { mode: Mode; keys: Keys }) {
  const { genres, favourites, because, known } = useTaste(mode);
  const ratings = useStore((s) => s.ratings);
  const snapshots = useStore((s) => s.games);
  const [games, setGames] = useState<Game[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [likes, setLikes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const key = keyFor(mode, keys);
  // With RAWG, games get a real taste profile (tags, studios) from every rating.
  const personal = mode === 'games' && Boolean(keys.rawg);
  const tasteKey = personal
    ? Object.values(ratings)
        .filter((r) => r.gameId.startsWith('rawg:'))
        .map((r) => `${r.gameId}:${r.score}:${r.status}:${r.replay ?? ''}`)
        .sort()
        .join('|')
    : `${genres.join('|')}/${favourites.join('|')}`;

  useEffect(() => {
    if (!genres.length && !favourites.length) return;
    const ctrl = new AbortController();
    setGames(null);
    setError(null);
    setNotes({});
    const run = personal
      ? gameProfile(keys.rawg, Object.values(ratings), snapshots, ctrl.signal).then(async (profile) => {
          if (!profile) return recommendItems(mode, keys, { genres, favourites }, known, ctrl.signal);
          setLikes(profile.top);
          const r = await recommendFromProfile(keys.rawg, profile, known, ctrl.signal);
          setNotes(r.notes);
          return r.games;
        })
      : recommendItems(mode, keys, { genres, favourites }, known, ctrl.signal);
    run.then(setGames).catch((e: Error) => e.name !== 'AbortError' && setError(e.message));
    return () => ctrl.abort();
    // Recompute only when the taste changes, not on every list edit.
  }, [mode, key, tasteKey]);

  if (!genres.length && !favourites.length) {
    return (
      <div className="mx-5 mt-6 rounded-3xl border border-dashed border-line p-4 text-sm text-muted">
        Puntuá {mode === 'games' ? 'algunos juegos' : 'algunas series o películas'} con 70 o más y acá te vamos a recomendar{' '}
        {mode === 'games' ? 'otros parecidos' : 'otras parecidas'}.
      </div>
    );
  }
  const visible = games?.filter((g) => !known.has(g.id)) ?? null;
  return (
    <GameRail
      title="Para vos"
      subtitle={
        personal && likes.length
          ? `Te gusta: ${likes.join(', ')}`
          : because.length
            ? `Porque te gustó ${because.join(' y ')}`
            : undefined
      }
      games={visible}
      notes={notes}
      error={error}
    />
  );
}

export default function Discover() {
  const mode = useMode();
  const keys = useKeys();
  const key = keyFor(mode, keys);

  const genreChips =
    mode === 'games'
      ? GENRES.map((g) => ({ label: g.label, to: exploreLink({ period: 'all', genre: g.slug, order: 'best' }, mode) }))
      : SCREEN_GENRES.map((g) => ({ label: g.label, to: exploreLink({ kind: 'movie', period: 'all', genre: g.slug, order: 'best' }, mode) }));

  return (
    <div>
      <PageHeader
        title="Descubrir"
        subtitle={MODES[mode].label}
        action={
          <Link to={exploreLink({}, mode)} aria-label="Explorar con filtros" className="rounded-full bg-white p-2.5 text-black">
            <SlidersHorizontal size={20} />
          </Link>
        }
      />

      <ScrollRow className="flex gap-2 px-5">
        {genreChips.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="shrink-0 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium whitespace-nowrap hover:border-white/20"
          >
            {c.label}
          </Link>
        ))}
      </ScrollRow>
      {mode === 'screen' && (
        <ScrollRow className="mt-2 flex gap-2 px-5">
          {STREAMING.map((p) => (
            <Link
              key={p.id}
              to={exploreLink({ kind: 'tv', period: 'all', platform: p.id, order: 'popular' }, mode)}
              className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap text-accent"
            >
              {p.label}
            </Link>
          ))}
        </ScrollRow>
      )}

      <ForYou mode={mode} keys={keys} />
      {RAILS[mode].map((r) => (
        <Rail key={`${mode}-${r.title}`} mode={mode} keys={keys} rail={r} />
      ))}

      {!key && (
        <p className="mx-5 mt-8 text-center text-xs text-muted">
          Estás en modo demo. Cargá la key de {mode === 'games' ? 'RAWG' : 'TMDB'} en{' '}
          <Link to="/ajustes" className="text-accent">
            Ajustes
          </Link>{' '}
          para descubrir entre todos {mode === 'games' ? 'los juegos' : 'los títulos'}.
        </p>
      )}
    </div>
  );
}
