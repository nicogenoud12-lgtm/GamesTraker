import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Cloud, Download, ExternalLink, KeyRound, Loader2, LogIn, RefreshCw, Upload } from 'lucide-react';
import { changePassword, syncNow } from '../lib/sync';
import { useSync } from '../store/useSync';
import { hasEnvKey } from '../lib/catalog';
import { rawgSearch } from '../lib/rawg';
import { useStore } from '../store/useStore';
import { useToast } from '../store/useToast';

export default function Settings() {
  const navigate = useNavigate();
  const apiKey = useStore((s) => s.apiKey);
  const setApiKey = useStore((s) => s.setApiKey);
  const importData = useStore((s) => s.importData);
  const toast = useToast((s) => s.show);
  const [draft, setDraft] = useState(apiKey);
  const loggedIn = useSync((s) => Boolean(s.token));
  // A key that arrives from another device fills the field too.
  useEffect(() => setDraft((d) => d || apiKey), [apiKey]);
  const [testing, setTesting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveKey = async () => {
    const key = draft.trim();
    if (!key) {
      setApiKey('');
      toast('API key eliminada');
      return;
    }
    setTesting(true);
    try {
      await rawgSearch(key, 'zelda');
      setApiKey(key);
      toast('¡Conectado a RAWG!');
    } catch (e) {
      toast((e as Error).message || 'No se pudo conectar');
    } finally {
      setTesting(false);
    }
  };

  const exportData = () => {
    const { games, ratings, lists } = useStore.getState();
    const blob = new Blob([JSON.stringify({ app: 'gamestraker', version: 1, games, ratings, lists }, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gamestraker-${new Date().toISOString().slice(0, 10)}.json`;
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

        <section className="rounded-3xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-accent" />
            <h2 className="font-display text-lg font-bold">Base de juegos (RAWG)</h2>
          </div>
          <p className="mt-2 text-sm text-muted">
            GamesTraker usa la base de RAWG: más de 800.000 juegos con carátulas, plataformas y capturas. La key es gratis.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-white/80">
            <li>
              Creá una cuenta en{' '}
              <a href="https://rawg.io/apidocs" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent">
                rawg.io/apidocs <ExternalLink size={12} />
              </a>
            </li>
            <li>Copiá tu API key y pegala acá.</li>
          </ol>
          <div className="mt-4 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={hasEnvKey() ? 'Usando la key del servidor' : 'Pegá tu API key'}
              className="min-w-0 flex-1 rounded-2xl border border-line bg-surface-2 px-4 py-3 font-mono text-sm placeholder:font-sans placeholder:text-muted/60"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              onClick={saveKey}
              disabled={testing}
              className="flex items-center rounded-2xl bg-white px-4 font-semibold text-black disabled:opacity-60"
            >
              {testing ? <Loader2 size={18} className="animate-spin" /> : 'Guardar'}
            </button>
          </div>
          {(apiKey || hasEnvKey()) && (
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
