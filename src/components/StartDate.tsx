import { CalendarDays } from 'lucide-react';
import { localDay, playingDay } from '../lib/format';
import { useStore } from '../store/useStore';

/**
 * The day something in "Jugando/Viendo ahora" was started, editable: it is
 * set to the day it was added, but it may have been started earlier.
 */
export default function StartDate({ gameId, label, compact = false }: { gameId: string; label: string; compact?: boolean }) {
  const start = useStore((s) => s.starts[gameId]);
  const setStart = useStore((s) => s.setStart);
  const today = localDay();
  const input = (
    <input
      type="date"
      aria-label={label}
      value={start ?? ''}
      max={today}
      onChange={(e) => e.target.value && setStart(gameId, e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className={
        compact
          ? 'w-[7.25rem] shrink-0 rounded-md bg-transparent text-xs text-emerald-300 [color-scheme:dark] focus:bg-surface-2 focus:outline-none'
          : 'w-[9.5rem] shrink-0 rounded-lg border border-line bg-surface-2 px-2 py-1 text-sm [color-scheme:dark]'
      }
    />
  );
  if (compact) {
    return (
      <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-emerald-300">
        {start && <span className="whitespace-nowrap">{playingDay(start)} · desde</span>}
        {input}
      </span>
    );
  }
  return (
    <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5">
      <span className="flex min-w-0 items-center gap-2.5">
        <CalendarDays size={18} className="shrink-0 text-accent" />
        <span className="min-w-0 leading-tight">
          <span className="block text-sm whitespace-nowrap text-muted">{label}</span>
          {start && <span className="block text-xs whitespace-nowrap text-emerald-300">{playingDay(start)}</span>}
        </span>
      </span>
      {input}
    </div>
  );
}
