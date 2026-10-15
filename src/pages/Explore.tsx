import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import GameRow from '../components/GameRow';
import ScrollRow from '../components/ScrollRow';
import { discoverGames, effectiveKey } from '../lib/catalog';
import { type DiscoverFilters, GENRES, ORDERS, PERIODS, PLATFORMS, filtersFromParams, filtersToParams } from '../lib/discover';
import type { Game } from '../lib/types';
import { useStore } from '../store/useStore';

export default function Explore() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params);
  const key = effectiveKey(useStore((s) => s.apiKey));
  const [games, setGames] = useState<Game[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const id = JSON.stringify(filters);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    if (page === 1) setGames([]);
    discoverGames(key, filters, page, ctrl.signal)
      .then((r) => {
        setGames((prev) => (page === 1 ? r.games : [...prev, ...r.games.filter((g) => !prev.some((p) => p.id === g.id))]));
        setHasMore(r.hasMore);
      })
      .catch((e: Error) => e.name !== 'AbortError' && setError(e.message))
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
    // `filters` is rebuilt every render; `id` captures its contents.
  }, [key, id, page]);

  const update = (patch: Partial<DiscoverFilters>) => {
    setPage(1);
    setParams(filtersToParams({ ...filters, ...patch }), { replace: true });
  };

  return (
    <div>
      <header className="pt-safe sticky top-0 z-30 bg-bg/90 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <button onClick={() => navigate(-1)} aria-label="Volver" className="rounded-full bg-white/5 p-2.5">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-display text-2xl font-bold tracking-tight">Explorar</h1>
        </div>
        <div className="space-y-2 pb-3">
          <ChipRow label="Período">
            {PERIODS.map((p) => (
              <Chip key={p.id} active={filters.period === p.id} onClick={() => update({ period: p.id })}>
                {p.label}
              </Chip>
            ))}
          </ChipRow>
          <ChipRow label="Género">
            <Chip active={!filters.genre} onClick={() => update({ genre: null })}>
              Todos
            </Chip>
            {GENRES.map((g) => (
              <Chip key={g.slug} active={filters.genre === g.slug} onClick={() => update({ genre: g.slug })}>
                {g.label}
              </Chip>
            ))}
          </ChipRow>
          <ChipRow label="Plataforma">
            <Chip active={!filters.platform} onClick={() => update({ platform: null })}>
              Todas
            </Chip>
            {PLATFORMS.map((p) => (
              <Chip key={p.id} active={filters.platform === p.id} onClick={() => update({ platform: p.id })}>
                {p.label}
              </Chip>
            ))}
          </ChipRow>
          <ChipRow label="Orden">
            {ORDERS.map((o) => (
              <Chip key={o.id} active={filters.order === o.id} onClick={() => update({ order: o.id })}>
                {o.label}
              </Chip>
            ))}
          </ChipRow>
        </div>
      </header>

      <div className="px-5">
        {error && <p className="mt-6 text-center text-sm text-rose-400">{error}</p>}
        {!loading && !error && games.length === 0 && (
          <p className="mt-10 text-center text-muted">No hay juegos con estos filtros.</p>
        )}
        <ul className="divide-y divide-white/5">
          {games.map((g, i) => (
            <GameRow key={g.id} game={g} rank={filters.order === 'best' ? i + 1 : undefined} />
          ))}
        </ul>
        {loading && (
          <div className="flex justify-center py-6 text-muted">
            <Loader2 className="animate-spin" />
          </div>
        )}
        {!loading && hasMore && (
          <button
            onClick={() => setPage((p) => p + 1)}
            className="my-4 w-full rounded-2xl border border-line bg-surface py-3.5 text-sm font-semibold"
          >
            Cargar más
          </button>
        )}
      </div>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ScrollRow className="flex items-center gap-2 px-5">
      <span className="w-20 shrink-0 text-xs font-semibold tracking-wide text-muted uppercase">{label}</span>
      {children}
    </ScrollRow>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${active ? 'border-accent bg-accent/20 text-accent' : 'border-line text-muted'}`}
    >
      {children}
    </button>
  );
}
