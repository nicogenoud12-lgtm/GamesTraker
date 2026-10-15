import { Link } from 'react-router-dom';
import { ChevronRight, Sparkles } from 'lucide-react';
import { MODES, modeOf } from '../lib/mode';
import { whenRated } from '../lib/stats';
import { useStore } from '../store/useStore';
import { useMode } from '../store/useUi';

/** Link to this year's review, with the yearly goal's progress when there is one. */
export default function YearLink({ className = '' }: { className?: string }) {
  const mode = useMode();
  const year = new Date().getFullYear();
  const goal = useStore((s) => s.goals[`${mode}-${year}`]?.target);
  const done = useStore(
    (s) => Object.values(s.ratings).filter((r) => s.games[r.gameId] && modeOf(r.gameId) === mode && whenRated(r).year === year).length,
  );
  return (
    <Link
      to="/resumen"
      className={`flex items-center gap-3 rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/15 to-accent-2/10 p-4 transition hover:border-accent/60 ${className}`}
    >
      <Sparkles className="shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="font-display font-bold">Tu {year} en {mode === 'games' ? 'juegos' : 'series y pelis'}</p>
        {goal ? (
          <>
            <p className="text-xs text-muted">
              Meta: {done} de {goal} {MODES[mode].items}
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${Math.min(100, (done / goal) * 100)}%` }} />
            </div>
          </>
        ) : (
          <p className="text-xs text-muted">Resumen, meta del año y para compartir</p>
        )}
      </div>
      <ChevronRight size={18} className="shrink-0 text-muted" />
    </Link>
  );
}
