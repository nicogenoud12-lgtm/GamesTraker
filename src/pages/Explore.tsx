import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import GameRow from '../components/GameRow';
import ScrollRow from '../components/ScrollRow';
import { useIsDesktop } from '../lib/useMedia';
import { discoverItems, keyFor, useKeys } from '../lib/catalog';
import {
  type DiscoverFilters,
  KINDS,
  ORDERS,
  PERIODS,
  filtersFromParams,
  filtersToParams,
  genreOptions,
  platformOptions,
} from '../lib/discover';
import { MODES } from '../lib/mode';
import type { Game } from '../lib/types';
import { useMode } from '../store/useUi';

export default function Explore() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const mode = useMode();
  const keys = useKeys();
  const key = keyFor(mode, keys);
  const filters = filtersFromParams(params, mode);
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
    discoverItems(mode, keys, filters, page, ctrl.signal)
      .then((r) => {
        setGames((prev) => (page === 1 ? r.games : [...prev, ...r.games.filter((g) => !prev.some((p) => p.id === g.id))]));
        setHasMore(r.hasMore);
      })
      .catch((e: Error) => e.name !== 'AbortError' && setError(e.message))
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
    // `filters` is rebuilt every render; `id` captures its contents.
  }, [mode, key, id, page]);

  const update = (patch: Partial<DiscoverFilters>) => {
    setPage(1);
    const next = { ...filters, ...patch };
    // A genre that doesn't exist for the new kind (e.g. "Terror" for series) is dropped.
    if (!genreOptions(mode, next.kind).some((g) => g.slug === next.genre)) next.genre = null;
    setParams(filtersToParams(next, mode), { replace: true });
  };

  return (
    <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8 lg:pt-8">
      <header className="pt-safe sticky top-0 z-30 bg-bg/90 backdrop-blur-xl lg:top-6 lg:self-start lg:bg-transparent lg:pt-0 lg:backdrop-blur-none">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2 lg:pt-0 lg:pb-4">
          <button onClick={() => navigate(-1)} aria-label="Volver" className="rounded-full bg-white/5 p-2.5">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-display text-2xl font-bold tracking-tight">Explorar</h1>
        </div>
        <div className="space-y-2 pb-3 lg:space-y-5">
          <ChipRow label="Período">
            {PERIODS.map((p) => (
              <Chip key={p.id} active={filters.period === p.id} onClick={() => update({ period: p.id })}>
                {p.label}
              </Chip>
            ))}
          </ChipRow>
          {mode === 'screen' && (
            <ChipRow label="Tipo">
              {KINDS.map((k) => (
                <Chip key={k.id} active={filters.kind === k.id} onClick={() => update({ kind: k.id })}>
                  {k.label}
                </Chip>
              ))}
            </ChipRow>
          )}
          <ChipRow label="Género">
            <Chip active={!filters.genre} onClick={() => update({ genre: null })}>
              Todos
            </Chip>
            {genreOptions(mode, filters.kind).map((g) => (
              <Chip key={g.slug} active={filters.genre === g.slug} onClick={() => update({ genre: g.slug })}>
                {g.label}
              </Chip>
            ))}
          </ChipRow>
          <ChipRow label={mode === 'games' ? 'Plataforma' : 'Dónde ver'}>
            <Chip active={!filters.platform} onClick={() => update({ platform: null })}>
              Todas
            </Chip>
            {platformOptions(mode).map((p) => (
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

      <div className="px-5 lg:px-0">
        {error && <p className="mt-6 text-center text-sm text-rose-400">{error}</p>}
        {!loading && !error && games.length === 0 && (
          <p className="mt-10 text-center text-muted">No hay {MODES[mode].items} con estos filtros.</p>
        )}
        <ul className="divide-y divide-white/5 xl:grid xl:grid-cols-2 xl:gap-x-8 xl:divide-y-0">
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

/** A scrolling row on phones; a wrapped block with its label on top on desktop. */
function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return (
      <div className="px-4">
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
        <div className="flex flex-wrap gap-1.5">{children}</div>
      </div>
    );
  }
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
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${active ? 'border-accent bg-accent/20 text-accent' : 'border-line text-muted hover:border-white/20 hover:text-white'}`}
    >
      {children}
    </button>
  );
}
