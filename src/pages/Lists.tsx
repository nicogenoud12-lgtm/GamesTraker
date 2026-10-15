import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Cover from '../components/Cover';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import { useStore } from '../store/useStore';

const EMOJIS = ['📁', '⭐', '🏆', '🕹️', '👾', '🗡️', '🚀', '🧩', '👻', '🏎️', '⚽', '❤️'];

export default function Lists() {
  const lists = useStore((s) => s.lists);
  const games = useStore((s) => s.games);
  const createList = useStore((s) => s.createList);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);

  const create = () => {
    if (!name.trim()) return;
    createList(name.trim(), emoji);
    setName('');
    setEmoji(EMOJIS[0]);
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Listas"
        action={
          <button onClick={() => setOpen(true)} aria-label="Nueva lista" className="rounded-full bg-white p-2.5 text-black">
            <Plus size={20} />
          </button>
        }
      />
      <ul className="space-y-3 px-5">
        {lists.map((l) => {
          const covers = l.gameIds.slice(0, 4).map((id) => games[id]).filter(Boolean);
          return (
            <li key={l.id}>
              <Link to={`/listas/${l.id}`} className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-3 active:scale-[.99]">
                <div className="relative h-[84px] w-[110px] shrink-0">
                  {covers.length === 0 ? (
                    <div className="flex h-full w-full items-center justify-center rounded-2xl bg-surface-2 text-3xl">{l.emoji}</div>
                  ) : (
                    covers.map((g, i) => (
                      <Cover
                        key={g.id}
                        game={g}
                        showTitle={false}
                        className="absolute top-0 h-[84px] w-[63px] rounded-xl shadow-[-4px_0_12px_rgba(0,0,0,.55)]"
                        style={{ left: i * 15, zIndex: 10 - i }}
                      />
                    ))
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-bold">
                    <span className="mr-1.5">{l.emoji}</span>
                    {l.name}
                  </p>
                  <p className="text-sm text-muted">
                    {l.gameIds.length} {l.gameIds.length === 1 ? 'juego' : 'juegos'}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva lista"
        footer={
          <button
            onClick={create}
            disabled={!name.trim()}
            className="w-full rounded-2xl bg-white py-3.5 font-display font-bold text-black disabled:opacity-40"
          >
            Crear lista
          </button>
        }
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="Ej: Para jugar con amigos"
          autoFocus
          className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3.5 placeholder:text-muted/60"
        />
        <div className="mt-4 grid grid-cols-6 gap-2">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`rounded-2xl py-2.5 text-2xl ${emoji === e ? 'bg-accent/20 ring-2 ring-accent' : 'bg-surface-2'}`}
            >
              {e}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
