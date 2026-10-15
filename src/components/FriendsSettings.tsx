import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellRing, ChevronRight, Eye, Loader2, Users } from 'lucide-react';
import { disablePush, enablePush, getFriends, pushEnabled, saveSocialSettings } from '../lib/social';
import { useSync } from '../store/useSync';
import { useToast } from '../store/useToast';

/** Settings → Amigos: what friends see, whether they get notified, and notifications on this device. */
export default function FriendsSettings() {
  const toast = useToast((s) => s.show);
  const username = useSync((s) => s.username);
  const [settings, setSettings] = useState<{ shareRatings: boolean; announce: boolean } | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [push, setPush] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getFriends()
      .then((o) => {
        setSettings({ shareRatings: o.shareRatings, announce: o.announce });
        setCount(o.friends.length);
      })
      .catch(() => setSettings(null));
    pushEnabled()
      .then(setPush)
      .catch(() => setPush(false));
  }, []);

  const save = async (patch: { shareRatings?: boolean; announce?: boolean }, key: string) => {
    setBusy(key);
    try {
      setSettings(await saveSocialSettings(patch));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const togglePush = async () => {
    setBusy('push');
    try {
      if (push) {
        await disablePush();
        setPush(false);
        toast('Listo, no te van a llegar avisos en este dispositivo');
      } else {
        await enablePush();
        setPush(true);
        toast('Te van a llegar los avisos de tus amigos acá');
      }
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <Users size={18} className="text-accent" />
        <h2 className="font-display text-lg font-bold">Amigos</h2>
      </div>
      <Link to="/amigos" className="mt-3 flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-sm font-semibold">
        <span>{count == null ? 'Tus amigos e invitaciones' : count ? `Tus amigos (${count}) e invitaciones` : 'Invitá a tus amigos'}</span>
        <ChevronRight size={18} className="text-muted" />
      </Link>
      {settings ? (
        <div className="mt-2 divide-y divide-white/5">
          <Toggle
            icon={<Eye size={18} />}
            title="Mis amigos ven mis puntajes"
            text="Lo que puntuás aparece en la sección Amigos y en cada ficha. Nunca se ven tus notas."
            on={settings.shareRatings}
            busy={busy === 'share'}
            onChange={() => save({ shareRatings: !settings.shareRatings }, 'share')}
          />
          <Toggle
            icon={<BellRing size={18} />}
            title="Avisarles cuando puntúo algo"
            text={`Les llega "${username} le puso 92 a Hades" a los amigos que tengan las notificaciones prendidas.`}
            on={settings.announce}
            busy={busy === 'announce'}
            onChange={() => save({ announce: !settings.announce }, 'announce')}
          />
          <Toggle
            icon={<Bell size={18} />}
            title="Notificaciones en este dispositivo"
            text="Para recibir acá los avisos de tus amigos. En iPhone, primero agregá la app a la pantalla de inicio."
            on={Boolean(push)}
            busy={busy === 'push' || push == null}
            onChange={togglePush}
          />
        </div>
      ) : (
        <Loader2 size={18} className="mt-3 animate-spin text-muted" />
      )}
    </section>
  );
}

function Toggle(props: { icon: ReactNode; title: string; text: string; on: boolean; busy: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="shrink-0 text-accent">{props.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{props.title}</p>
        <p className="text-xs text-muted">{props.text}</p>
      </div>
      <button
        role="switch"
        aria-checked={props.on}
        aria-label={props.title}
        onClick={props.onChange}
        disabled={props.busy}
        className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60 ${props.on ? 'bg-accent' : 'bg-white/15'}`}
      >
        {props.busy ? (
          <Loader2 size={14} className="absolute inset-0 m-auto animate-spin" />
        ) : (
          <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${props.on ? 'translate-x-5' : ''}`} />
        )}
      </button>
    </div>
  );
}
