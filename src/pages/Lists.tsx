import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Cover from '../components/Cover';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import ListIcon, { LIST_ICONS, ListGlyph } from '../components/ListIcon';
import CircularCarousel from '../components/reactbits/CircularCarousel';
import { resizeImage } from '../lib/rawg';
import { useIsDesktop } from '../lib/useMedia';
import type { Game, GameList } from '../lib/types';
import { useStore } from '../store/useStore';
import { useMode } from '../store/useUi';
import { MODES, listMode, type Mode } from '../lib/mode';

const SCREEN_ICONS = ['film', 'tv', 'popcorn', 'clapperboard', 'laugh', 'drama'];
/** Each mode shows its own themed icons first. */
const iconIds = (mode: Mode) => {
  const all = Object.keys(LIST_ICONS);
  return mode === 'screen' ? [...SCREEN_ICONS, ...all.filter((i) => !SCREEN_ICONS.includes(i))] : all.filter((i) => !SCREEN_ICONS.includes(i)).concat(SCREEN_ICONS);
};

export default function Lists() {
  const mode = useMode();
  const ICON_IDS = iconIds(mode);
  const lists = useStore((s) => s.lists).filter((l) => listMode(l) === mode);
  const games = useStore((s) => s.games);
  const createList = useStore((s) => s.createList);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICON_IDS[0]);

  const create = () => {
    if (!name.trim()) return;
    createList(name.trim(), icon, mode);
    setName('');
    setIcon(ICON_IDS[0]);
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Listas"
        subtitle={MODES[mode].label}
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
    .slice(0, 10)
    .map(coverSrc)
    .filter((c): c is string => Boolean(c));
  // A ring needs a few cards to look round; short lists repeat their covers.
  const ring = covers.length ? Array.from({ length: Math.max(covers.length, 7) }, (_, i) => ({ src: covers[i % covers.length] })) : [];
  const isDesktop = useIsDesktop();
  // Narrower on phones so the list name still fits.
  const fan = isDesktop ? { width: 280, card: 96 } : { width: 150, card: 74 };
  const copy = MODES[listMode(list)];
  const hint =
    lead && list.id === copy.nextListId
      ? `Siguiente: ${lead.name}`
      : lead && list.id === copy.nowListId
        ? `${copy.doingActive}: ${lead.name}`
        : null;

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
            {items.length === 0 ? 'Vacía' : `${items.length} ${items.length === 1 ? copy.item : copy.items}`}
          </p>
          {hint && <p className="mt-2 truncate text-xs font-semibold text-accent">{hint}</p>}
        </div>
        <div className="flex shrink-0 items-center justify-center" style={{ width: fan.width }}>
          {ring.length > 0 ? (
            // Just a slowly turning showcase: no drag or clicks, so tapping anywhere opens the list.
            <div className="pointer-events-none h-full w-full">
              <CircularCarousel
                key={covers.join('|')}
                items={ring}
                preset="cylinder"
                intro="rise"
                cardWidth={fan.card}
                aspectRatio={3 / 4}
                gap={12}
                speed={8}
                draggable={false}
                focusOnClick={false}
                pauseOnHover={false}
                depthFade={0.5}
                fadeColor="#0b0b10"
                innerShade={0.5}
                cornerRadius={14}
              />
            </div>
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
