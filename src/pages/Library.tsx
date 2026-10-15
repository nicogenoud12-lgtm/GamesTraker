import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, LayoutGrid, Rows3 } from 'lucide-react';
import Cover from '../components/Cover';
import ScrollRow from '../components/ScrollRow';
import { ScoreRing } from '../components/Score';
import { TIERS, TIER_BY_ID, type Tier } from '../lib/tiers';
import type { Game, Rating, TierId } from '../lib/types';
import { useStore } from '../store/useStore';
import { useMode } from '../store/useUi';
import { MODES, modeOf } from '../lib/mode';

type Sort = 'score' | 'recent' | 'name';
type View = 'escala' | 'grilla';

const SORTS: { id: Sort; label: string }[] = [
  { id: 'score', label: 'Puntaje' },
  { id: 'recent', label: 'Recientes' },
  { id: 'name', label: 'A–Z' },
];

const MEDALS = ['#facc15', '#d4d4d8', '#d97706'];

interface Entry {
  game: Game;
  rating: Rating;
}

export default function Library() {
  const [params, setParams] = useSearchParams();
  const games = useStore((s) => s.games);
  const ratings = useStore((s) => s.ratings);
  const view: View = params.get('vista') === 'grilla' || params.get('tier') ? 'grilla' : 'escala';
  const sort = (params.get('orden') as Sort) || 'score';
  const tier = params.get('tier') as TierId | null;

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const mode = useMode();
  const copy = MODES[mode];
  const all: Entry[] = Object.values(ratings)
    .filter((r) => games[r.gameId] && modeOf(r.gameId) === mode)
    .map((r) => ({ game: games[r.gameId], rating: r }));
  const byScore = (a: Entry, b: Entry) => b.rating.score - a.rating.score || b.rating.updatedAt - a.rating.updatedAt;
  const avg = all.length ? Math.round(all.reduce((n, e) => n + e.rating.score, 0) / all.length) : 0;

  return (
    <div>
      <header className="pt-safe px-5">
        <div className="flex items-end justify-between gap-3 pt-6 pb-4 lg:pt-10 lg:pb-6">
          <div>
            <p className="text-sm text-muted">Tu colección</p>
            <h1 className="font-display text-3xl font-bold tracking-tight lg:text-4xl">{copy.collection}</h1>
          </div>
          {all.length > 0 && (
            <div className="flex rounded-full border border-line bg-surface p-1">
              <ViewButton active={view === 'escala'} label="Escala" onClick={() => set({ vista: null, tier: null })}>
                <Rows3 size={18} />
              </ViewButton>
              <ViewButton active={view === 'grilla'} label="Grilla" onClick={() => set({ vista: 'grilla' })}>
                <LayoutGrid size={18} />
              </ViewButton>
            </div>
          )}
        </div>
      </header>

      {all.length === 0 ? (
        <div className="mx-5 rounded-3xl border border-line bg-surface p-6 text-center">
          <p className="text-4xl">🕹️</p>
          <p className="mt-3 font-display text-lg font-bold">Todavía no puntuaste nada</p>
          <p className="mt-1 text-sm text-muted">Tus {mode === 'games' ? 'juegos' : 'series y pelis'} van a aparecer acá, ordenados por tu escala.</p>
          <Link to="/buscar" className="mt-4 inline-block rounded-full bg-white px-5 py-2.5 font-semibold text-black">
            {mode === 'games' ? 'Buscar un juego' : 'Buscar una serie o peli'}
          </Link>
        </div>
      ) : (
        <>
          <Summary entries={all} avg={avg} />
          {view === 'escala' ? (
            <TierList entries={all.slice().sort(byScore)} onTier={(id) => set({ vista: 'grilla', tier: id })} />
          ) : (
            <Grid entries={all} sort={sort} tier={tier} byScore={byScore} set={set} />
          )}
        </>
      )}
    </div>
  );
}

function ViewButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 transition ${active ? 'bg-white text-black' : 'text-muted'}`}
    >
      {children}
    </button>
  );
}

function Summary({ entries, avg }: { entries: Entry[]; avg: number }) {
  const best = entries.reduce((a, b) => (b.rating.score > a.rating.score ? b : a));
  return (
    <div className="mx-5 mb-5 flex items-center gap-4 rounded-3xl border border-line bg-surface p-4">
      <ScoreRing score={avg} size={64} stroke={6} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">Promedio de {entries.length}</p>
        <p className="mt-1 truncate text-sm">
          Tu favorito: <span className="font-semibold">{best.game.name}</span>
        </p>
        <Link to="/estadisticas" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-accent">
          Ver estadísticas por año <ChevronRight size={14} />
        </Link>
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-white/5">
          {TIERS.map((t) => {
            const n = entries.filter((e) => e.rating.tier === t.id).length;
            return n ? <div key={t.id} style={{ width: `${(n / entries.length) * 100}%`, background: t.color }} /> : null;
          })}
        </div>
      </div>
    </div>
  );
}

/** Classic tier-list layout: one coloured row per word rating, best at the top. */
function TierList({ entries, onTier }: { entries: Entry[]; onTier: (id: TierId) => void }) {
  return (
    <div className="space-y-2 px-5">
      {TIERS.slice()
        .reverse()
        .map((t) => (
          <TierRow key={t.id} tier={t} entries={entries.filter((e) => e.rating.tier === t.id)} onTier={onTier} />
        ))}
    </div>
  );
}

function TierRow({ tier, entries, onTier }: { tier: Tier; entries: Entry[]; onTier: (id: TierId) => void }) {
  const empty = entries.length === 0;
  return (
    <div
      className={`flex min-h-[104px] overflow-hidden rounded-2xl border bg-surface ${empty ? 'opacity-50' : ''}`}
      style={{ borderColor: `${tier.color}40` }}
    >
      <button
        onClick={() => !empty && onTier(tier.id)}
        disabled={empty}
        className="flex w-[78px] shrink-0 flex-col items-center justify-center gap-0.5 text-black lg:w-[120px]"
        style={{ background: `linear-gradient(160deg, ${tier.color}, ${tier.color}cc)` }}
      >
        <span className="text-2xl leading-none">{tier.emoji}</span>
        <span className="font-display text-[13px] leading-tight font-bold">{tier.label}</span>
        <span className="mt-1 rounded-full bg-black/15 px-2 py-0.5 font-display text-xs leading-none font-bold tabular-nums">{entries.length}</span>
      </button>
      {empty ? (
        <div className="flex flex-1 items-center px-4 text-sm text-muted">Nada todavía</div>
      ) : (
        <ScrollRow wrapperClassName="flex min-w-0 flex-1 items-center" className="flex w-full items-center gap-2 p-2">
          {entries.map(({ game, rating }) => (
            <Link key={game.id} to={`/juego/${encodeURIComponent(game.id)}`} className="relative w-[66px] shrink-0 lg:w-[88px]" title={game.name}>
              <Cover game={game} className="aspect-[3/4] rounded-lg text-[9px]" />
              <span
                className="absolute right-1 bottom-1 rounded-md bg-black/80 px-1 font-display text-[11px] font-bold tabular-nums backdrop-blur"
                style={{ color: tier.color }}
              >
                {rating.score}
              </span>
            </Link>
          ))}
        </ScrollRow>
      )}
    </div>
  );
}

interface GridProps {
  entries: Entry[];
  sort: Sort;
  tier: TierId | null;
  byScore: (a: Entry, b: Entry) => number;
  set: (patch: Record<string, string | null>) => void;
}

function Grid({ entries, sort, tier, byScore, set }: GridProps) {
  const rows = entries
    .filter((e) => !tier || e.rating.tier === tier)
    .sort((a, b) => {
      if (sort === 'score') return byScore(a, b);
      if (sort === 'recent')
        return (b.rating.finishedAt ?? '').localeCompare(a.rating.finishedAt ?? '') || b.rating.updatedAt - a.rating.updatedAt;
      return a.game.name.localeCompare(b.game.name);
    });

  return (
    <>
      <ScrollRow className="flex gap-2 px-5 pb-3">
        <Chip active={!tier} onClick={() => set({ tier: null })}>
          Todos
        </Chip>
        {TIERS.slice()
          .reverse()
          .map((t) => (
            <Chip key={t.id} active={tier === t.id} color={t.color} onClick={() => set({ tier: tier === t.id ? null : t.id })}>
              {t.emoji} {t.label}
            </Chip>
          ))}
      </ScrollRow>

      <div className="flex items-center gap-1 px-5 pb-4 text-sm">
        <span className="mr-1 text-muted">Ordenar:</span>
        {SORTS.map((s) => (
          <button
            key={s.id}
            onClick={() => set({ orden: s.id })}
            className={`rounded-full px-3 py-1 ${sort === s.id ? 'bg-white/10 font-semibold text-white' : 'text-muted'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 px-5 text-center text-muted">No hay juegos “{tier && TIER_BY_ID[tier].label}”.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 px-5 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {rows.map((e, i) => (
            <li key={e.game.id}>
              <Poster entry={e} rank={sort === 'score' && !tier && i < 3 ? i : null} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Poster({ entry: { game, rating }, rank }: { entry: Entry; rank: number | null }) {
  const t = TIER_BY_ID[rating.tier];
  return (
    <Link
      to={`/juego/${encodeURIComponent(game.id)}`}
      className="group relative block aspect-[3/4] overflow-hidden rounded-2xl transition active:scale-[.98]"
      style={{ boxShadow: `0 0 0 1px ${t.color}55, 0 14px 30px -14px ${t.color}aa` }}
    >
      <Cover game={game} size={640} showTitle={false} className="absolute inset-0 transition duration-500 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      {rank != null && (
        <span
          className="absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-full font-display text-sm font-bold text-black shadow-lg"
          style={{ background: MEDALS[rank] }}
        >
          {rank + 1}
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm leading-tight font-semibold">{game.name}</p>
            <p className="mt-1 text-[11px] font-semibold" style={{ color: t.color }}>
              {t.emoji} {t.label}
            </p>
          </div>
          <span
            className="font-display text-3xl leading-none font-bold tabular-nums"
            style={{ color: t.color, textShadow: `0 0 18px ${t.color}88` }}
          >
            {rating.score}
          </span>
        </div>
      </div>
    </Link>
  );
}

function Chip({ active, color, onClick, children }: { active: boolean; color?: string; onClick: () => void; children: ReactNode }) {
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
