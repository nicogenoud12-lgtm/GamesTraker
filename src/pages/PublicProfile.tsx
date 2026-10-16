import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Cover from '../components/Cover';
import TierSection, { CoverScore } from '../components/TierSection';
import { KINDS } from '../lib/kinds';
import { MODES, kindOf, modeOf, type Mode } from '../lib/mode';
import { fetchPublicProfile, type PublicProfile as Profile } from '../lib/sync';
import { TIERS } from '../lib/tiers';
import { useUi } from '../store/useUi';

const ONE: Record<string, string> = {
  juegos: 'juego puntuado',
  'series y pelis': 'título puntuado',
  películas: 'película puntuada',
  series: 'serie puntuada',
};

/**
 * Someone's tier list, read-only, for anyone with the link (#/p/usuario).
 * Shown without the app's navigation. `?modo=juegos|series-y-pelis&tipo=pelis|series`
 * opens it on a given side.
 */
export default function PublicProfile() {
  const { username = '' } = useParams();
  const navigate = useNavigate();
  // Opened from inside the app (e.g. Amigos): offer the way back.
  const [canGoBack] = useState(() => window.history.state?.idx > 0);
  const [params, setParams] = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  const asked = params.get('modo');
  const active: Mode = asked === 'juegos' ? 'games' : asked === 'series-y-pelis' ? 'screen' : counts.screen > counts.games ? 'screen' : 'games';
  const kindFilter = active === 'screen' ? (KINDS.find((k) => k.id === params.get('tipo')) ?? KINDS[0]) : KINDS[0];

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  // The page takes the colors of the side being shown; leaving it restores the app's.
  useEffect(() => {
    document.documentElement.dataset.mode = active;
    return () => {
      document.documentElement.dataset.mode = useUi.getState().mode;
    };
  }, [active]);
  useEffect(() => {
    if (profile) document.title = `Escala de ${profile.username} · ${MODES[active].brand}Tracker`;
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
  const everything = Object.values(profile.ratings).filter((r) => profile.games[r.gameId] && modeOf(r.gameId) === active);
  const rated = (kindFilter.kind ? everything.filter((r) => kindOf(r.gameId) === kindFilter.kind) : everything).sort(
    (a, b) => b.score - a.score,
  );
  const average = rated.length ? Math.round(rated.reduce((n, r) => n + r.score, 0) / rated.length) : null;
  const legendary = rated.filter((r) => r.tier === 'historico').length;
  const what = kindFilter.kind === 'movie' ? 'películas' : kindFilter.kind === 'tv' ? 'series' : active === 'games' ? 'juegos' : 'series y pelis';

  return (
    <div className="relative mx-auto min-h-dvh max-w-6xl pb-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-accent/20 to-transparent" />
      <header className="pt-safe px-5">
        <div className="mt-5 flex items-center gap-3">
          {canGoBack && (
            <button onClick={() => navigate(-1)} aria-label="Volver" className="rounded-full bg-white/10 p-2">
              <ArrowLeft size={18} />
            </button>
          )}
          <Link to="/" className="font-display text-lg font-bold tracking-tight">
            {copy.brand}
            <span className="grad-text">Tracker</span>
          </Link>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 font-display text-2xl font-bold text-black uppercase">
            {profile.username[0]}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted">La escala de</p>
            <h1 className="truncate font-display text-3xl leading-tight font-bold tracking-tight">{profile.username}</h1>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <div role="tablist" aria-label="Colección" className="grid w-full max-w-sm grid-cols-2 rounded-2xl border border-white/10 bg-black/30 p-1">
            {(['games', 'screen'] as Mode[]).map((m) => {
              const Icon = MODES[m].icon;
              return (
                <button
                  key={m}
                  role="tab"
                  aria-selected={active === m}
                  onClick={() => set({ modo: m === 'games' ? 'juegos' : 'series-y-pelis', tipo: null })}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition ${active === m ? 'bg-accent text-black' : 'text-muted hover:text-white'}`}
                >
                  <Icon size={16} strokeWidth={2.4} /> {MODES[m].label}
                  <span className={`text-xs tabular-nums ${active === m ? 'text-black/60' : 'text-muted/70'}`}>{counts[m]}</span>
                </button>
              );
            })}
          </div>
          {active === 'screen' && everything.length > 0 && (
            <div role="tablist" aria-label="Tipo" className="grid w-full max-w-sm grid-cols-3 rounded-2xl border border-white/10 bg-black/30 p-1">
              {KINDS.map(({ id, kind, label, icon: Icon }) => (
                <button
                  key={label}
                  role="tab"
                  aria-selected={kindFilter.id === id}
                  onClick={() => set({ tipo: id })}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-sm font-semibold transition ${kindFilter.id === id ? 'bg-white/15 text-white' : 'text-muted hover:text-white'}`}
                >
                  <Icon size={15} /> {label}
                  <span className="text-xs text-muted/70 tabular-nums">{kind ? everything.filter((r) => kindOf(r.gameId) === kind).length : everything.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="mt-4 text-sm text-muted">
          {rated.length === 1 ? `1 ${ONE[what]}` : `${rated.length} ${what} ${what === 'juegos' ? 'puntuados' : 'puntuadas'}`}{average != null && <> · promedio <span className="font-semibold text-white">{average}</span></>}
          {legendary > 0 && <> · {legendary} {legendary === 1 ? 'histórico' : 'históricos'}</>}
        </p>
      </header>

      {rated.length === 0 ? (
        <p className="mx-5 mt-8 rounded-3xl border border-dashed border-line p-6 text-center text-muted">Todavía no puntuó {what}.</p>
      ) : (
        <div className="mt-5 space-y-2.5 px-5">
          {[...TIERS].reverse().map((tier) => {
            const items = rated.filter((r) => r.tier === tier.id);
            if (!items.length) return null;
            return (
              <TierSection key={tier.id} tier={tier} count={items.length}>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2 px-4 pb-3 lg:grid-cols-[repeat(auto-fill,minmax(92px,1fr))]">
                  {items.map((r) => {
                    const game = profile.games[r.gameId];
                    return (
                      <div key={r.gameId} className="relative" title={`${game.name} · ${r.score}`}>
                        <Cover game={game} className="aspect-[3/4] rounded-lg text-[9px]" />
                        <CoverScore score={r.score} color={tier.color} />
                      </div>
                    );
                  })}
                </div>
              </TierSection>
            );
          })}
        </div>
      )}

      <p className="mt-12 px-5 text-center text-sm text-muted">
        Hecha con{' '}
        <Link to="/" className="font-semibold text-accent">
          {copy.brand}Tracker
        </Link>
      </p>
    </div>
  );
}
