import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import Sheet from './Sheet';
import ListIcon from './ListIcon';
import type { Game } from '../lib/types';
import { useStore } from '../store/useStore';
import { useToast } from '../store/useToast';

interface Props {
  game: Game;
  open: boolean;
  onClose: () => void;
}

export default function ListPickerSheet({ game, open, onClose }: Props) {
  const lists = useStore((s) => s.lists);
  const addToList = useStore((s) => s.addToList);
  const removeFromList = useStore((s) => s.removeFromList);
  const createList = useStore((s) => s.createList);
  const toast = useToast((s) => s.show);
  const [newName, setNewName] = useState('');

  const toggle = (listId: string, name: string, inList: boolean) => {
    if (inList) {
      removeFromList(listId, game.id);
      toast(`Quitado de ${name}`);
    } else {
      addToList(listId, game);
      toast(`Agregado a ${name}`);
    }
  };

  const create = () => {
    const name = newName.trim();
    if (!name) return;
    const id = createList(name, 'bookmark');
    addToList(id, game);
    setNewName('');
    toast(`Agregado a ${name}`);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Agregar a lista">
      <ul className="space-y-2">
        {lists.map((l) => {
          const inList = l.gameIds.includes(game.id);
          return (
            <li key={l.id}>
              <button
                onClick={() => toggle(l.id, l.name, inList)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${inList ? 'border-accent/60 bg-accent/10' : 'border-line bg-surface-2'}`}
              >
                <ListIcon list={l} size="sm" />
                <span className="flex-1">
                  <span className="block font-semibold">{l.name}</span>
                  <span className="text-xs text-muted">
                    {l.gameIds.length} {l.gameIds.length === 1 ? 'juego' : 'juegos'}
                  </span>
                </span>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${inList ? 'bg-accent text-black' : 'border border-line'}`}
                >
                  {inList && <Check size={14} strokeWidth={3} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nueva lista…"
          className="flex-1 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm placeholder:text-muted/60"
        />
        <button type="submit" aria-label="Crear lista" className="rounded-2xl bg-white/10 px-4 disabled:opacity-40" disabled={!newName.trim()}>
          <Plus size={20} />
        </button>
      </form>
    </Sheet>
  );
}
