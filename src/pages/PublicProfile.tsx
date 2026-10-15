import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Cover from '../components/Cover';
import ListIcon from '../components/ListIcon';
import { ScoreBadge } from '../components/Score';
import { MODES, listMode, modeOf, type Mode } from '../lib/mode';
import { fetchPublicProfile, type PublicProfile as Profile } from '../lib/sync';
import { TIERS } from '../lib/tiers';
import type { Game } from '../lib/types';
import { useUi } from '../store/useUi';

/** Read-only page anyone with the link can open (#/p/usuario), shown without the app's navigation. */
export default function PublicProfile() {
  const { username = '' } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    let alive = true;
    setProfile(null);
    setError(null);
    fetchPublicProfile(username)
      .then((p) => alive && setProfile(p))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [username]);

  const counts = useMemo(() => {
    const ids = Object.keys(profile?.ratings ?? {}).filter((id) => profile?.games[id]);
    return { games: ids.filter((id) => modeOf(id) === 'games').length, screen: ids.filter((id) => modeOf(id) === 'screen').length };
  }, [profile]);
  const active: Mode = mode ?? (counts.screen > counts.games ? 'screen' : 'games');

  // The page takes the colors of the side being shown; leaving it restores the app's.
  useEffect(() => {
    document.documentElement.dataset.mode = active;
    return () => {
      document.documentElement.dataset.mode = useUi.getState().mode;
    };
  }, [active]);
  useEffect(() => {
    if (profile) document.title = `${profile.username} · ${MODES[active].brand}Tracker`;
  }, [profile, active]);

  if (!profile) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center text-muted">
        {error ? (
          <>
            <p className="font-display text-xl font-bold text-white">{error}</p>
            <Link to="/" className="text-sm font-semibold text-accent">
              Ir a la app
            </Link>
          </>
        ) : (
          <Loader2 className="animate-spin" />
        )}
      </div>
    );
  }

  const copy = MODES[active];
  const rated = Object.values(profile.ratings)
    .filter((r) => profile.games[r.gameId] && modeOf(r.gameId) === active)
    .sort((a, b) => b.score - a.score);
  const average = rated.length ? Math.round(rated.reduce((n, r) => n + r.score, 0) / rated.length) : null;
  const legendary = rated.filter((r) => r.tier === 'historico').length;
  const gamesOf = (ids: string[]) => ids.map((id) => profile.games[id]).filter((g): g is Game => Boolean(g));
  const lists = profile.lists.filter((l) => listMode(l) === active && gamesOf(l.gameIds).length);
  const now = lists.find((l) => l.id === copy.nowListId);
  const others = lists.filter((l) => l !== now);

  return (
    <div className="relative mx-auto min-h-dvh max-w-5xl pb-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-accent/20 to-transparent" />
      <header className="pt-safe px-5">
        <Link to="/" className="mt-5 inline-block font-display text-lg font-bold tracking-tight">
          {copy.brand}
          <span className="grad-text">Tracker</span>
        </Link>
        <div className="mt-6 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 font-display text-3xl font-bold text-black uppercase">
            {profile.username[0]}
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl font-bold tracking-tight">{profile.username}</h1>
            <p className="text-sm text-muted">Perfil público · solo lectura</p>
          </div>
        </div>

        <div role="tablist" aria-label="Colección" className="mt-6 grid max-w-sm grid-cols-2 rounded-2xl border border-white/10 bg-black/30 p-1">
          {(['games', 'screen'] as Mode[]).map((m) => {
            const Icon = MODES[m].icon;
            return (
              <button
                key={m}
                role="tab"
                aria-selected={active === m}
                onClick={() => setMode(m)}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition ${active === m ? 'bg-accent text-black' : 'text-muted hover:text-white'}`}
              >
                <Icon size={16} strokeWidth={2.4} /> {MODES[m].label}
                <span className={`text-xs tabular-nums ${active === m ? 'text-black/60' : 'text-muted/70'}`}>{counts[m]}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid max-w-md grid-cols-3 gap-2">
          <Stat label="Puntuados" value={rated.length} />
          <Stat label="Promedio" value={average ?? '—'} />
          <Stat label="Históricos" value={legendary} />
        </div>
      </header>

      {now && <Row title={copy.nowLabel} games={gamesOf(now.gameIds)} />}

      {rated.length === 0 ? (
        <p className="mx-5 mt-8 rounded-3xl border border-dashed border-line p-6 text-center text-muted">
          Todavía no puntuó {active === 'games' ? 'ningún juego' : 'ninguna serie ni película'}.
        </p>
      ) : (
        <section className="mt-8 px-5">
          <h2 className="mb-3 font-display text-xl font-bold">Escala</h2>
          <div className="space-y-2">
            {[...TIERS].reverse().map((tier) => {
              const items = rated.filter((r) => r.tier === tier.id);
              if (!items.length) return null;
              return (
                <div key={tier.id} className="flex items-stretch gap-2 rounded-2xl border border-line bg-surface p-2">
                  <div
                    className="flex w-20 shrink-0 flex-col items-center justify-center rounded-xl text-center"
                    style={{ background: `${tier.color}22`, color: tier.color }}
                  >
                    <span className="text-xl">{tier.emoji}</span>
                    <span className="text-xs font-bold">{tier.label}</span>
                    <span className="text-[11px] tabular-nums opacity-70">{items.length}</span>
                  </div>
                  <div className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto">
                    {items.map((r) => (
                      <div key={r.gameId} className="relative w-[66px] shrink-0 lg:w-[88px]" title={profile.games[r.gameId].name}>
                        <Cover game={profile.games[r.gameId]} className="aspect-[3/4] rounded-lg" />
                        <span className="absolute right-1 bottom-1 rounded-lg bg-black/75 backdrop-blur">
                          <ScoreBadge score={r.score} className="min-w-7 text-xs" />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {others.map((l) => (
        <Row
          key={l.id}
          title={l.name}
          icon={<ListIcon list={l} size="sm" />}
          games={gamesOf(l.gameIds)}
        />
      ))}

      <p className="mt-12 px-5 text-center text-sm text-muted">
        Hecho con{' '}
        <Link to="/" className="font-semibold text-accent">
          {copy.brand}Tracker
        </Link>
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-2.5">
      <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function Row({ title, games, icon }: { title: string; games: Game[]; icon?: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 px-5 font-display text-xl font-bold">
        {icon}
        {title} <span className="text-sm font-normal text-muted">{games.length}</span>
      </h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-5">
        {games.map((g) => (
          <div key={g.id} className="w-28 shrink-0 lg:w-36">
            <Cover game={g} className="aspect-[3/4] rounded-xl" />
            <p className="mt-1.5 truncate text-xs text-white/80">{g.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
