import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Repeat2, Trash2 } from 'lucide-react';
import Sheet from './Sheet';
import { againLabel, ratedDay } from '../lib/diary';
import { formatDate, localDay } from '../lib/format';
import { modeOf } from '../lib/mode';
import type { Game } from '../lib/types';
import { useStore } from '../store/useStore';
import { useToast } from '../store/useToast';

/** Sheet to log another playthrough / rewatch of a title, for the diary. */
export function AgainSheet({ open, onClose, game }: { open: boolean; onClose: () => void; game: Game }) {
  const addLog = useStore((s) => s.addLog);
  const toast = useToast((s) => s.show);
  const [date, setDate] = useState(localDay());
  const [note, setNote] = useState('');
  const mode = modeOf(game.id);

  useEffect(() => {
    if (!open) return;
    setDate(localDay());
    setNote('');
  }, [open]);

  const save = () => {
    addLog(game, date || localDay(), note.trim());
    toast('Sumado a tu diario');
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={againLabel(mode)}
      footer={
        <button
          onClick={save}
          className="w-full rounded-2xl bg-gradient-to-r from-accent to-accent-2 py-3.5 font-display text-base font-bold text-black transition active:scale-[.98]"
        >
          Guardar en el diario
        </button>
      }
    >
      <p className="mb-4 truncate text-sm text-muted">{game.name}</p>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">{mode === 'games' ? 'Lo terminé otra vez el' : 'La vi otra vez el'}</span>
        <input
          type="date"
          value={date}
          max={localDay()}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm [color-scheme:dark]"
        />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold">
          Nota <span className="font-normal text-muted">(opcional)</span>
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder={mode === 'games' ? '¿Cómo fue esta vez?' : '¿Qué tal la segunda vuelta?'}
          className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted/60"
        />
      </label>
      <p className="mt-3 text-xs text-muted">Tu puntaje no cambia; si querés, lo editás aparte.</p>
    </Sheet>
  );
}

/** Every time this title was finished: the first (its rating) and the replays. */
export function AgainHistory({ gameId }: { gameId: string }) {
  const rating = useStore((s) => s.ratings[gameId]);
  const allLogs = useStore((s) => s.logs);
  const deleteLog = useStore((s) => s.deleteLog);
  const toast = useToast((s) => s.show);
  const logs = useMemo(
    () => Object.values(allLogs).filter((l) => l.gameId === gameId).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [allLogs, gameId],
  );
  if (!logs.length) return null;
  const mode = modeOf(gameId);
  const times = logs.length + (rating ? 1 : 0);

  return (
    <section className="rounded-3xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Repeat2 size={16} className="text-sky-300" />
          {mode === 'games' ? `Lo jugaste ${times} veces` : `La viste ${times} veces`}
        </p>
        <Link to="/diario" className="text-xs font-semibold text-accent">
          Diario
        </Link>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {logs.map((l) => (
          <li key={l.id} className="flex items-center gap-2">
            <span className="shrink-0 text-white/80">{formatDate(l.date)}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted">{l.note && `“${l.note}”`}</span>
            <button
              aria-label={`Borrar la vuelta del ${formatDate(l.date)}`}
              onClick={() => {
                deleteLog(l.id);
                toast('Vuelta borrada');
              }}
              className="rounded-full p-1.5 text-muted hover:bg-white/5 hover:text-white"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {rating && (
          <li className="flex items-center gap-2 text-muted">
            <span className="shrink-0">{formatDate(ratedDay(rating))}</span>
            <span className="text-xs">· la primera vez</span>
          </li>
        )}
      </ul>
    </section>
  );
}
