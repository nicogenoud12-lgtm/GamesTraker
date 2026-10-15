import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Globe, Loader2, Share2 } from 'lucide-react';
import ShareSheet from './ShareSheet';
import { tierCard, type TierEntry } from '../lib/cards';
import type { Mode, ScreenKind } from '../lib/mode';
import { slug } from '../lib/shareImage';
import { getProfile, profileUrl, setProfilePublic } from '../lib/sync';
import { useSync } from '../store/useSync';
import { useToast } from '../store/useToast';

interface Props {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  kind: ScreenKind | null;
  entries: TierEntry[];
}

const WHAT: Record<string, string> = { games: 'juegos', screen: 'series y pelis', movie: 'películas', tv: 'series' };

/** Shares the tier list: as an image, and as a live link anyone can open. */
export default function TierShareSheet({ open, onClose, mode, kind, entries }: Props) {
  const what = WHAT[kind ?? mode];
  const average = entries.length ? Math.round(entries.reduce((n, e) => n + e.score, 0) / entries.length) : 0;
  return (
    <ShareSheet
      open={open}
      onClose={onClose}
      title="Compartir mi escala"
      filename={`escala-${slug(what)}.png`}
      render={() => tierCard(entries, mode, `Mi escala de ${what}`, `${entries.length} puntuados · promedio ${average}`)}
    >
      <ShareLink mode={mode} kind={kind} />
    </ShareSheet>
  );
}

function ShareLink({ mode, kind }: { mode: Mode; kind: ScreenKind | null }) {
  const username = useSync((s) => s.username);
  const loggedIn = useSync((s) => Boolean(s.token));
  const toast = useToast((s) => s.show);
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loggedIn) return;
    let alive = true;
    getProfile()
      .then((p) => alive && setIsPublic(p.public))
      .catch(() => alive && setIsPublic(false));
    return () => {
      alive = false;
    };
  }, [loggedIn]);

  if (!loggedIn) {
    return (
      <p className="mt-4 rounded-2xl bg-surface-2 p-4 text-sm text-muted">
        <Link to="/cuenta" className="font-semibold text-accent">
          Iniciá sesión
        </Link>{' '}
        para compartir también un link a tu escala, que se actualiza sola cada vez que puntuás algo.
      </p>
    );
  }

  const query = new URLSearchParams({ modo: mode === 'games' ? 'juegos' : 'series-y-pelis', ...(kind ? { tipo: kind === 'movie' ? 'pelis' : 'series' } : {}) });
  const url = profileUrl(username, query.toString());
  const publish = async () => {
    setBusy(true);
    try {
      setIsPublic((await setProfilePublic(true)).public);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copiado');
    } catch {
      toast(url);
    }
  };

  return (
    <div className="mt-4 rounded-2xl bg-surface-2 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Globe size={16} className="text-accent" /> Link a tu escala
      </p>
      <p className="mt-1 text-xs text-muted">Quien lo abra ve lo que puntuaste, siempre actualizado. No muestra tus notas ni tus listas.</p>
      {isPublic == null ? (
        <Loader2 size={18} className="mt-3 animate-spin text-muted" />
      ) : isPublic ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate rounded-xl bg-black/30 px-3 py-2 text-xs text-white/80">{url}</span>
          <button onClick={copy} aria-label="Copiar link" className="rounded-xl bg-white/10 p-2.5">
            <Copy size={16} />
          </button>
          {typeof navigator.share === 'function' && (
            <button
              onClick={() => navigator.share({ title: 'Mi escala', url }).catch(() => {})}
              aria-label="Compartir link"
              className="rounded-xl bg-white/10 p-2.5"
            >
              <Share2 size={16} />
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={publish}
          disabled={busy}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />} Crear el link
        </button>
      )}
    </div>
  );
}
