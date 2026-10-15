import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import GameCard, { GameCardSkeleton } from './GameCard';
import type { Game } from '../lib/types';

interface Props {
  title: string;
  subtitle?: string;
  games: Game[] | null;
  error?: string | null;
  more?: string;
}

/** Horizontal row of game covers with a "see all" link. Hidden when empty. */
export default function GameRail({ title, subtitle, games, error, more }: Props) {
  if (games && games.length === 0 && !error) return null;
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-end justify-between gap-3 px-5">
        <div className="min-w-0">
          <h2 className="font-display text-lg leading-tight font-bold">{title}</h2>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        {more && (
          <Link to={more} className="flex shrink-0 items-center text-sm text-muted">
            Ver todo <ChevronRight size={16} />
          </Link>
        )}
      </div>
      {error ? (
        <p className="px-5 text-sm text-rose-400">{error}</p>
      ) : (
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1">
          {games ? games.map((g) => <GameCard key={g.id} game={g} />) : Array.from({ length: 4 }, (_, i) => <GameCardSkeleton key={i} />)}
        </div>
      )}
    </section>
  );
}
