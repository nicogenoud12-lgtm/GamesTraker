import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Cover from '../components/Cover';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import ListIcon, { LIST_ICONS, ListGlyph } from '../components/ListIcon';
import BounceCards from '../components/reactbits/BounceCards';
import { resizeImage } from '../lib/rawg';
import { useIsDesktop } from '../lib/useMedia';
import type { Game, GameList } from '../lib/types';
import { NEXT_LIST_ID, PLAYING_LIST_ID, useStore } from '../store/useStore';

const ICON_IDS = Object.keys(LIST_ICONS);

export default function Lists() {
  const lists = useStore((s) => s.lists);
  const games = useStore((s) => s.games);
  const createList = useStore((s) => s.createList);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICON_IDS[0]);

  const create = () => {
    if (!name.trim()) return;
    createList(name.trim(), icon);
    setName('');
    setIcon(ICON_IDS[0]);
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
      <ul className="space-y-3 px-5 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
        {lists.map((l) => (
          <li key={l.id}>
            <ListCard list={l} games={games} />
          </li>
        ))}
        <li>
          <button
            onClick={() => setOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-line py-5 text-sm font-semibold text-muted"
          >
            <Plus size={18} /> Nueva lista
          </button>
        </li>
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
        <p className="mt-5 mb-2 text-sm font-semibold">Ícono</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {ICON_IDS.map((id) => (
            <button
              key={id}
              onClick={() => setIcon(id)}
              aria-label={LIST_ICONS[id].label}
              title={LIST_ICONS[id].label}
              className={`flex flex-col items-center gap-1.5 rounded-2xl py-2.5 transition ${icon === id ? 'bg-white/10 ring-2 ring-accent' : 'hover:bg-white/5'}`}
            >
              <ListIcon list={{ id: '', emoji: id }} size="sm" />
              <span className="text-[10px] text-muted">{LIST_ICONS[id].label}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function coverSrc(g: Game): string | null {
  if (!g.cover) return null;
  return g.cover.startsWith('data:') ? g.cover : resizeImage(g.cover, 420);
}

function ListCard({ list, games }: { list: GameList; games: Record<string, Game> }) {
  const items = list.gameIds.map((id) => games[id]).filter(Boolean);
  const lead = items[0];
  const covers = items
    .slice(0, 5)
    .map(coverSrc)
    .filter((c): c is string => Boolean(c));
  const isDesktop = useIsDesktop();
  // Narrower fan on phones so the list name fits on one line.
  const fan = isDesktop ? { width: 168, card: 86, spread: 20 } : { width: 140, card: 74, spread: 16 };
  const hint =
    lead && list.id === NEXT_LIST_ID ? `Siguiente: ${lead.name}` : lead && list.id === PLAYING_LIST_ID ? `Jugando: ${lead.name}` : null;

  return (
    <Link
      to={`/listas/${list.id}`}
      className="relative block h-52 overflow-hidden rounded-3xl border border-line bg-surface transition active:scale-[.99]"
    >
      {lead && <Cover game={lead} size={640} showTitle={false} className="absolute inset-0 scale-125 opacity-45 blur-2xl" />}
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-bg/10" />
      <div className="relative flex h-full">
        <div className="flex min-w-0 flex-1 flex-col justify-end p-5">
          <ListIcon list={list} size="md" />
          <h2 className="mt-3 line-clamp-2 font-display text-xl leading-tight font-bold lg:text-2xl">{list.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {items.length === 0 ? 'Vacía' : `${items.length} ${items.length === 1 ? 'juego' : 'juegos'}`}
          </p>
          {hint && <p className="mt-2 truncate text-xs font-semibold text-accent">{hint}</p>}
        </div>
        <div className="flex shrink-0 items-center justify-center pr-2" style={{ width: fan.width }}>
          {covers.length > 0 ? (
            <BounceCards
              images={covers}
              containerWidth={fan.width}
              containerHeight={190}
              cardSize={fan.card}
              spread={covers.length > 3 ? fan.spread : fan.spread + 6}
              rotation={8}
              arc={8}
              radius={16}
              borderWidth={2}
              borderColor="rgba(255,255,255,0.18)"
              animationDelay={0.1}
            />
          ) : (
            <span className="text-white/15">
              <ListGlyph list={list} size={72} />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
