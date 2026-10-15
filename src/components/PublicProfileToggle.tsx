import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Globe, Loader2, Share2 } from 'lucide-react';
import { getProfile, profileUrl, setProfilePublic } from '../lib/sync';
import { useToast } from '../store/useToast';

/** Settings switch for the read-only public profile, with its link to share. */
export default function PublicProfileToggle({ username }: { username: string }) {
  const toast = useToast((s) => s.show);
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getProfile()
      .then((p) => alive && setOn(p.public))
      .catch(() => alive && setOn(false));
    return () => {
      alive = false;
    };
  }, [username]);

  const toggle = async () => {
    if (on == null) return;
    setBusy(true);
    try {
      const p = await setProfilePublic(!on);
      setOn(p.public);
      toast(p.public ? 'Tu perfil ahora es público' : 'Tu perfil ya no es público');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const url = profileUrl(username);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copiado');
    } catch {
      toast(url);
    }
  };
  const share = () => navigator.share?.({ title: `Perfil de ${username}`, url }).catch(() => {});

  return (
    <div className="mt-4 rounded-2xl bg-surface-2 p-4">
      <div className="flex items-center gap-3">
        <Globe size={18} className="shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Link a tu escala</p>
          <p className="text-xs text-muted">
            Un link de solo lectura con lo que puntuaste, siempre actualizado. No muestra listas, notas ni plataformas. También lo compartís desde Mis juegos → Compartir.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={Boolean(on)}
          aria-label="Perfil público"
          onClick={toggle}
          disabled={on == null || busy}
          className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${on ? 'bg-accent' : 'bg-white/15'}`}
        >
          {busy || on == null ? (
            <Loader2 size={14} className="absolute inset-0 m-auto animate-spin" />
          ) : (
            <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
          )}
        </button>
      </div>
      {on && (
        <div className="mt-3 flex items-center gap-2">
          <Link to={`/p/${encodeURIComponent(username)}`} className="min-w-0 flex-1 truncate rounded-xl bg-black/30 px-3 py-2 text-xs text-white/80">
            {url}
          </Link>
          <button onClick={copy} aria-label="Copiar link" className="rounded-xl bg-white/10 p-2.5">
            <Copy size={16} />
          </button>
          {typeof navigator.share === 'function' && (
            <button onClick={share} aria-label="Compartir link" className="rounded-xl bg-white/10 p-2.5">
              <Share2 size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
