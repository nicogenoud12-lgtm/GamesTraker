import { Link } from 'react-router-dom';
import Cover from './Cover';
import { ScoreBadge } from './Score';
import { year } from '../lib/format';
import type { Game } from '../lib/types';
import { useStore } from '../store/useStore';

export default function GameCard({ game }: { game: Game }) {
  const rating = useStore((s) => s.ratings[game.id]);
  const rememberGame = useStore((s) => s.rememberGame);
  return (
    <Link to={`/juego/${encodeURIComponent(game.id)}`} onClick={() => rememberGame(game)} className="block w-32 shrink-0">
      <div className="relative">
        <Cover game={game} className="aspect-[3/4] rounded-2xl text-xs" />
        {rating ? (
          <span className="absolute top-1.5 right-1.5 rounded-lg bg-black/75 backdrop-blur">
            <ScoreBadge score={rating.score} />
          </span>
        ) : (
          game.metacritic != null && (
            <span className="absolute top-1.5 right-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-bold text-emerald-300 backdrop-blur">
              {game.metacritic}
            </span>
          )
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm leading-tight font-medium">{game.name}</p>
      <p className="mt-0.5 text-xs text-muted">{[year(game.released), game.genres[0]].filter(Boolean).join(' · ')}</p>
    </Link>
  );
}

export function GameCardSkeleton() {
  return (
    <div className="w-32 shrink-0 animate-pulse">
      <div className="aspect-[3/4] rounded-2xl bg-surface-2" />
      <div className="mt-2 h-3 w-24 rounded bg-surface-2" />
      <div className="mt-1.5 h-2.5 w-16 rounded bg-surface-2" />
    </div>
  );
}
