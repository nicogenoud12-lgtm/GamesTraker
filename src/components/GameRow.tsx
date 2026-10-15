import { Check, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import Cover from './Cover';
import { ScoreBadge } from './Score';
import { shortPlatforms, year } from '../lib/format';
import type { Game } from '../lib/types';
import { NEXT_LIST_ID, useStore } from '../store/useStore';
import { useToast } from '../store/useToast';

export default function GameRow({ game }: { game: Game }) {
  const rating = useStore((s) => s.ratings[game.id]);
  const queued = useStore((s) => s.lists.find((l) => l.id === NEXT_LIST_ID)?.gameIds.includes(game.id) ?? false);
  const addToList = useStore((s) => s.addToList);
  const removeFromList = useStore((s) => s.removeFromList);
  const rememberGame = useStore((s) => s.rememberGame);
  const toast = useToast((s) => s.show);

  const toggleQueue = () => {
    if (queued) {
      removeFromList(NEXT_LIST_ID, game.id);
      toast('Quitado de Próximos');
    } else {
      addToList(NEXT_LIST_ID, game);
      toast('Agregado a Próximos a jugar');
    }
  };

  return (
    <li className="flex items-center gap-3 py-2">
      <Link to={`/juego/${encodeURIComponent(game.id)}`} onClick={() => rememberGame(game)} className="flex min-w-0 flex-1 items-center gap-3">
        <Cover game={game} className="h-[72px] w-[54px] shrink-0 rounded-lg text-[9px]" showTitle={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{game.name}</p>
          <p className="truncate text-sm text-muted">
            {[year(game.released), shortPlatforms(game.platforms, 2)].filter(Boolean).join(' · ')}
          </p>
          {game.genres.length > 0 && <p className="truncate text-xs text-muted/70">{game.genres.slice(0, 3).join(', ')}</p>}
        </div>
      </Link>
      {rating ? (
        <ScoreBadge score={rating.score} />
      ) : (
        <button
          onClick={toggleQueue}
          aria-label={queued ? 'Quitar de Próximos' : 'Agregar a Próximos'}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90 ${queued ? 'bg-accent text-black' : 'bg-white/8 text-white'}`}
        >
          {queued ? <Check size={18} strokeWidth={3} /> : <Plus size={18} />}
        </button>
      )}
    </li>
  );
}
