import { Link } from 'react-router-dom';
import { ChevronRight, Cloud, CloudOff, Compass, Play, RefreshCw, Search, Settings } from 'lucide-react';
import { useSync } from '../store/useSync';
import LoginInvite from '../components/LoginInvite';
import Aurora from '../components/reactbits/Aurora';
import CountUp from '../components/reactbits/CountUp';
import Cover from '../components/Cover';
import ScrollRow from '../components/ScrollRow';
import { ScoreBadge, TierChip } from '../components/Score';
import { TIERS } from '../lib/tiers';
import { year } from '../lib/format';
import { NEXT_LIST_ID, PLAYING_LIST_ID, useStore } from '../store/useStore';
import { useToast } from '../store/useToast';
import { useIsDesktop } from '../lib/useMedia';
import type { Game, Rating } from '../lib/types';
import type { Tier } from '../lib/tiers';
import { TIER_BY_ID } from '../lib/tiers';

export default function Home() {
  const games = useStore((s) => s.games);
  const ratings = useStore((s) => s.ratings);
  const lists = useStore((s) => s.lists);
  const addToList = useStore((s) => s.addToList);
  const removeFromList = useStore((s) => s.removeFromList);
  const toast = useToast((s) => s.show);
  const isDesktop = useIsDesktop();

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

  if (isDesktop) {
    return (
      <HomeDesktop
        {...{ games, rated, avg, legendary, playing, next, upNext, counts }}
        onStart={startPlaying}
      />
    );
  }

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

      <LoginInvite className="mx-5 mt-5" />

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
          <SectionTitle title="Tu escala" to="/estadisticas" more="Estadísticas" flush />
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

function SectionTitle({ title, to, more = 'Ver todo', flush }: { title: string; to?: string; more?: string; flush?: boolean }) {
  return (
    <div className={`mb-3 flex items-center justify-between ${flush ? '' : 'px-5'}`}>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {to && (
        <Link to={to} className="flex items-center text-sm text-muted">
          {more} <ChevronRight size={16} />
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

function greeting(): string {
  const h = new Date().getHours();
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}

interface DesktopProps {
  games: Record<string, Game>;
  rated: Rating[];
  avg: number;
  legendary: number;
  playing: Game[];
  next: Game[];
  upNext: Game | undefined;
  counts: { tier: Tier; n: number }[];
  onStart: () => void;
}

/** Wide dashboard for the browser: hero for the next game, posters and a side column. */
function HomeDesktop({ games, rated, avg, legendary, playing, next, upNext, counts, onStart }: DesktopProps) {
  const empty = rated.length === 0 && next.length === 0 && playing.length === 0;
  const recent = rated.filter((r) => games[r.gameId]).slice(0, 8);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -top-0 -right-6 -left-6 h-64 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]">
        <Aurora colorStops={['#7c3aed', '#f472b6', '#22d3ee']} amplitude={1.1} blend={0.6} speed={0.5} mouseInteraction={false} />
      </div>

      <header className="relative flex items-end justify-between gap-6 pt-10">
        <div>
          <p className="text-muted">{greeting()}</p>
          <h1 className="font-display text-4xl font-bold tracking-tight">Tu biblioteca</h1>
        </div>
        <div className="flex gap-3">
          {[
            { label: 'Jugados', value: rated.length },
            { label: 'Promedio', value: avg },
            { label: 'Históricos', value: legendary },
          ].map((t) => (
            <div key={t.label} className="w-36 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 backdrop-blur-md">
              <div className="font-display text-3xl font-bold tabular-nums">
                <CountUp to={t.value} duration={1.2} trigger="load" />
              </div>
              <div className="text-xs text-muted">{t.label}</div>
            </div>
          ))}
        </div>
      </header>

      <LoginInvite className="mt-6" />

      {empty && (
        <section className="relative mt-8 flex items-center justify-between gap-6 rounded-3xl border border-line bg-surface p-8">
          <div>
            <h2 className="font-display text-2xl font-bold">Empezá tu colección 🎮</h2>
            <p className="mt-1 text-muted">Buscá un juego que hayas jugado para puntuarlo, o agregalo a tu lista de próximos.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link to="/buscar" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-black">
              <Search size={18} /> Buscar juegos
            </Link>
            <Link to="/descubrir" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 font-semibold">
              <Compass size={18} /> Descubrir
            </Link>
          </div>
        </section>
      )}

      {upNext && (
        <section className="relative mt-8 h-80 overflow-hidden rounded-3xl border border-line">
          <Cover game={upNext} size={1280} showTitle={false} className="absolute inset-0 scale-105 opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg/80 to-transparent" />
          <div className="relative flex h-full items-end gap-7 p-8">
            <Link to={`/juego/${encodeURIComponent(upNext.id)}`} className="shrink-0 transition hover:-translate-y-1">
              <Cover game={upNext} className="aspect-[3/4] w-44 rounded-2xl text-sm shadow-2xl" />
            </Link>
            <div className="min-w-0 flex-1 pb-1">
              <span className="text-xs font-bold tracking-widest text-accent uppercase">Lo próximo · #1 en tu lista</span>
              <h2 className="mt-2 line-clamp-2 font-display text-4xl leading-tight font-bold">{upNext.name}</h2>
              <p className="mt-1 text-white/70">{[year(upNext.released), ...upNext.genres.slice(0, 2)].filter(Boolean).join(' · ')}</p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={onStart}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-semibold text-black transition hover:brightness-90"
                >
                  <Play size={16} fill="currentColor" /> Empezar a jugar
                </button>
                <Link
                  to={`/juego/${encodeURIComponent(upNext.id)}`}
                  className="inline-flex items-center rounded-full bg-white/10 px-5 py-2.5 font-semibold backdrop-blur transition hover:bg-white/20"
                >
                  Ver ficha
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="mt-10 grid grid-cols-[minmax(0,1fr)_320px] gap-10">
        <div className="space-y-10">
          {playing.length > 0 && (
            <section>
              <DesktopTitle title="Jugando ahora" to={`/listas/${PLAYING_LIST_ID}`} />
              <div className="grid grid-cols-4 gap-4">
                {playing.slice(0, 4).map((g) => (
                  <DesktopPoster key={g.id} game={g} />
                ))}
              </div>
            </section>
          )}
          {recent.length > 0 && (
            <section>
              <DesktopTitle title="Últimos puntuados" to="/mis-juegos" />
              <div className="grid grid-cols-4 gap-4">
                {recent.map((r) => (
                  <DesktopPoster key={r.gameId} game={games[r.gameId]} rating={r} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          {rated.length > 0 && (
            <div className="rounded-3xl border border-line bg-surface p-5">
              <DesktopTitle title="Tu escala" to="/estadisticas" more="Estadísticas" />
              <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
                {counts.map(({ tier, n }) => (n ? <div key={tier.id} style={{ flex: n, background: tier.color }} /> : null))}
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {counts
                  .slice()
                  .reverse()
                  .map(({ tier, n }) => (
                    <li key={tier.id}>
                      <Link to={`/mis-juegos?tier=${tier.id}`} className="flex items-center gap-2 hover:text-white">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: tier.color }} />
                        <span className="text-white/80">
                          {tier.emoji} {tier.label}
                        </span>
                        <span className="ml-auto text-muted tabular-nums">{n}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {next.length > 1 && (
            <div className="rounded-3xl border border-line bg-surface p-5">
              <DesktopTitle title="Después" to={`/listas/${NEXT_LIST_ID}`} />
              <ol className="space-y-2.5">
                {next.slice(1, 6).map((g, i) => (
                  <li key={g.id}>
                    <Link to={`/juego/${encodeURIComponent(g.id)}`} className="flex items-center gap-3 hover:text-white">
                      <span className="w-4 text-center font-display text-sm font-bold text-muted">{i + 2}</span>
                      <Cover game={g} showTitle={false} className="h-12 w-9 shrink-0 rounded-md" />
                      <span className="truncate text-sm font-medium">{g.name}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <Link
            to="/descubrir"
            className="block rounded-3xl border border-accent/30 bg-gradient-to-br from-violet-500/20 to-pink-500/10 p-5 transition hover:border-accent/60"
          >
            <Compass className="text-accent" />
            <p className="mt-3 font-display text-lg font-bold">¿Qué juego sigue?</p>
            <p className="text-sm text-muted">Recomendaciones según tus gustos, lo mejor del año y más.</p>
          </Link>
        </aside>
      </div>
    </div>
  );
}

function DesktopTitle({ title, to, more = 'Ver todo' }: { title: string; to?: string; more?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {to && (
        <Link to={to} className="flex items-center text-sm text-muted hover:text-white">
          {more} <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}

function DesktopPoster({ game, rating }: { game: Game; rating?: Rating }) {
  const tier = rating ? TIER_BY_ID[rating.tier] : null;
  return (
    <Link to={`/juego/${encodeURIComponent(game.id)}`} className="group block">
      <div className="relative overflow-hidden rounded-2xl">
        <Cover game={game} size={640} className="aspect-[3/4] text-sm transition duration-500 group-hover:scale-105" />
        {rating && (
          <span className="absolute top-2 right-2 rounded-lg bg-black/75 backdrop-blur">
            <ScoreBadge score={rating.score} className="text-base" />
          </span>
        )}
      </div>
      <p className="mt-2 truncate text-sm font-semibold group-hover:text-white">{game.name}</p>
      {tier && (
        <p className="text-xs" style={{ color: tier.color }}>
          {tier.emoji} {tier.label}
        </p>
      )}
    </Link>
  );
}
