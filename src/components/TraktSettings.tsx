import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, MonitorPlay, RefreshCw } from 'lucide-react';
import { checkTraktNow, disconnectTrakt, pollTrakt, refreshTrakt, startTrakt, useTrakt } from '../lib/trakt';
import { useToast } from '../store/useToast';

/** Settings → Nuvio: connect Trakt so finished movies and series ask to be rated. */
export default function TraktSettings() {
  const status = useTrakt((s) => s.status);
  const toast = useToast((s) => s.show);
  const [code, setCode] = useState<{ userCode: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    void refreshTrakt();
    return () => clearTimeout(timer.current);
  }, []);

  const connect = async () => {
    setBusy(true);
    try {
      const d = await startTrakt();
      setCode({ userCode: d.userCode, url: d.url });
      const until = Date.now() + d.expiresIn * 1000;
      const poll = async () => {
        if (Date.now() > until) {
          setCode(null);
          return toast('Se venció el código, probá de nuevo');
        }
        const r = await pollTrakt().catch(() => ({ status: 'pending' as const }));
        if (r.status === 'connected') {
          setCode(null);
          await refreshTrakt();
          return toast('Trakt conectado');
        }
        if (r.status === 'denied' || r.status === 'expired') {
          setCode(null);
          return toast(r.status === 'denied' ? 'No se autorizó en Trakt' : 'Se venció el código, probá de nuevo');
        }
        timer.current = setTimeout(poll, Math.max(1, d.interval) * 1000);
      };
      timer.current = setTimeout(poll, Math.max(1, d.interval) * 1000);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true);
    try {
      await checkTraktNow();
      toast('Listo, revisado');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <MonitorPlay size={18} className="text-accent" />
        <h2 className="font-display text-lg font-bold">Nuvio (con Trakt)</h2>
      </div>
      <p className="mt-2 text-sm text-muted">
        Cuando terminás una película o una serie entera en Nuvio, te llega un aviso para puntuarla. Nuvio lo anota en
        Trakt y la app lo lee de ahí.
      </p>

      {!status ? (
        <Loader2 size={18} className="mt-3 animate-spin text-muted" />
      ) : !status.enabled ? (
        <p className="mt-3 rounded-2xl bg-surface-2 p-4 text-sm text-muted">
          Falta configurar Trakt en el servidor (TRAKT_CLIENT_ID y TRAKT_CLIENT_SECRET en el .env). Los pasos están en el
          README.
        </p>
      ) : code ? (
        <div className="mt-3 rounded-2xl bg-surface-2 p-4 text-center">
          <p className="text-sm text-muted">Entrá a</p>
          <a href={code.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent">
            {code.url.replace(/^https?:\/\//, '')} <ExternalLink size={14} />
          </a>
          <p className="mt-2 text-sm text-muted">y poné este código:</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-[0.2em] select-all">{code.userCode}</p>
          <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted">
            <Loader2 size={14} className="animate-spin" /> Esperando que lo autorices…
          </p>
        </div>
      ) : status.connected && !status.broken ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm">
            Conectado{status.account ? (
              <>
                {' '}
                como <span className="font-semibold">{status.account}</span>
              </>
            ) : null}
            . Se revisa solo cada 10 minutos.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={check} disabled={busy} className="flex items-center justify-center gap-2 rounded-2xl bg-surface-2 py-3 text-sm font-semibold disabled:opacity-50">
              <RefreshCw size={16} /> Revisar ahora
            </button>
            <button
              onClick={() => confirm('¿Desconectar Trakt?') && void disconnectTrakt()}
              className="rounded-2xl bg-surface-2 py-3 text-sm font-semibold text-muted hover:text-white"
            >
              Desconectar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          {status.broken && <p className="mb-2 text-sm text-rose-400">Trakt cerró la sesión. Conectalo de nuevo.</p>}
          <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>En Nuvio: Ajustes → Trakt → iniciá sesión con tu cuenta de Trakt.</li>
            <li>Acá: tocá Conectar y autorizá con la misma cuenta.</li>
            <li>Prendé las notificaciones en Ajustes → Amigos → "Notificaciones en este dispositivo".</li>
          </ol>
          <button
            onClick={connect}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null} Conectar con Trakt
          </button>
        </div>
      )}
    </section>
  );
}
