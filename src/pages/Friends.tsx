import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bell, Copy, EyeOff, Loader2, Share2, UserMinus, UserPlus, Users } from 'lucide-react';
import type { FriendSummary } from '../lib/social';
import Cover from '../components/Cover';
import { ScoreBadge } from '../components/Score';
import { MODES, modeOf } from '../lib/mode';
import {
  addFriend,
  friendFeed,
  getFriends,
  inviteUrl,
  markNoticesSeen,
  refreshNotices,
  removeFriend,
  shareWith,
  timeAgo,
  useNotices,
  type FeedItem,
  type FriendsOverview,
} from '../lib/social';
import { TIER_BY_ID } from '../lib/tiers';
import { useStore } from '../store/useStore';
import { useSync } from '../store/useSync';
import { useToast } from '../store/useToast';
import { useMode } from '../store/useUi';

/** Friends' ratings: who your friends are, what they rated lately and the notifications. */
export default function Friends() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const loggedIn = useSync((s) => Boolean(s.token));
  const mode = useMode();
  const copy = MODES[mode];
  const toast = useToast((s) => s.show);
  const [overview, setOverview] = useState<FriendsOverview | null>(null);
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notices = useNotices((s) => s.items);
  const unread = useNotices((s) => s.unread);
  // What was unread when the page opened stays highlighted while it is open.
  const seenBefore = useRef<number | null>(null);

  const load = () => {
    getFriends()
      .then(setOverview)
      .catch((e: Error) => setError(e.message));
    friendFeed()
      .then(setFeed)
      .catch(() => setFeed([]));
  };

  // Someone opened a friend's invite link.
  const code = params.get('agregar');
  useEffect(() => {
    if (!code) return;
    if (!loggedIn) {
      navigate(`/cuenta?invitacion=${encodeURIComponent(code)}`, { replace: true });
      return;
    }
    addFriend(code)
      .then((r) => {
        toast(`Ahora sos amigo de ${r.username}. Elegí si compartirle tus puntajes.`);
        load();
      })
      .catch((e: Error) => toast(e.message))
      .finally(() => setParams({}, { replace: true }));
  }, [code, loggedIn]);

  useEffect(() => {
    if (!loggedIn || code) return;
    load();
    void refreshNotices().then(() => {
      if (seenBefore.current == null) seenBefore.current = useNotices.getState().unread;
      void markNoticesSeen();
    });
  }, [loggedIn]);

  if (!loggedIn) {
    return (
      <Shell onBack={() => navigate(-1)}>
        <div className="mt-6 rounded-3xl border border-line bg-surface p-6 text-center">
          <Users className="mx-auto text-accent" size={32} />
          <p className="mt-3 font-semibold">Iniciá sesión para ver los puntajes de tus amigos</p>
          <Link to="/cuenta" className="mt-4 inline-block rounded-full bg-white px-5 py-2.5 font-semibold text-black">
            Iniciar sesión
          </Link>
        </div>
      </Shell>
    );
  }

  const link = overview ? inviteUrl(overview.code) : '';
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copiado');
    } catch {
      toast(link);
    }
  };
  const shareLink = () =>
    navigator.share?.({ title: `${copy.brand}Tracker`, text: 'Sumate para ver qué puntuamos', url: link }).catch(() => {});

  const items = (feed ?? []).filter((i) => modeOf(i.game.id) === mode);
  const modeNotices = notices.filter((n) => modeOf(n.game.id) === mode);
  const freshCount = seenBefore.current ?? unread;

  return (
    <Shell onBack={() => navigate(-1)}>
      {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}

      {/* Invite */}
      <section className="mt-5 rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/15 to-accent-2/10 p-4">
        <p className="flex items-center gap-2 font-semibold">
          <UserPlus size={18} className="text-accent" /> Invitá a tus amigos
        </p>
        <p className="mt-1 text-sm text-muted">
          Con este link se crean una cuenta (o entran con la suya) y quedan como amigos: van a ver lo que puntúa cada uno.
        </p>
        {overview ? (
          <div className="mt-3 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate rounded-xl bg-black/30 px-3 py-2 text-xs text-white/80">{link}</span>
            <button onClick={copyLink} aria-label="Copiar link de invitación" className="rounded-xl bg-white/10 p-2.5">
              <Copy size={16} />
            </button>
            {typeof navigator.share === 'function' && (
              <button onClick={shareLink} aria-label="Compartir link de invitación" className="rounded-xl bg-white/10 p-2.5">
                <Share2 size={16} />
              </button>
            )}
          </div>
        ) : (
          <Loader2 size={18} className="mt-3 animate-spin text-muted" />
        )}
      </section>

      {/* Notifications */}
      {modeNotices.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold">
            <Bell size={18} className="text-accent" /> Avisos
          </h2>
          <ul className="space-y-1.5">
            {modeNotices.slice(0, 10).map((n) => (
              <ActivityRow key={n.id} item={n} fresh={notices.indexOf(n) < freshCount} />
            ))}
          </ul>
        </section>
      )}

      {/* Friends */}
      <section className="mt-6">
        <h2 className="mb-2 font-display text-lg font-bold">Tus amigos</h2>
        {!overview ? (
          <Loader2 className="animate-spin text-muted" />
        ) : overview.friends.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
            Todavía no tenés amigos acá. Mandales el link de arriba.
          </p>
        ) : (
          <ul className="divide-y divide-white/5 rounded-3xl border border-line bg-surface">
            {overview.friends.map((f) => (
              <FriendRow
                key={f.username}
                friend={f}
                profileTo={`/p/${encodeURIComponent(f.username)}?modo=${mode === 'games' ? 'juegos' : 'series-y-pelis'}`}
                statsText={
                  f[mode]?.count
                    ? `${f[mode]!.count} ${f[mode]!.count === 1 ? copy.item : copy.items} · promedio ${f[mode]!.average}`
                    : `Todavía no puntuó ${copy.items}`
                }
                onChanged={load}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Latest */}
      {items.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-display text-lg font-bold">Lo último que puntuaron</h2>
          <ul className="space-y-1.5">
            {items.slice(0, 40).map((i) => (
              <ActivityRow key={`${i.username}:${i.game.id}`} item={i} />
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-center text-xs text-muted">
        Con quién compartís lo elegís acá, uno por uno. Los avisos se prenden en{' '}
        <Link to="/ajustes" className="font-semibold text-accent">
          Ajustes
        </Link>
        .
      </p>
    </Shell>
  );
}

function Shell({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  return (
    <div className="pt-safe px-5 pb-10 lg:px-0 lg:pt-8">
      <button onClick={onBack} aria-label="Volver" className="mt-4 rounded-full bg-white/5 p-2.5 lg:hidden">
        <ArrowLeft size={20} />
      </button>
      <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">Amigos</h1>
      <p className="mt-1 text-sm text-muted">Qué puntuaron tus amigos.</p>
      <div className="lg:max-w-2xl">{children}</div>
    </div>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  // A stable color per person.
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-display font-bold text-black uppercase"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(135deg, hsl(${hue} 80% 70%), hsl(${(hue + 40) % 360} 80% 60%))` }}
    >
      {name[0]}
    </span>
  );
}

/** One friend: what they share with me, and whether I share with them. */
function FriendRow({ friend: f, profileTo, statsText, onChanged }: { friend: FriendSummary; profileTo: string; statsText: string; onChanged: () => void }) {
  const toast = useToast((s) => s.show);
  const [iShare, setIShare] = useState(f.iShare);
  const [busy, setBusy] = useState(false);
  useEffect(() => setIShare(f.iShare), [f.iShare]);

  const toggle = async () => {
    setBusy(true);
    try {
      const r = await shareWith(f.username, !iShare);
      setIShare(r.iShare);
      toast(r.iShare ? `${f.username} ahora ve tus puntajes` : `${f.username} ya no ve tus puntajes`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="p-3">
      <div className="flex items-center gap-3">
        <Avatar name={f.username} />
        {f.shares ? (
          <Link to={profileTo} className="min-w-0 flex-1">
            <p className="truncate font-semibold">{f.username}</p>
            <p className="text-xs text-muted">{statsText}</p>
          </Link>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{f.username}</p>
            <p className="flex items-center gap-1 text-xs text-muted">
              <EyeOff size={12} /> No te comparte sus puntajes
            </p>
          </div>
        )}
        <button
          aria-label={`Dejar de ser amigo de ${f.username}`}
          onClick={() => {
            if (!confirm(`¿Dejar de ser amigo de ${f.username}? Ninguno va a ver los puntajes del otro.`)) return;
            removeFriend(f.username)
              .then(onChanged)
              .catch((e: Error) => toast(e.message));
          }}
          className="rounded-full p-2 text-muted hover:bg-white/5 hover:text-white"
        >
          <UserMinus size={16} />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 sm:ml-[52px]">
        <span className="text-xs text-muted">Compartirle mis puntajes</span>
        <button
          role="switch"
          aria-checked={iShare}
          aria-label={`Compartir mis puntajes con ${f.username}`}
          onClick={toggle}
          disabled={busy}
          className={`relative h-6 w-10 shrink-0 rounded-full transition disabled:opacity-60 ${iShare ? 'bg-accent' : 'bg-white/15'}`}
        >
          <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${iShare ? 'translate-x-4' : ''}`} />
        </button>
      </div>
    </li>
  );
}

function ActivityRow({ item, fresh = false }: { item: FeedItem; fresh?: boolean }) {
  const mine = useStore((s) => s.ratings[item.game.id]?.score);
  const rememberGame = useStore((s) => s.rememberGame);
  const tier = TIER_BY_ID[item.tier];
  return (
    <li>
      <Link
        to={`/juego/${encodeURIComponent(item.game.id)}`}
        onClick={() => !useStore.getState().games[item.game.id] && rememberGame(item.game)}
        className={`flex items-center gap-3 rounded-2xl border p-2.5 transition hover:border-white/20 ${fresh ? 'border-accent/40 bg-accent/10' : 'border-line bg-surface'}`}
      >
        <Cover game={item.game} className="aspect-[3/4] w-11 shrink-0 rounded-lg" showTitle={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            <span className="font-semibold">{item.username}</span> le puso <span className="font-semibold">{item.score}</span> a{' '}
            <span className="font-semibold">{item.game.name}</span>
          </p>
          <p className="text-xs text-muted">
            {tier ? `${tier.emoji} ${tier.label} · ` : ''}
            {timeAgo(item.at)}
            {mine != null && ` · vos le pusiste ${mine}`}
          </p>
        </div>
        <ScoreBadge score={item.score} />
      </Link>
    </li>
  );
}
