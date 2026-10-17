import { useEffect, useState } from 'react';
import { Download, Gamepad2, Loader2 } from 'lucide-react';
import { disconnectPlaynite, downloadPlayniteExtension, refreshPlaynite, usePlaynite } from '../lib/playnite';
import { useToast } from '../store/useToast';

/** Settings → Playnite: download the extension that reports games started, finished and hours played. */
export default function PlayniteSettings() {
  const status = usePlaynite((s) => s.status);
  const toast = useToast((s) => s.show);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshPlaynite();
  }, []);

  const download = async () => {
    setBusy(true);
    try {
      await downloadPlayniteExtension();
      toast('Abrí GamesTracker.pext para instalarla en Playnite');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const last = status?.lastReportAt ? new Date(status.lastReportAt) : null;

  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <Gamepad2 size={18} className="text-accent" />
        <h2 className="font-display text-lg font-bold">Playnite (PC)</h2>
      </div>
      <p className="mt-2 text-sm text-muted">
        Lo que arrancás en Playnite pasa solo a Jugando ahora, cuando lo marcás como Superado o Completado te llega un aviso
        para puntuarlo (con las horas ya puestas), y en cada juego ves cuántas horas le llevás.
      </p>

      {!status ? (
        <Loader2 size={18} className="mt-3 animate-spin text-muted" />
      ) : status.connected && last ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm">
            Conectado: {status.games ?? 0} {status.games === 1 ? 'juego' : 'juegos'} de Playnite. Último aviso:{' '}
            {last.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
            {status.lastEvent === 'started' && status.lastGame
              ? ` (arrancaste ${status.lastGame})`
              : status.lastEvent === 'stopped' && status.lastGame
                ? ` (cerraste ${status.lastGame})`
                : status.lastEvent === 'library'
                  ? ` (al abrir Playnite, ${status.lastCount ?? 0} juegos)`
                  : ''}
            .
          </p>
          {(status.unmatched?.length ?? 0) > 0 && (
            <p className="text-xs text-muted">
              {status.matchError ? `El servidor no pudo buscar en RAWG (${status.matchError}): los busca la app cuando la abrís. ` : ''}
              No los encontré en el catálogo por ese nombre: {status.unmatched!.slice(0, 8).map((u) => u.name).join(', ')}
              {status.unmatched!.length > 8 ? '…' : ''}
            </p>
          )}
          <p className="text-xs text-muted">
            Para mandar todo ahora: en Playnite, menú Extensiones → GamesTracker → Enviar mis juegos ahora.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={download} disabled={busy} className="flex items-center justify-center gap-2 rounded-2xl bg-surface-2 py-3 text-sm font-semibold disabled:opacity-50">
              <Download size={16} /> Bajar de nuevo
            </button>
            <button
              onClick={() => confirm('¿Desconectar Playnite? La extensión deja de funcionar hasta que la bajes de nuevo.') && void disconnectPlaynite()}
              className="rounded-2xl bg-surface-2 py-3 text-sm font-semibold text-muted hover:text-white"
            >
              Desconectar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Bajá la extensión desde la PC donde tenés Playnite.</li>
            <li>Abrí GamesTracker.pext: Playnite pregunta si la instala, decile que sí y reinicialo.</li>
            <li>Listo: al abrir Playnite manda tus juegos, y cada vez que jugás, avisa solo.</li>
          </ol>
          {status.connected && (
            <p className="mb-2 text-xs text-muted">
              Todavía no llegó nada de Playnite. Si ya la instalaste, en Playnite andá a Extensiones → GamesTracker → Enviar
              mis juegos ahora: te muestra si llegó o cuál es el error. Si no aparece ese menú, bajala de nuevo e instalala.
            </p>
          )}
          <button
            onClick={download}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Bajar la extensión
          </button>
        </div>
      )}
    </section>
  );
}
