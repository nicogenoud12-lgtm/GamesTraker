import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Download, ExternalLink, KeyRound, Loader2, Upload } from 'lucide-react';
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
        <button onClick={() => navigate(-1)} aria-label="Volver" className="mt-4 rounded-full bg-white/5 p-2.5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="mt-3 px-1 pb-4 font-display text-3xl font-bold tracking-tight">Ajustes</h1>
      </header>

      <div className="space-y-4 px-5">
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
        </section>

        <section className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-bold">Tus datos</h2>
          <p className="mt-2 text-sm text-muted">
            Todo se guarda en este dispositivo. Exportá un backup para no perderlo o pasarlo a otro celular.
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
