import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Cloud, Download, ExternalLink, KeyRound, Loader2, LogIn, RefreshCw, Upload } from 'lucide-react';
import { changePassword, syncNow } from '../lib/sync';
import { useSync } from '../store/useSync';
import { hasEnvKey } from '../lib/catalog';
import { rawgSearch } from '../lib/rawg';
import { tmdbSearch } from '../lib/tmdb';
import { useMode } from '../store/useUi';
import { useStore } from '../store/useStore';
import { useToast } from '../store/useToast';

export default function Settings() {
  const navigate = useNavigate();
  const importData = useStore((s) => s.importData);
  const toast = useToast((s) => s.show);
  const fileRef = useRef<HTMLInputElement>(null);
  const mode = useMode();

  const exportData = () => {
    const { games, ratings, lists } = useStore.getState();
    const blob = new Blob([JSON.stringify({ app: 'gamestraker', version: 1, games, ratings, lists }, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gamestracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onImport = async (file: File) => {
    try {
      importData(JSON.parse(await file.text()));
      toast('Backup importado');
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <div>
      <header className="pt-safe px-4">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="mt-4 rounded-full bg-white/5 p-2.5 lg:hidden">
          <ArrowLeft size={20} />
        </button>
        <h1 className="mt-3 px-1 pb-4 font-display text-3xl font-bold tracking-tight lg:text-4xl">Ajustes</h1>
      </header>

      <div className="space-y-4 px-5 lg:max-w-2xl">
        <SyncSection />

        {/* The section of the mode in use goes first. */}
        {(mode === 'games' ? ['rawg', 'tmdb'] : ['tmdb', 'rawg']).map((k) =>
          k === 'rawg' ? (
            <KeySection
              key="rawg"
              title="Base de juegos (RAWG)"
              description="Los juegos salen de RAWG: más de 800.000 juegos con carátulas, plataformas y capturas. La key es gratis."
              steps={[
                <>
                  Creá una cuenta en{' '}
                  <ExtLink href="https://rawg.io/apidocs">rawg.io/apidocs</ExtLink>
                </>,
                'Copiá tu API key y pegala acá.',
              ]}
              selector={(st) => st.apiKey}
              save={(v) => useStore.getState().setApiKey(v)}
              env={hasEnvKey('rawg')}
              test={(v) => rawgSearch(v, 'zelda').then(() => undefined)}
              service="RAWG"
            />
          ) : (
            <KeySection
              key="tmdb"
              title="Base de series y pelis (TMDB)"
              description="Las series y películas salen de TMDB: pósters, sinopsis en castellano, tráileres y dónde verlas en Argentina. La key es gratis."
              steps={[
                <>
                  Creá una cuenta en <ExtLink href="https://www.themoviedb.org/signup">themoviedb.org</ExtLink>
                </>,
                <>
                  Andá a <ExtLink href="https://www.themoviedb.org/settings/api">Ajustes → API</ExtLink>, pedí una key (uso personal) y
                  pegá la "Clave de la API" o el "Token de acceso de lectura".
                </>,
              ]}
              selector={(st) => st.tmdbKey}
              save={(v) => useStore.getState().setTmdbKey(v)}
              env={hasEnvKey('tmdb')}
              test={(v) => tmdbSearch(v, 'dune').then(() => undefined)}
              service="TMDB"
            />
          ),
        )}

        <section className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-bold">Tus datos</h2>
          <p className="mt-2 text-sm text-muted">
            Exportá un backup en un archivo, por si querés guardarlo aparte o pasarlo sin sincronizar.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={exportData} className="flex items-center justify-center gap-2 rounded-2xl bg-surface-2 py-3 text-sm font-semibold">
              <Download size={16} /> Exportar
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-2xl bg-surface-2 py-3 text-sm font-semibold"
            >
              <Upload size={16} /> Importar
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
        </section>

        <p className="pt-2 text-center text-xs text-muted/60">
          Datos de juegos por RAWG.io · Animaciones de React Bits
        </p>
      </div>
    </div>
  );
}

function SyncSection() {
  const { token, username, status, error, lastSyncAt, server, logout } = useSync();
  const toast = useToast((s) => s.show);
  const [changing, setChanging] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  const savePassword = async () => {
    setBusy(true);
    try {
      await changePassword(current, next);
      toast('Contraseña cambiada. Los otros dispositivos van a pedir iniciar sesión de nuevo.');
      setChanging(false);
      setCurrent('');
      setNext('');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <Cloud size={18} className="text-accent" />
        <h2 className="font-display text-lg font-bold">Cuenta y sincronización</h2>
      </div>
      {token ? (
        <>
          <p className="mt-2 text-sm text-muted">
            Sesión iniciada como <span className="font-semibold text-white">{username}</span>. Tus puntajes y listas se
            sincronizan solos con todos los dispositivos donde entres con esta cuenta.
          </p>
          <p className={`mt-3 flex items-center gap-1.5 text-sm ${status === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
            {status === 'syncing' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {status === 'error'
              ? error
              : status === 'syncing'
                ? 'Sincronizando…'
                : `Sincronizado${lastSyncAt ? ` · ${new Date(lastSyncAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => void syncNow()}
              className="flex items-center justify-center gap-2 rounded-2xl bg-surface-2 py-3 text-sm font-semibold"
            >
              <RefreshCw size={16} /> Sincronizar ahora
            </button>
            <button onClick={() => setChanging(!changing)} className="rounded-2xl bg-surface-2 py-3 text-sm font-semibold">
              Cambiar contraseña
            </button>
          </div>
          {changing && (
            <div className="mt-3 space-y-2">
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="Contraseña actual"
                autoComplete="current-password"
                className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm placeholder:text-muted/60"
              />
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="Contraseña nueva (mínimo 8)"
                autoComplete="new-password"
                className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm placeholder:text-muted/60"
              />
              <button
                onClick={savePassword}
                disabled={busy || !current || next.length < 8}
                className="w-full rounded-2xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50"
              >
                Guardar contraseña
              </button>
            </div>
          )}
          <button
            onClick={() => {
              if (confirm('¿Cerrar sesión en este dispositivo? Tus datos quedan acá y en tu cuenta.')) logout();
            }}
            className="mt-3 w-full rounded-2xl py-2.5 text-sm font-semibold text-muted hover:text-white"
          >
            Cerrar sesión
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">
            {error ? (
              <span className="text-rose-400">{error}. </span>
            ) : null}
            Entrá con tu usuario y contraseña para tener los mismos juegos en el celu y en la compu. Lo hacés una vez
            en cada dispositivo y queda recordado.
          </p>
          {server ? (
            <Link
              to="/cuenta"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 font-semibold text-black"
            >
              <LogIn size={18} /> {server.hasUsers ? 'Iniciar sesión' : 'Crear mi cuenta'}
            </Link>
          ) : (
            <p className="mt-3 text-xs text-muted">Disponible cuando la app corre en tu servidor.</p>
          )}
        </>
      )}
    </section>
  );
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent">
      {children} <ExternalLink size={12} />
    </a>
  );
}

interface KeySectionProps {
  title: string;
  description: string;
  steps: ReactNode[];
  selector: (s: ReturnType<typeof useStore.getState>) => string;
  save: (value: string) => void;
  env: boolean;
  test: (value: string) => Promise<void>;
  service: string;
}

function KeySection({ title, description, steps, selector, save, env, test, service }: KeySectionProps) {
  const current = useStore(selector);
  const loggedIn = useSync((s) => Boolean(s.token));
  const toast = useToast((s) => s.show);
  const [draft, setDraft] = useState(current);
  const [testing, setTesting] = useState(false);
  // A key that arrives from another device fills the field too.
  useEffect(() => setDraft((d) => d || current), [current]);

  const onSave = async () => {
    const key = draft.trim();
    if (!key) {
      save('');
      toast('Key eliminada');
      return;
    }
    setTesting(true);
    try {
      await test(key);
      save(key);
      toast(`¡Conectado a ${service}!`);
    } catch (e) {
      toast((e as Error).message || 'No se pudo conectar');
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <KeyRound size={18} className="text-accent" />
        <h2 className="font-display text-lg font-bold">{title}</h2>
      </div>
      <p className="mt-2 text-sm text-muted">{description}</p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-white/80">
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      <div className="mt-4 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={env ? 'Usando la key del servidor' : 'Pegá tu key'}
          className="min-w-0 flex-1 rounded-2xl border border-line bg-surface-2 px-4 py-3 font-mono text-sm placeholder:font-sans placeholder:text-muted/60"
          autoComplete="off"
          spellCheck={false}
        />
        <button onClick={onSave} disabled={testing} className="flex items-center rounded-2xl bg-white px-4 font-semibold text-black disabled:opacity-60">
          {testing ? <Loader2 size={18} className="animate-spin" /> : 'Guardar'}
        </button>
      </div>
      {(current || env) && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-400">
          <CheckCircle2 size={16} /> Conectado
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        {loggedIn
          ? 'Se guarda en tu cuenta: llega sola a los otros dispositivos donde inicies sesión.'
          : 'Iniciá sesión para que la key llegue sola a tus otros dispositivos.'}
      </p>
    </section>
  );
}
