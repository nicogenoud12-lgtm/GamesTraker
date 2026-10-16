import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import Cover from './Cover';
import { ScoreBadge } from './Score';
import { year } from '../lib/format';
import type { Game } from '../lib/types';
import { useStore } from '../store/useStore';
import ListIcon from './ListIcon';
import { scoresOf } from '../lib/scores';

/** At most this many list badges on a cover; the rest are in the tooltip. */
const MAX_BADGES = 2;

export default function GameCard({ game, note, width }: { game: Game; note?: string; width?: number }) {
  const rating = useStore((s) => s.ratings[game.id]);
  const rememberGame = useStore((s) => s.rememberGame);
  const allLists = useStore((s) => s.lists);
  // The lists this title is already on, shown as their icons on the cover.
  const lists = useMemo(() => allLists.filter((l) => l.gameIds.includes(game.id)), [allLists, game.id]);
  const scores = scoresOf(game);
  return (
    <Link
      to={`/juego/${encodeURIComponent(game.id)}`}
      onClick={() => rememberGame(game)}
      className="group block w-32 shrink-0 lg:w-40"
      style={width ? { width } : undefined}
    >
      <div className="relative">
        <Cover game={game} className="aspect-[3/4] rounded-2xl text-xs transition duration-300 group-hover:-translate-y-1 group-hover:shadow-xl" />
        {lists.length > 0 && (
          <span className="absolute top-1.5 left-1.5 flex gap-1" title={`En ${lists.map((l) => l.name).join(', ')}`}>
            {lists.slice(0, MAX_BADGES).map((l) => (
              <ListIcon key={l.id} list={l} size="xs" />
            ))}
          </span>
        )}
        {rating ? (
          <span className="absolute top-1.5 right-1.5 rounded-lg bg-black/75 backdrop-blur">
            <ScoreBadge score={rating.score} />
          </span>
        ) : (
          (scores.critic != null || scores.users != null) && (
            <span className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1">
              {scores.critic != null && (
                <span
                  className="rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-bold text-emerald-300 backdrop-blur"
                  title={`Crítica (${scores.criticFrom})`}
                >
                  {scores.critic}
                </span>
              )}
              {scores.users != null && (
                <span
                  className="flex items-center gap-0.5 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-bold text-sky-300 backdrop-blur"
                  title={`${scores.usersFrom === 'TMDB' ? 'Público' : 'Jugadores'} (${scores.usersFrom})`}
                >
                  <Users size={11} strokeWidth={2.6} />
                  {scores.users}
                </span>
              )}
            </span>
          )
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm leading-tight font-medium">{game.name}</p>
      {note ? (
        <p className="mt-0.5 line-clamp-1 text-xs text-accent">{note}</p>
      ) : (
        <p className="mt-0.5 text-xs text-muted">{[year(game.released), game.genres[0]].filter(Boolean).join(' · ')}</p>
      )}
    </Link>
  );
}

export function GameCardSkeleton() {
  return (
    <div className="w-32 shrink-0 animate-pulse lg:w-40">
      <div className="aspect-[3/4] rounded-2xl bg-surface-2" />
      <div className="mt-2 h-3 w-24 rounded bg-surface-2" />
      <div className="mt-1.5 h-2.5 w-16 rounded bg-surface-2" />
    </div>
  );
}
