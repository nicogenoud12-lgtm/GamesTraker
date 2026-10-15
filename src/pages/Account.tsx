import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { checkServer, login, register } from '../lib/sync';
import { useSync } from '../store/useSync';
import { useToast } from '../store/useToast';

type Mode = 'login' | 'register';

export default function Account() {
  const navigate = useNavigate();
  const server = useSync((s) => s.server);
  const loggedIn = useSync((s) => Boolean(s.token));
  const toast = useToast((s) => s.show);
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void checkServer();
  }, []);
  // Before the first account exists, creating it is the only thing to do.
  useEffect(() => {
    if (server && !server.hasUsers) setMode('register');
  }, [server]);
  useEffect(() => {
    if (loggedIn) navigate('/ajustes', { replace: true });
  }, [loggedIn, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login(username, password);
      else await register(username, password);
      toast(mode === 'login' ? 'Sesión iniciada · sincronizando' : 'Cuenta creada · sincronizando');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canRegister = server?.signupOpen ?? false;

  return (
    <div className="pt-safe px-5 lg:pt-10">
      <button onClick={() => navigate(-1)} aria-label="Volver" className="mt-4 rounded-full bg-white/5 p-2.5 lg:hidden">
        <ArrowLeft size={20} />
      </button>

      <div className="mx-auto mt-6 max-w-sm">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {mode === 'login' ? 'Iniciar sesión' : 'Crear tu cuenta'}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {mode === 'login'
            ? 'Entrá con tu cuenta para tener tus puntajes y listas en todos tus dispositivos.'
            : server?.hasUsers
              ? 'Creá una cuenta nueva en este servidor.'
              : 'Es la primera vez: creá tu cuenta. Después vas a entrar con ella en el celu, la compu o donde quieras. Lo que ya tengas en este dispositivo se suma a tu cuenta.'}
        </p>

        {server === null ? (
          <p className="mt-6 rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
            No se encontró el servidor de GamesTraker. Las cuentas funcionan cuando la app corre en tu servidor
            (juegos.genoud-nube.com.ar).
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            {canRegister && server.hasUsers && (
              <div className="grid grid-cols-2 rounded-2xl bg-white/5 p-1">
                {(['login', 'register'] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-xl py-2 text-sm font-medium transition ${mode === m ? 'bg-white text-black' : 'text-muted'}`}
                  >
                    {m === 'login' ? 'Entrar' : 'Crear cuenta'}
                  </button>
                ))}
              </div>
            )}
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Usuario</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={mode === 'register' ? 8 : undefined}
                required
                className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3"
              />
              {mode === 'register' && <span className="mt-1 block text-xs text-muted">Mínimo 8 caracteres.</span>}
            </label>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center rounded-2xl bg-white py-3.5 font-display font-bold text-black transition hover:brightness-90 disabled:opacity-60"
            >
              {busy ? <Loader2 size={20} className="animate-spin" /> : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
