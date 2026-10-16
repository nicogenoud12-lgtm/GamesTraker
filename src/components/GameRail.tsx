import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import GameCard, { GameCardSkeleton } from './GameCard';
import ScrollRow from './ScrollRow';
import { useFitWidth } from '../lib/useFitWidth';
import { useIsDesktop } from '../lib/useMedia';
import type { Game } from '../lib/types';

interface Props {
  title: string;
  subtitle?: string;
  games: Game[] | null;
  error?: string | null;
  more?: string;
  /** Per-game line shown instead of year · genre (e.g. why it was recommended). */
  notes?: Record<string, string>;
}

/** Horizontal row of game covers with a "see all" link. Hidden when empty. */
/** Padding and gap of the row (`px-5`, `gap-3`), in px. */
const ROW_PAD = 20;
const ROW_GAP = 12;

export default function GameRail({ title, subtitle, games, error, more, notes }: Props) {
  // On desktop the covers share the row evenly (8 on a wide screen); the next one peeks into the padding, blurred.
  const [ref, width] = useFitWidth({ min: useIsDesktop() ? 136 : null, gap: ROW_GAP, inset: 2 * ROW_PAD, active: !error });
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
        <div ref={ref}>
          <ScrollRow className="flex gap-3 px-5 pb-1" edgeBlur>
            {games
              ? games.map((g) => <GameCard key={g.id} game={g} note={notes?.[g.id]} width={width} />)
              : Array.from({ length: 4 }, (_, i) => <GameCardSkeleton key={i} />)}
          </ScrollRow>
        </div>
      )}
    </section>
  );
}
