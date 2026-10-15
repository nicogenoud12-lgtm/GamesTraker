import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import GameRail from '../components/GameRail';
import PageHeader from '../components/PageHeader';
import { discoverGames, effectiveKey, recommendGames } from '../lib/catalog';
import { type DiscoverFilters, DEFAULT_FILTERS, GENRES, exploreLink } from '../lib/discover';
import type { Game } from '../lib/types';
import { useStore } from '../store/useStore';

const year = new Date().getFullYear();

const RAILS: { title: string; filters: Partial<DiscoverFilters> }[] = [
  { title: `Lo mejor de ${year}`, filters: { period: 'year', order: 'best' } },
  { title: 'Recién salidos', filters: { period: 'recent', order: 'popular' } },
  { title: 'Se vienen', filters: { period: 'upcoming', order: 'popular' } },
  { title: 'Lo mejor de la década', filters: { period: 'decade', order: 'best' } },
  { title: 'Clásicos de siempre', filters: { period: 'all', order: 'best' } },
  { title: 'Joyas indie', filters: { period: 'all', genre: 'indie', order: 'best' } },
];

function useRail(key: string, filters: Partial<DiscoverFilters>) {
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = JSON.stringify(filters);
  useEffect(() => {
    const ctrl = new AbortController();
    setGames(null);
    setError(null);
    discoverGames(key, { ...DEFAULT_FILTERS, ...filters }, 1, ctrl.signal)
      .then((r) => setGames(r.games))
      .catch((e: Error) => e.name !== 'AbortError' && setError(e.message));
    return () => ctrl.abort();
  }, [key, id]);
  return { games, error };
}

function Rail({ apiKey, title, filters }: { apiKey: string; title: string; filters: Partial<DiscoverFilters> }) {
  const { games, error } = useRail(apiKey, filters);
  return <GameRail title={title} games={games} error={error} more={exploreLink(filters)} />;
}

/** Genres the user rates highest, weighted by how far above 60 each score is. */
function useTaste() {
  const ratings = useStore((s) => s.ratings);
  const games = useStore((s) => s.games);
  const lists = useStore((s) => s.lists);
  return useMemo(() => {
    const liked = Object.values(ratings)
      .filter((r) => r.score >= 70 && games[r.gameId])
      .sort((a, b) => b.score - a.score);
    const weight = new Map<string, number>();
    for (const r of liked) for (const g of games[r.gameId].genres) weight.set(g, (weight.get(g) ?? 0) + r.score - 60);
    const genres = [...weight.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => g);
    const because = liked
      .filter((r) => games[r.gameId].genres.some((g) => genres.includes(g)))
      .slice(0, 2)
      .map((r) => games[r.gameId].name);
    const known = new Set([...Object.keys(ratings), ...lists.flatMap((l) => l.gameIds)]);
    return { genres, because, known };
  }, [ratings, games, lists]);
}

function ForYou({ apiKey }: { apiKey: string }) {
  const { genres, because, known } = useTaste();
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const genresKey = genres.join('|');

  useEffect(() => {
    if (!genres.length) return;
    const ctrl = new AbortController();
    setGames(null);
    setError(null);
    recommendGames(apiKey, genres, known, ctrl.signal)
      .then(setGames)
      .catch((e: Error) => e.name !== 'AbortError' && setError(e.message));
    return () => ctrl.abort();
    // Recompute only when the taste changes, not on every list edit.
  }, [apiKey, genresKey]);

  if (!genres.length) {
    return (
      <div className="mx-5 mt-2 rounded-3xl border border-dashed border-line p-4 text-sm text-muted">
        Puntuá algunos juegos con 70 o más y acá te vamos a recomendar otros parecidos.
      </div>
    );
  }
  const visible = games?.filter((g) => !known.has(g.id)) ?? null;
  return (
    <GameRail
      title="Para vos"
      subtitle={because.length ? `Porque te gustó ${because.join(' y ')}` : undefined}
      games={visible}
      error={error}
    />
  );
}

export default function Discover() {
  const key = effectiveKey(useStore((s) => s.apiKey));

  return (
    <div>
      <PageHeader
        title="Descubrir"
        action={
          <Link to={exploreLink({})} aria-label="Explorar con filtros" className="rounded-full bg-white p-2.5 text-black">
            <SlidersHorizontal size={20} />
          </Link>
        }
      />

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5">
        {GENRES.map((g) => (
          <Link
            key={g.slug}
            to={exploreLink({ period: 'all', genre: g.slug, order: 'best' })}
            className="shrink-0 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium whitespace-nowrap"
          >
            {g.label}
          </Link>
        ))}
      </div>

      <ForYou apiKey={key} />
      {RAILS.map((r) => (
        <Rail key={r.title} apiKey={key} title={r.title} filters={r.filters} />
      ))}

      {!key && (
        <p className="mx-5 mt-8 text-center text-xs text-muted">
          Estás en modo demo. Cargá la API key de RAWG en{' '}
          <Link to="/ajustes" className="text-accent">
            Ajustes
          </Link>{' '}
          para descubrir entre todos los juegos.
        </p>
      )}
    </div>
  );
}
