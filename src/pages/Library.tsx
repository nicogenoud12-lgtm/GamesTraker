import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, ChevronRight, LayoutGrid, Rows3, Share2 } from 'lucide-react';
import { KINDS } from '../lib/kinds';
import TierShareSheet from '../components/TierShareSheet';
import Cover from '../components/Cover';
import TierSection, { CoverScore } from '../components/TierSection';
import ScrollRow from '../components/ScrollRow';
import { ScoreRing } from '../components/Score';
import { TIERS, TIER_BY_ID, type Tier } from '../lib/tiers';
import type { Game, Rating, TierId } from '../lib/types';
import { useStore } from '../store/useStore';
import { useMode } from '../store/useUi';
import { MODES, kindOf, modeOf } from '../lib/mode';
import TierIcon from '../components/TierIcon';
import { useIsDesktop } from '../lib/useMedia';
import { useFitWidth } from '../lib/useFitWidth';

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
  const everything: Entry[] = Object.values(ratings)
    .filter((r) => games[r.gameId] && modeOf(r.gameId) === mode)
    .map((r) => ({ game: games[r.gameId], rating: r }));
  const kindFilter = mode === 'screen' ? (KINDS.find((k) => k.id === params.get('tipo')) ?? KINDS[0]) : KINDS[0];
  const all = kindFilter.kind ? everything.filter((e) => kindOf(e.game.id) === kindFilter.kind) : everything;
  const byScore = (a: Entry, b: Entry) => b.rating.score - a.rating.score || b.rating.updatedAt - a.rating.updatedAt;
  const [shareOpen, setShareOpen] = useState(false);
  const avg = all.length ? Math.round(all.reduce((n, e) => n + e.rating.score, 0) / all.length) : 0;

  return (
    <div>
      <header className="pt-safe px-5">
        <div className="flex flex-wrap items-end justify-between gap-3 pt-6 pb-4 lg:flex-nowrap lg:pt-10 lg:pb-6">
          <div>
            <p className="text-sm text-muted">Tu colección</p>
            <h1 className="font-display text-3xl font-bold tracking-tight lg:text-4xl">{copy.collection}</h1>
          </div>
          {mode === 'screen' && everything.length > 0 && (
            <div
              role="tablist"
              aria-label="Tipo"
              className="order-last grid w-full grid-cols-3 rounded-2xl border border-white/10 bg-black/30 p-1 lg:order-none lg:mx-auto lg:w-[420px]"
            >
              {KINDS.map(({ id, kind, label, icon: Icon }) => {
                const active = kindFilter.id === id;
                const n = kind ? everything.filter((e) => kindOf(e.game.id) === kind).length : everything.length;
                return (
                  <button
                    key={label}
                    role="tab"
                    aria-selected={active}
                    onClick={() => set({ tipo: id, tier: null })}
                    className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition ${active ? 'bg-accent text-black shadow-lg' : 'text-muted hover:text-white'}`}
                  >
                    <Icon size={16} strokeWidth={2.4} />
                    {label}
                    <span className={`text-xs tabular-nums ${active ? 'text-black/60' : 'text-muted/70'}`}>{n}</span>
                  </button>
                );
              })}
            </div>
          )}
          {all.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShareOpen(true)}
                aria-label="Compartir mi escala"
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-muted transition hover:border-white/20 hover:text-white"
              >
                <Share2 size={16} /> Compartir
              </button>
              <Link
                to="/diario"
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-muted transition hover:border-white/20 hover:text-white"
              >
                <BookOpen size={16} /> Diario
              </Link>
              <div className="flex rounded-full border border-line bg-surface p-1">
                <ViewButton active={view === 'escala'} label="Escala" onClick={() => set({ vista: null, tier: null })}>
                  <Rows3 size={18} />
                </ViewButton>
                <ViewButton active={view === 'grilla'} label="Grilla" onClick={() => set({ vista: 'grilla' })}>
                  <LayoutGrid size={18} />
                </ViewButton>
              </div>
            </div>
          )}
        </div>
      </header>

      {all.length === 0 && everything.length > 0 ? (
        <p className="mx-5 rounded-3xl border border-line bg-surface p-6 text-center text-muted">
          Todavía no puntuaste {kindFilter.kind === 'tv' ? 'ninguna serie' : 'ninguna película'}.
        </p>
      ) : all.length === 0 ? (
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
      <TierShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        mode={mode}
        kind={kindFilter.kind}
        entries={all.map((e) => ({ game: e.game, score: e.rating.score, tier: e.rating.tier }))}
      />
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
    <div className="space-y-2.5 px-5">
      {TIERS.slice()
        .reverse()
        .map((t) => (
          <TierRow key={t.id} tier={t} entries={entries.filter((e) => e.rating.tier === t.id)} onTier={onTier} />
        ))}
    </div>
  );
}

/** Side margin and gap of a tier row (`mx-4`, `gap-2`), in px. A margin, not padding, so the row clips right after the last whole cover. */
const ROW_MARGIN = 16;
const ROW_GAP = 8;

function TierRow({ tier, entries, onTier }: { tier: Tier; entries: Entry[]; onTier: (id: TierId) => void }) {
  // An empty tier renders no row, so measuring starts once it has something.
  const [ref, width] = useFitWidth({ min: useIsDesktop() ? 92 : 72, gap: ROW_GAP, inset: 2 * ROW_MARGIN, active: entries.length > 0 });
  return (
    <TierSection tier={tier} count={entries.length} onOpen={() => onTier(tier.id)}>
      <div ref={ref}>
        <ScrollRow wrapperClassName="min-w-0" className="mx-4 flex gap-2 pb-3">
          {entries.map(({ game, rating }) => (
            <Link
              key={game.id}
              to={`/juego/${encodeURIComponent(game.id)}`}
              className="relative w-[72px] shrink-0 lg:w-[92px]"
              style={width ? { width } : undefined}
              title={game.name}
            >
              <Cover game={game} className="aspect-[3/4] rounded-lg text-[9px]" />
              <CoverScore score={rating.score} color={tier.color} />
            </Link>
          ))}
        </ScrollRow>
      </div>
    </TierSection>
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
              <TierIcon tier={t.id} size={14} /> {t.label}
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
            <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold" style={{ color: t.color }}>
              <TierIcon tier={t.id} size={12} /> {t.label}
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
      className="flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition"
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
