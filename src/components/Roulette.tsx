import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dices, Play } from 'lucide-react';
import Cover from './Cover';
import Sheet from './Sheet';
import { roughHours } from '../lib/durations';
import { kindOf, MODES, type Mode } from '../lib/mode';
import type { Game } from '../lib/types';
import { useStore } from '../store/useStore';
import { useToast } from '../store/useToast';

interface Filter {
  id: string;
  label: string;
  /** Whether a title fits; `hours` is null when unknown. */
  fits: (game: Game, hours: number | null) => boolean;
}

const any: Filter = { id: 'any', label: 'Cualquiera', fits: () => true };

const FILTERS: Record<Mode, Filter[]> = {
  games: [
    any,
    { id: 'short', label: 'Corto (hasta 10 h)', fits: (_, h) => h != null && h <= 10 },
    { id: 'mid', label: 'Mediano (10 a 30 h)', fits: (_, h) => h != null && h > 10 && h <= 30 },
    { id: 'long', label: 'Largo (más de 30 h)', fits: (_, h) => h != null && h > 30 },
  ],
  screen: [
    any,
    { id: 'movie', label: 'Una película', fits: (g) => kindOf(g.id) === 'movie' },
    { id: 'short-tv', label: 'Serie corta (hasta 10 h)', fits: (g, h) => kindOf(g.id) === 'tv' && h != null && h <= 10 },
    { id: 'long-tv', label: 'Serie larga', fits: (g, h) => kindOf(g.id) === 'tv' && (h == null || h > 10) },
  ],
};

/** Earlier in the (ordered) list means more wanted, so a bit more likely. */
function pickWeighted(games: Game[], order: string[]): Game {
  const weights = games.map((g) => 1 / Math.sqrt(order.indexOf(g.id) + 1));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < games.length; i++) {
    r -= weights[i];
    if (r <= 0) return games[i];
  }
  return games[games.length - 1];
}

interface Props {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  games: Game[];
  hours: Record<string, number | null>;
  /** Offer moving the winner to "playing/watching now"; otherwise the button opens it. */
  canStart?: boolean;
}

export default function Roulette({ open, onClose, mode, games, hours, canStart = true }: Props) {
  const copy = MODES[mode];
  const addToList = useStore((s) => s.addToList);
  const removeFromList = useStore((s) => s.removeFromList);
  const toast = useToast((s) => s.show);
  const [filter, setFilter] = useState('any');
  const [shown, setShown] = useState<Game | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Only the filters something on this list fits (a movies-only list gets no series filters).
  const filters = FILTERS[mode].filter((f) => f === any || games.some((g) => f.fits(g, hours[g.id] ?? null)));
  const active = filters.find((f) => f.id === filter) ?? any;
  const pool = games.filter((g) => active.fits(g, hours[g.id] ?? null));

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) {
      clearTimeout(timer.current);
      setSpinning(false);
      setShown(null);
    }
  }, [open]);

  const spin = () => {
    if (!pool.length) return;
    clearTimeout(timer.current);
    const winner = pickWeighted(pool, games.map((g) => g.id));
    setSpinning(true);
    // Flick through covers, slowing down, then land on the winner.
    let step = 0;
    const steps = Math.min(22, 8 + pool.length * 2);
    const tick = () => {
      step++;
      if (step >= steps) {
        setShown(winner);
        setSpinning(false);
        return;
      }
      setShown(pool[Math.floor(Math.random() * pool.length)]);
      timer.current = setTimeout(tick, 40 + step * step * 1.2);
    };
    tick();
  };

  const start = () => {
    if (!shown) return;
    addToList(copy.nowListId, shown);
    removeFromList(copy.nextListId, shown.id);
    toast(`${mode === 'games' ? '¡A jugar' : '¡A ver'} ${shown.name}!`);
    onClose();
  };

  const h = shown ? hours[shown.id] : null;

  return (
    <Sheet open={open} onClose={onClose} title={mode === 'games' ? '¿Qué juego hago ahora?' : '¿Qué veo ahora?'}>
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setFilter(f.id);
              setShown(null);
            }}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${filter === f.id ? 'border-accent bg-accent text-black' : 'border-line bg-surface hover:border-white/20'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col items-center">
        <div className={`w-40 transition ${spinning ? 'scale-95 blur-[1px]' : 'scale-100'}`}>
          {shown ? (
            <Cover game={shown} size={420} className="aspect-[3/4] rounded-2xl shadow-2xl" />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center rounded-2xl border border-dashed border-line text-muted">
              <Dices size={40} />
            </div>
          )}
        </div>
        <div className="mt-3 min-h-[3rem] text-center">
          {shown && !spinning ? (
            <>
              <Link to={`/juego/${encodeURIComponent(shown.id)}`} onClick={onClose} className="font-display text-xl font-bold">
                {shown.name}
              </Link>
              <p className="text-sm text-muted">{h != null ? `Te lleva unas ${roughHours(h)}` : 'Duración desconocida'}</p>
            </>
          ) : (
            <p className="pt-3 text-sm text-muted">
              {pool.length
                ? `${pool.length} ${pool.length === 1 ? copy.item : copy.items} en juego · los primeros de tu lista salen más`
                : 'Nada de tu lista entra en este filtro'}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={spin}
          disabled={!pool.length || spinning}
          className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 font-semibold disabled:opacity-40"
        >
          <Dices size={18} /> {shown ? 'Otra vez' : 'Girar'}
        </button>
        {canStart || !shown || spinning ? (
          <button
            onClick={start}
            disabled={!shown || spinning || !canStart}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-accent to-accent-2 py-3 font-semibold text-black disabled:opacity-40"
          >
            <Play size={18} /> {canStart ? copy.start : 'Ver ficha'}
          </button>
        ) : (
          <Link
            to={`/juego/${encodeURIComponent(shown.id)}`}
            onClick={onClose}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-accent to-accent-2 py-3 font-semibold text-black"
          >
            <Play size={18} /> Ver ficha
          </Link>
        )}
      </div>
    </Sheet>
  );
}
