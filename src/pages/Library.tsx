import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Cover from '../components/Cover';
import PageHeader from '../components/PageHeader';
import { ScoreBadge } from '../components/Score';
import { TIERS, TIER_BY_ID } from '../lib/tiers';
import type { TierId } from '../lib/types';
import { useStore } from '../store/useStore';

type Sort = 'score' | 'recent' | 'name';

const SORTS: { id: Sort; label: string }[] = [
  { id: 'score', label: 'Puntaje' },
  { id: 'recent', label: 'Recientes' },
  { id: 'name', label: 'A–Z' },
];

export default function Library() {
  const [params, setParams] = useSearchParams();
  const games = useStore((s) => s.games);
  const ratings = useStore((s) => s.ratings);
  const sort = (params.get('orden') as Sort) || 'score';
  const tier = params.get('tier') as TierId | null;

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const all = Object.values(ratings).filter((r) => games[r.gameId]);
  const rows = all
    .filter((r) => !tier || r.tier === tier)
    .sort((a, b) => {
      if (sort === 'score') return b.score - a.score || b.updatedAt - a.updatedAt;
      if (sort === 'recent') return (b.finishedAt ?? '').localeCompare(a.finishedAt ?? '') || b.updatedAt - a.updatedAt;
      return games[a.gameId].name.localeCompare(games[b.gameId].name);
    });

  return (
    <div>
      <PageHeader title="Mis juegos" subtitle={`${all.length} puntuados`} />

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-3">
        <Chip active={!tier} onClick={() => set('tier', null)}>
          Todos
        </Chip>
        {TIERS.slice()
          .reverse()
          .map((t) => (
            <Chip key={t.id} active={tier === t.id} color={t.color} onClick={() => set('tier', tier === t.id ? null : t.id)}>
              {t.emoji} {t.label}
            </Chip>
          ))}
      </div>

      <div className="flex items-center gap-1 px-5 pb-4 text-sm">
        <span className="mr-1 text-muted">Ordenar:</span>
        {SORTS.map((s) => (
          <button
            key={s.id}
            onClick={() => set('orden', s.id)}
            className={`rounded-full px-3 py-1 ${sort === s.id ? 'bg-white/10 font-semibold text-white' : 'text-muted'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="mt-8 px-5 text-center text-muted">
          {all.length === 0 ? (
            <>
              <p>Todavía no puntuaste ningún juego.</p>
              <Link to="/buscar" className="mt-3 inline-block font-semibold text-accent">
                Buscar un juego
              </Link>
            </>
          ) : (
            <p>No hay juegos “{tier && TIER_BY_ID[tier].label}”.</p>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-5 px-5">
          {rows.map((r, i) => {
            const g = games[r.gameId];
            return (
              <li key={r.gameId}>
                <Link to={`/juego/${encodeURIComponent(g.id)}`} className="block">
                  <div className="relative">
                    <Cover game={g} className="aspect-[3/4] rounded-xl text-xs" />
                    <span className="absolute top-1.5 right-1.5 rounded-lg bg-black/75 backdrop-blur">
                      <ScoreBadge score={r.score} />
                    </span>
                    {sort === 'score' && !tier && i < 3 && (
                      <span className="absolute top-1.5 left-1.5 rounded-md bg-black/70 px-1.5 text-xs font-bold backdrop-blur">
                        #{i + 1}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-sm font-medium">{g.name}</p>
                  <p className="text-xs" style={{ color: TIER_BY_ID[r.tier].color }}>
                    {TIER_BY_ID[r.tier].label}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition"
      style={{
        borderColor: active ? (color ?? '#fff') : 'var(--color-line)',
        background: active ? `${color ?? '#ffffff'}22` : 'transparent',
        color: active ? (color ?? '#fff') : 'var(--color-muted)',
      }}
    >
      {children}
    </button>
  );
}
