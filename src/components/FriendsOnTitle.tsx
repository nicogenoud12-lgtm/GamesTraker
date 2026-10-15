import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { ScoreBadge } from './Score';
import { Avatar } from '../pages/Friends';
import { friendRatings, type FriendRating } from '../lib/social';
import { TIER_BY_ID } from '../lib/tiers';
import { useSync } from '../store/useSync';

/** On a title's page: what each friend gave it (only friends who share their ratings). */
export default function FriendsOnTitle({ gameId }: { gameId: string }) {
  const loggedIn = useSync((s) => Boolean(s.token));
  const [ratings, setRatings] = useState<FriendRating[]>([]);

  useEffect(() => {
    setRatings([]);
    if (!loggedIn) return;
    let alive = true;
    friendRatings(gameId)
      .then((r) => alive && setRatings(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [gameId, loggedIn]);

  if (!ratings.length) return null;
  const average = Math.round(ratings.reduce((n, r) => n + r.score, 0) / ratings.length);
  return (
    <section className="mt-3 rounded-3xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Users size={16} className="text-accent" /> Tus amigos
          {ratings.length > 1 && <span className="font-normal text-muted">· promedio {average}</span>}
        </p>
        <Link to="/amigos" className="text-xs font-semibold text-accent">
          Ver amigos
        </Link>
      </div>
      <ul className="mt-2 space-y-1.5">
        {ratings.map((r) => {
          const tier = TIER_BY_ID[r.tier];
          return (
            <li key={r.username} className="flex items-center gap-2.5">
              <Avatar name={r.username} size={28} />
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-semibold">{r.username}</span>
                {tier && <span className="text-muted"> · {tier.emoji} {tier.label}</span>}
              </span>
              <ScoreBadge score={r.score} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
