import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { KeyRound, Loader2, Search as SearchIcon, X } from 'lucide-react';
import GameRow from '../components/GameRow';
import { DEMO_GAMES } from '../data/demo';
import { DEMO_SCREEN } from '../data/demoScreen';
import { keyFor, popularItems, searchItems, useKeys } from '../lib/catalog';
import { loadGameIndex, searchGameIndex } from '../lib/gameIndex';
import { MODES } from '../lib/mode';
import { useIsDesktop } from '../lib/useMedia';
import type { Game } from '../lib/types';
import { useMode } from '../store/useUi';

export default function Search() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [results, setResults] = useState<Game[]>([]);
  const [popular, setPopular] = useState<Game[]>([]);
  const [popularError, setPopularError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mode = useMode();
  // On phones focusing would pop the keyboard up over the trending list; wait for a tap.
  const isDesktop = useIsDesktop();
  const keys = useKeys();
  const key = keyFor(mode, keys);
  const copy = MODES[mode];
  const inputRef = useRef<HTMLInputElement>(null);
  // Popular games are found while typing; RAWG's search adds the rest a moment later.
  const [indexReady, setIndexReady] = useState(false);
  useEffect(() => {
    if (mode !== 'games' || !keys.rawg) return;
    let alive = true;
    loadGameIndex().then((i) => alive && setIndexReady(Boolean(i)));
    return () => {
      alive = false;
    };
  }, [mode, keys.rawg]);

  useEffect(() => {
    const ctrl = new AbortController();
    setPopular([]);
    popularItems(mode, keys, ctrl.signal)
      .then((r) => {
        setPopular(r);
        setPopularError(null);
      })
      .catch((e: Error) => e.name !== 'AbortError' && setPopularError(e.message));
    return () => ctrl.abort();
    // keys is rebuilt each render; key covers the one this mode uses.
  }, [key, mode]);

  useEffect(() => {
    const q = query.trim();
    setParams(q ? { q } : {}, { replace: true });
    if (q.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    const instant = mode === 'games' && keys.rawg ? searchGameIndex(q) : [];
    if (instant.length) {
      setResults(instant);
      setError(null);
    }
    const t = setTimeout(() => {
      setLoading(true);
      searchItems(mode, keys, q, ctrl.signal)
        .then((r) => {
          // What was already on screen stays in place; RAWG's other finds go after it.
          const shown = new Set(instant.map((g) => g.id));
          setResults([...instant, ...r.filter((g) => !shown.has(g.id))]);
          setError(null);
        })
        // With instant results on screen, a failed RAWG search just leaves them.
        .catch((e: Error) => e.name !== 'AbortError' && !instant.length && setError(e.message))
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, key, mode, setParams, indexReady]);

  const searching = query.trim().length >= 2;

  return (
    <div>
      <header className="pt-safe sticky top-0 z-30 bg-bg/85 px-5 pb-3 backdrop-blur-xl">
        <h1 className="pt-6 pb-4 font-display text-3xl font-bold tracking-tight">Buscar</h1>
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 focus-within:border-accent/60">
          <SearchIcon size={18} className="text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.searchHint}
            className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-muted/60"
            autoFocus={isDesktop}
            enterKeyHint="search"
          />
          {loading && <Loader2 size={18} className="animate-spin text-muted" />}
          {query && !loading && (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Borrar"
              className="text-muted"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      {!key && (
        <Link
          to="/ajustes"
          className="mx-5 mt-2 flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm"
        >
          <KeyRound size={18} className="shrink-0 text-amber-300" />
          <span>
            Modo demo con <b>{mode === 'games' ? `${DEMO_GAMES.length} juegos` : `${DEMO_SCREEN.length} títulos`}</b>. {copy.demoHint}
          </span>
        </Link>
      )}

      <div className="px-5">
        {(error || (!searching && popularError)) && (
          <p className="mt-6 text-center text-sm text-rose-400">{error ?? popularError}</p>
        )}

        {searching ? (
          <>
            {!loading && !error && results.length === 0 && (
              <p className="mt-10 text-center text-muted">No encontramos “{query}”.</p>
            )}
            <ul className="mt-2 divide-y divide-white/5 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:divide-y-0">
              {results.map((g) => (
                <GameRow key={g.id} game={g} />
              ))}
            </ul>
          </>
        ) : (
          popular.length > 0 && (
            <>
              <h2 className="mt-5 mb-1 font-display text-lg font-bold">{!key ? 'Para empezar' : mode === 'games' ? 'Populares este año' : 'Tendencias de la semana'}</h2>
              <ul className="divide-y divide-white/5 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:divide-y-0">
                {popular.map((g) => (
                  <GameRow key={g.id} game={g} />
                ))}
              </ul>
            </>
          )
        )}
      </div>
    </div>
  );
}
