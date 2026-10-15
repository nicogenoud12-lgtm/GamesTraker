import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useNotices } from '../lib/social';
import { useSync } from '../store/useSync';

/** Round "Amigos" button with the number of unread notifications. */
export default function FriendsButton({ className = '' }: { className?: string }) {
  const loggedIn = useSync((s) => Boolean(s.token));
  const unread = useNotices((s) => s.unread);
  if (!loggedIn) return null;
  return (
    <Link to="/amigos" aria-label={unread ? `Amigos, ${unread} avisos nuevos` : 'Amigos'} className={`relative rounded-full bg-white/10 p-2.5 backdrop-blur ${className}`}>
      <Users size={18} />
      {unread > 0 && <Badge n={unread} className="absolute -top-1 -right-1" />}
    </Link>
  );
}

export function Badge({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white tabular-nums ${className}`}>
      {n > 9 ? '9+' : n}
    </span>
  );
}
