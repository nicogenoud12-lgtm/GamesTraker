import { Check, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import Cover from './Cover';
import { ScoreBadge } from './Score';
import { shortPlatforms, year } from '../lib/format';
import type { Game } from '../lib/types';
import { KIND_LABEL, MODES, kindOf, modeOf } from '../lib/mode';
import { useStore } from '../store/useStore';
import { useToast } from '../store/useToast';

export default function GameRow({ game, rank }: { game: Game; rank?: number }) {
  const copy = MODES[modeOf(game.id)];
  const nextId = copy.nextListId;
  const kind = kindOf(game.id);
  const rating = useStore((s) => s.ratings[game.id]);
  const queued = useStore((s) => s.lists.find((l) => l.id === nextId)?.gameIds.includes(game.id) ?? false);
  const addToList = useStore((s) => s.addToList);
  const removeFromList = useStore((s) => s.removeFromList);
  const rememberGame = useStore((s) => s.rememberGame);
  const toast = useToast((s) => s.show);

  const toggleQueue = () => {
    if (queued) {
      removeFromList(nextId, game.id);
      toast(`Quitado de ${copy.nextLabel}`);
    } else {
      addToList(nextId, game);
      toast(`Agregado a ${copy.nextLabel}`);
    }
  };

  return (
    <li className="flex items-center gap-3 py-2 lg:-mx-2 lg:rounded-xl lg:px-2 lg:transition lg:hover:bg-white/[0.03]">
      {rank != null && (
        <span className="-mr-1 w-6 shrink-0 text-center font-display text-sm font-bold text-muted tabular-nums">{rank}</span>
      )}
      <Link to={`/juego/${encodeURIComponent(game.id)}`} onClick={() => rememberGame(game)} className="flex min-w-0 flex-1 items-center gap-3">
        <Cover game={game} className="h-[72px] w-[54px] shrink-0 rounded-lg text-[9px]" showTitle={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{game.name}</p>
          <p className="truncate text-sm text-muted">
            {[kind ? KIND_LABEL[kind] : null, year(game.released), shortPlatforms(game.platforms, 2)].filter(Boolean).join(' · ')}
          </p>
          {(game.genres.length > 0 || game.metacritic != null) && (
            <p className="truncate text-xs text-muted/70">
              {game.metacritic != null && <span className="mr-1.5 font-semibold text-emerald-300">
                  {kind ? '★' : 'MC'} {game.metacritic}
                </span>}
              {game.genres.slice(0, 3).join(', ')}
            </p>
          )}
        </div>
      </Link>
      {rating ? (
        <ScoreBadge score={rating.score} />
      ) : (
        <button
          onClick={toggleQueue}
          aria-label={queued ? `Quitar de ${copy.nextLabel}` : `Agregar a ${copy.nextLabel}`}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90 ${queued ? 'bg-accent text-black' : 'bg-white/8 text-white'}`}
        >
          {queued ? <Check size={18} strokeWidth={3} /> : <Plus size={18} />}
        </button>
      )}
    </li>
  );
}
