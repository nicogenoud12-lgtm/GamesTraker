import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, GripVertical, MoreHorizontal, Plus, Trash2, X } from 'lucide-react';
import Cover from '../components/Cover';
import ListIcon, { LIST_ICONS, iconFor } from '../components/ListIcon';
import { ScoreBadge } from '../components/Score';
import Sheet from '../components/Sheet';
import { formatDate, playingDay, year } from '../lib/format';
import type { Game } from '../lib/types';
import { useStore } from '../store/useStore';
import { MODES, listMode } from '../lib/mode';

export default function ListDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const list = useStore((s) => s.lists.find((l) => l.id === id));
  const games = useStore((s) => s.games);
  const ratings = useStore((s) => s.ratings);
  const starts = useStore((s) => s.starts);
  const reorderList = useStore((s) => s.reorderList);
  const removeFromList = useStore((s) => s.removeFromList);
  const updateList = useStore((s) => s.updateList);
  const deleteList = useStore((s) => s.deleteList);
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!list) {
    return (
      <div className="pt-safe p-8 text-center text-muted">
        Lista no encontrada.{' '}
        <Link to="/listas" className="text-accent">
          Volver
        </Link>
      </div>
    );
  }

  const items = list.gameIds.map((gid) => games[gid]).filter(Boolean);
  const copy = MODES[listMode(list)];
  const ranked = list.id === copy.nextListId;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = list.gameIds.indexOf(String(active.id));
    const to = list.gameIds.indexOf(String(over.id));
    reorderList(list.id, arrayMove(list.gameIds, from, to));
  };

  return (
    <div>
      <header className="pt-safe sticky top-0 z-30 bg-bg/85 px-4 backdrop-blur-xl lg:pt-6">
        <div className="flex items-center justify-between pt-4 pb-2">
          <button onClick={() => navigate('/listas')} aria-label="Volver" className="rounded-full bg-white/5 p-2.5">
            <ArrowLeft size={20} />
          </button>
          {!list.system && (
            <button
              onClick={() => {
                setName(list.name);
                setMenuOpen(true);
              }}
              aria-label="Opciones de la lista"
              className="rounded-full bg-white/5 p-2.5"
            >
              <MoreHorizontal size={20} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 px-1 pb-3">
          <ListIcon list={list} size="lg" />
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {list.name}
            </h1>
            <p className="text-sm text-muted">
              {items.length} {items.length === 1 ? copy.item : copy.items}
              {items.length > 1 && ' · Mantené apretado y arrastrá para ordenar'}
            </p>
          </div>
        </div>
      </header>

      <div className="px-4">
        {items.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-muted">Esta lista está vacía.</p>
            <Link to="/buscar" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-black">
              <Plus size={18} /> Agregar {copy.items}
            </Link>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
            <SortableContext items={list.gameIds} strategy={verticalListSortingStrategy}>
              <ol className="space-y-2">
                {items.map((g, i) => (
                  <SortableItem
                    key={g.id}
                    game={g}
                    index={i}
                    ranked={ranked}
                    started={list.id === copy.nowListId ? starts[g.id] : undefined}
                    score={ratings[g.id]?.score}
                    onRemove={() => removeFromList(list.id, g.id)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
        {items.length > 0 && (
          <Link
            to="/buscar"
            className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-3.5 text-sm text-muted"
          >
            <Plus size={16} /> Agregar {copy.items}
          </Link>
        )}
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Editar lista">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3.5"
        />
        <div className="mt-3 grid grid-cols-8 gap-1.5">
          {Object.keys(LIST_ICONS).map((id) => (
            <button
              key={id}
              onClick={() => updateList(list.id, { emoji: id })}
              aria-label={LIST_ICONS[id].label}
              title={LIST_ICONS[id].label}
              className={`flex justify-center rounded-xl py-1.5 transition ${iconFor(list) === LIST_ICONS[id] ? 'bg-white/10 ring-2 ring-accent' : 'hover:bg-white/5'}`}
            >
              <ListIcon list={{ id: '', emoji: id }} size="sm" />
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            if (name.trim()) updateList(list.id, { name: name.trim() });
            setMenuOpen(false);
          }}
          className="mt-3 w-full rounded-2xl bg-white py-3.5 font-bold text-black"
        >
          Guardar
        </button>
        <button
          onClick={() => {
            if (confirm(`¿Borrar la lista “${list.name}”?`)) {
              deleteList(list.id);
              navigate('/listas');
            }
          }}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500/10 py-3.5 font-semibold text-rose-400"
        >
          <Trash2 size={18} /> Borrar lista
        </button>
      </Sheet>
    </div>
  );
}

interface ItemProps {
  game: Game;
  index: number;
  ranked: boolean;
  /** Start date, shown for games in "Jugando ahora". */
  started?: string;
  score: number | undefined;
  onRemove: () => void;
}

function SortableItem({ game, index, ranked, started, score, onRemove }: ItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: game.id });
  const first = ranked && index === 0;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative flex items-center gap-3 rounded-2xl border p-2 pr-1 ${isDragging ? 'z-10 scale-[1.02] border-accent/60 bg-surface-2 shadow-2xl' : first ? 'border-accent/40 bg-accent/10' : 'border-line bg-surface'}`}
    >
      <span
        className={`w-7 shrink-0 text-center font-display font-bold tabular-nums ${first ? 'text-xl text-accent' : 'text-muted'}`}
      >
        {index + 1}
      </span>
      <Link to={`/juego/${encodeURIComponent(game.id)}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Cover game={game} showTitle={false} className="h-16 w-12 shrink-0 rounded-lg" />
        <div className="min-w-0">
          {first && <p className="text-[10px] font-bold tracking-widest text-accent uppercase">Siguiente</p>}
          <p className="truncate font-semibold">{game.name}</p>
          {started && (
            <p className="truncate text-xs text-emerald-300">
              {playingDay(started)} · desde {formatDate(started)}
            </p>
          )}
          <p className="truncate text-xs text-muted">{[year(game.released), game.genres[0]].filter(Boolean).join(' · ')}</p>
        </div>
      </Link>
      {score != null && <ScoreBadge score={score} />}
      <button onClick={onRemove} aria-label={`Quitar ${game.name}`} className="p-2 text-muted/70 hover:text-rose-400">
        <X size={18} />
      </button>
      <button
        {...attributes}
        {...listeners}
        aria-label={`Mover ${game.name}`}
        className="cursor-grab touch-none p-2 text-muted active:cursor-grabbing"
      >
        <GripVertical size={20} />
      </button>
    </li>
  );
}
