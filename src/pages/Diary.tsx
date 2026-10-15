import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Flag, Play, Repeat2, Trash2 } from 'lucide-react';
import Cover from '../components/Cover';
import { ScoreBadge } from '../components/Score';
import { byMonth, diaryEntries, type DiaryEntry, type DiaryKind } from '../lib/diary';
import { MODES } from '../lib/mode';
import { MONTH_NAMES } from '../lib/stats';
import { useStore } from '../store/useStore';
import { useToast } from '../store/useToast';
import { useMode } from '../store/useUi';

const PAGE = 120;

const ICON: Record<DiaryKind, typeof Flag> = { rated: Flag, again: Repeat2, started: Play };
const TONE: Record<DiaryKind, string> = { rated: 'text-accent', again: 'text-sky-300', started: 'text-emerald-300' };

/** Letterboxd-style diary: what was finished, replayed or started, by day. */
export default function Diary() {
  const navigate = useNavigate();
  const mode = useMode();
  const copy = MODES[mode];
  const games = useStore((s) => s.games);
  const ratings = useStore((s) => s.ratings);
  const logs = useStore((s) => s.logs);
  const starts = useStore((s) => s.starts);
  const lists = useStore((s) => s.lists);
  const [filter, setFilter] = useState<DiaryKind | 'all'>('all');
  const [shown, setShown] = useState(PAGE);

  const all = useMemo(() => diaryEntries({ games, ratings, logs, starts, lists }, mode), [games, ratings, logs, starts, lists, mode]);
  const count = (k: DiaryKind) => all.filter((e) => e.kind === k).length;
  const entries = filter === 'all' ? all : all.filter((e) => e.kind === filter);
  const months = byMonth(entries.slice(0, shown));

  const filters: { id: DiaryKind | 'all'; label: string; n: number }[] = [
    { id: 'all', label: 'Todo', n: all.length },
    { id: 'rated', label: mode === 'games' ? 'Terminados' : 'Vistos', n: count('rated') },
    { id: 'again', label: mode === 'games' ? 'Rejugados' : 'Revistos', n: count('again') },
    { id: 'started', label: 'Empezados', n: count('started') },
  ];

  return (
    <div className="pb-8">
      <header className="pt-safe px-5 lg:px-0 lg:pt-8">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="mt-4 rounded-full bg-white/5 p-2.5 lg:hidden">
          <ArrowLeft size={20} />
        </button>
        <p className="mt-4 text-sm text-muted">{copy.label}</p>
        <h1 className="font-display text-4xl font-bold tracking-tight lg:text-5xl">Diario</h1>
        <p className="mt-1 text-sm text-muted">
          Lo que {mode === 'games' ? 'jugaste' : 'viste'}, día por día. Para sumar una vuelta, entrá a la ficha y tocá “
          {mode === 'games' ? 'Lo volví a jugar' : 'La volví a ver'}”.
        </p>
      </header>

      {all.length > 0 && (
        <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto px-5 lg:px-0" role="tablist">
          {filters.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                setShown(PAGE);
              }}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${filter === f.id ? 'border-accent bg-accent/20 text-accent' : 'border-line text-muted hover:border-white/20 hover:text-white'}`}
            >
              {f.label} <span className="tabular-nums opacity-70">{f.n}</span>
            </button>
          ))}
        </div>
      )}

      {all.length === 0 ? (
        <div className="mx-5 mt-8 rounded-3xl border border-dashed border-line p-8 text-center text-muted lg:mx-0">
          <p>Todavía no hay nada en tu diario.</p>
          <Link to="/buscar" className="mt-3 inline-block font-semibold text-accent">
            Buscá {mode === 'games' ? 'un juego' : 'algo'} para puntuar
          </Link>
        </div>
      ) : (
        <div className="mt-4 px-5 lg:px-0">
          {months.map(([month, items]) => (
            <section key={month} className="mt-4">
              <h2 className="sticky top-0 z-10 -mx-5 bg-bg/90 px-5 py-2 font-display text-sm font-bold tracking-wider text-muted uppercase backdrop-blur lg:mx-0 lg:px-0">
                {MONTH_NAMES[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
              </h2>
              <ul className="divide-y divide-white/5">
                {items.map((e, i) => (
                  <Row key={e.key} entry={e} showDay={i === 0 || items[i - 1].date !== e.date} />
                ))}
              </ul>
            </section>
          ))}
          {entries.length > shown && (
            <button
              onClick={() => setShown(shown + PAGE)}
              className="mt-4 w-full rounded-2xl border border-line py-3 text-sm font-semibold text-muted hover:text-white"
            >
              Ver más
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ entry: e, showDay }: { entry: DiaryEntry; showDay: boolean }) {
  const deleteLog = useStore((s) => s.deleteLog);
  const toast = useToast((s) => s.show);
  const Icon = ICON[e.kind];
  const day = new Date(`${e.date}T12:00:00`);
  const href = `/juego/${encodeURIComponent(e.game.id)}`;
  const note = e.kind === 'again' ? e.log?.note : e.kind === 'rated' ? e.rating?.note : '';

  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className={`w-10 shrink-0 text-center leading-none ${showDay ? '' : 'invisible'}`}>
        <span className="block text-[11px] text-muted uppercase">{day.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')}</span>
        <span className="mt-0.5 block font-display text-2xl font-bold tabular-nums">{day.getDate()}</span>
      </div>
      <Link to={href} className="shrink-0">
        <Cover game={e.game} className="aspect-[3/4] w-11 rounded-lg" showTitle={false} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={href} className="block truncate font-semibold hover:underline">
          {e.game.name}
        </Link>
        <p className={`flex items-center gap-1.5 text-xs ${TONE[e.kind]}`}>
          <Icon size={13} className="shrink-0" /> {e.label}
        </p>
        {note && <p className="truncate text-xs text-muted">“{note}”</p>}
      </div>
      {e.kind === 'rated' && e.rating && <ScoreBadge score={e.rating.score} />}
      {e.kind === 'again' && e.log && (
        <button
          aria-label="Borrar esta vuelta"
          onClick={() => {
            deleteLog(e.log!.id);
            toast('Vuelta borrada');
          }}
          className="rounded-full p-2 text-muted transition hover:bg-white/5 hover:text-white"
        >
          <Trash2 size={16} />
        </button>
      )}
    </li>
  );
}
