import { Link } from 'react-router-dom';
import { ChevronRight, Cloud, CloudOff, Compass, Play, RefreshCw, Search, Settings } from 'lucide-react';
import { useSync } from '../store/useSync';
import Aurora from '../components/reactbits/Aurora';
import CountUp from '../components/reactbits/CountUp';
import Cover from '../components/Cover';
import ScrollRow from '../components/ScrollRow';
import { ScoreBadge, TierChip } from '../components/Score';
import { TIERS } from '../lib/tiers';
import { year } from '../lib/format';
import { NEXT_LIST_ID, PLAYING_LIST_ID, useStore } from '../store/useStore';
import { useToast } from '../store/useToast';

export default function Home() {
  const games = useStore((s) => s.games);
  const ratings = useStore((s) => s.ratings);
  const lists = useStore((s) => s.lists);
  const addToList = useStore((s) => s.addToList);
  const removeFromList = useStore((s) => s.removeFromList);
  const toast = useToast((s) => s.show);

  const rated = Object.values(ratings).sort((a, b) => b.updatedAt - a.updatedAt);
  const avg = rated.length ? Math.round(rated.reduce((n, r) => n + r.score, 0) / rated.length) : 0;
  const legendary = rated.filter((r) => r.tier === 'historico').length;
  const playing = (lists.find((l) => l.id === PLAYING_LIST_ID)?.gameIds ?? []).map((id) => games[id]).filter(Boolean);
  const nextIds = lists.find((l) => l.id === NEXT_LIST_ID)?.gameIds ?? [];
  const next = nextIds.map((id) => games[id]).filter(Boolean);
  const upNext = next[0];

  const startPlaying = () => {
    if (!upNext) return;
    addToList(PLAYING_LIST_ID, upNext);
    removeFromList(NEXT_LIST_ID, upNext.id);
    toast(`¡A jugar ${upNext.name}!`);
  };

  const counts = TIERS.map((t) => ({ tier: t, n: rated.filter((r) => r.tier === t.id).length }));

  return (
    <div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent)]">
          <Aurora colorStops={['#7c3aed', '#f472b6', '#22d3ee']} amplitude={1.1} blend={0.6} speed={0.6} mouseInteraction={false} />
        </div>
        <header className="pt-safe relative px-5">
          <div className="flex items-center justify-between pt-6">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Games<span className="grad-text">Traker</span>
            </h1>
            <div className="flex items-center gap-2">
              <SyncBadge />
              <Link to="/ajustes" aria-label="Ajustes" className="rounded-full bg-white/10 p-2.5 backdrop-blur">
                <Settings size={18} />
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2">
            <Stat label="Jugados" value={rated.length} />
            <Stat label="Promedio" value={avg} />
            <Stat label="Históricos" value={legendary} />
          </div>
        </header>
      </div>

      {rated.length === 0 && next.length === 0 && playing.length === 0 && (
        <section className="mx-5 mt-6 rounded-3xl border border-line bg-surface p-6 text-center">
          <p className="text-4xl">🎮</p>
          <h2 className="mt-3 font-display text-xl font-bold">Empezá tu colección</h2>
          <p className="mt-1 text-sm text-muted">Buscá un juego que hayas jugado para puntuarlo, o agregalo a tu lista de próximos.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to="/buscar" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-black">
              <Search size={18} /> Buscar juegos
            </Link>
            <Link to="/descubrir" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 font-semibold">
              <Compass size={18} /> Descubrir
            </Link>
          </div>
        </section>
      )}

      {playing.length > 0 && (
        <section className="mt-7">
          <SectionTitle title="Jugando ahora" to={`/listas/${PLAYING_LIST_ID}`} />
          <ScrollRow className="flex gap-3 px-5 pb-1">
            {playing.map((g) => (
              <Link key={g.id} to={`/juego/${encodeURIComponent(g.id)}`} className="w-28 shrink-0">
                <Cover game={g} className="aspect-[3/4] rounded-2xl text-sm" />
                <p className="mt-1.5 truncate text-sm font-medium">{g.name}</p>
              </Link>
            ))}
          </ScrollRow>
        </section>
      )}

      {upNext && (
        <section className="mt-7 px-5">
          <SectionTitle title="Lo próximo" to={`/listas/${NEXT_LIST_ID}`} flush />
          <div className="relative overflow-hidden rounded-3xl border border-line bg-surface">
            <Cover game={upNext} size={640} showTitle={false} className="absolute inset-0 scale-110 opacity-40 blur-2xl" />
            <div className="relative flex gap-4 p-4">
              <Link to={`/juego/${encodeURIComponent(upNext.id)}`}>
                <Cover game={upNext} className="aspect-[3/4] w-24 rounded-xl text-xs shadow-xl" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs font-semibold tracking-wider text-accent uppercase">#1 en tu lista</span>
                <h3 className="mt-1 line-clamp-2 font-display text-lg leading-tight font-bold">{upNext.name}</h3>
                <p className="text-sm text-muted">{[year(upNext.released), upNext.genres[0]].filter(Boolean).join(' · ')}</p>
                <button
                  onClick={startPlaying}
                  className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black active:scale-95"
                >
                  <Play size={14} fill="currentColor" /> Empezar a jugar
                </button>
              </div>
            </div>
            {next.length > 1 && (
              <div className="relative flex items-center gap-2 border-t border-white/5 px-4 py-3 text-sm text-muted">
                <span>Después:</span>
                <span className="truncate text-white/80">{next.slice(1, 3).map((g) => g.name).join(', ')}</span>
                {next.length > 3 && <span className="shrink-0">+{next.length - 3}</span>}
              </div>
            )}
          </div>
        </section>
      )}

      {rated.length > 0 && (
        <section className="mt-7 px-5">
          <SectionTitle title="Tu escala" flush />
          <div className="rounded-3xl border border-line bg-surface p-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
              {counts.map(({ tier, n }) =>
                n ? <div key={tier.id} style={{ width: `${(n / rated.length) * 100}%`, background: tier.color }} /> : null,
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-y-2 text-sm">
              {counts.map(({ tier, n }) => (
                <Link key={tier.id} to={`/mis-juegos?tier=${tier.id}`} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: tier.color }} />
                  <span className="text-muted">{tier.label}</span>
                  <span className="font-semibold tabular-nums">{n}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {rated.length > 0 && (
        <section className="mt-7">
          <SectionTitle title="Últimos puntuados" to="/mis-juegos" />
          <ul className="px-5">
            {rated.slice(0, 5).map((r) => {
              const g = games[r.gameId];
              if (!g) return null;
              return (
                <li key={r.gameId}>
                  <Link to={`/juego/${encodeURIComponent(g.id)}`} className="flex items-center gap-3 py-2">
                    <Cover game={g} showTitle={false} className="h-16 w-12 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{g.name}</p>
                      <div className="mt-1">
                        <TierChip tier={r.tier} size="sm" />
                      </div>
                    </div>
                    <ScoreBadge score={r.score} className="text-base" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3 backdrop-blur-md">
      <div className="font-display text-3xl font-bold tabular-nums">
        <CountUp to={value} duration={1.2} trigger="load" />
      </div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function SectionTitle({ title, to, flush }: { title: string; to?: string; flush?: boolean }) {
  return (
    <div className={`mb-3 flex items-center justify-between ${flush ? '' : 'px-5'}`}>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {to && (
        <Link to={to} className="flex items-center text-sm text-muted">
          Ver todo <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}

function SyncBadge() {
  const status = useSync((s) => s.status);
  if (status === 'off') return null;
  const label = status === 'error' ? 'Error al sincronizar' : status === 'syncing' ? 'Sincronizando' : 'Sincronizado';
  return (
    <Link
      to="/ajustes"
      aria-label={label}
      title={label}
      className={`rounded-full bg-white/10 p-2.5 backdrop-blur ${status === 'error' ? 'text-rose-400' : 'text-emerald-300'}`}
    >
      {status === 'error' ? <CloudOff size={18} /> : status === 'syncing' ? <RefreshCw size={18} className="animate-spin" /> : <Cloud size={18} />}
    </Link>
  );
}
