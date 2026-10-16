import {
  Bookmark,
  Clapperboard,
  Drama,
  Film,
  Laugh,
  MonitorPlay,
  Popcorn,
  Tv,
  CarFront,
  Crown,
  Flame,
  Gamepad2,
  Ghost,
  Heart,
  Joystick,
  Layers,
  Mountain,
  Puzzle,
  Rocket,
  Skull,
  Sparkles,
  Star,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { GameList } from '../lib/types';
import { NEXT_LIST_ID, PLAYING_LIST_ID, TOWATCH_LIST_ID, WATCHING_LIST_ID } from '../lib/mode';

interface IconDef {
  icon: LucideIcon;
  label: string;
  from: string;
  to: string;
}

/** Icons people can pick for their own lists, stored by id in `GameList.emoji`. */
export const LIST_ICONS: Record<string, IconDef> = {
  bookmark: { icon: Bookmark, label: 'Guardados', from: '#6366f1', to: '#8b5cf6' },
  trophy: { icon: Trophy, label: 'Trofeos', from: '#f59e0b', to: '#ea580c' },
  star: { icon: Star, label: 'Favoritos', from: '#facc15', to: '#f59e0b' },
  heart: { icon: Heart, label: 'Amor', from: '#f43f5e', to: '#ec4899' },
  swords: { icon: Swords, label: 'Acción', from: '#ef4444', to: '#f97316' },
  ghost: { icon: Ghost, label: 'Terror', from: '#7c3aed', to: '#4f46e5' },
  skull: { icon: Skull, label: 'Difíciles', from: '#52525b', to: '#27272a' },
  rocket: { icon: Rocket, label: 'Sci-fi', from: '#0ea5e9', to: '#6366f1' },
  mountain: { icon: Mountain, label: 'Mundo abierto', from: '#10b981', to: '#0d9488' },
  puzzle: { icon: Puzzle, label: 'Puzzle', from: '#14b8a6', to: '#06b6d4' },
  car: { icon: CarFront, label: 'Carreras', from: '#06b6d4', to: '#2563eb' },
  users: { icon: Users, label: 'Con amigos', from: '#84cc16', to: '#16a34a' },
  joystick: { icon: Joystick, label: 'Retro', from: '#d946ef', to: '#9333ea' },
  crown: { icon: Crown, label: 'Clásicos', from: '#eab308', to: '#ca8a04' },
  flame: { icon: Flame, label: 'Hype', from: '#fb923c', to: '#dc2626' },
  sparkles: { icon: Sparkles, label: 'Joyitas', from: '#c084fc', to: '#ec4899' },
  film: { icon: Film, label: 'Películas', from: '#f59e0b', to: '#ef4444' },
  tv: { icon: Tv, label: 'Series', from: '#38bdf8', to: '#6366f1' },
  popcorn: { icon: Popcorn, label: 'Para el finde', from: '#fbbf24', to: '#fb7185' },
  clapperboard: { icon: Clapperboard, label: 'Cine', from: '#71717a', to: '#18181b' },
  laugh: { icon: Laugh, label: 'Comedia', from: '#facc15', to: '#84cc16' },
  drama: { icon: Drama, label: 'Drama', from: '#a855f7', to: '#e11d48' },
};

const SYSTEM: Record<string, IconDef> = {
  [PLAYING_LIST_ID]: { icon: Gamepad2, label: 'Jugando ahora', from: '#22c55e', to: '#0d9488' },
  [NEXT_LIST_ID]: { icon: Layers, label: 'Próximos a jugar', from: '#8b5cf6', to: '#ec4899' },
  [WATCHING_LIST_ID]: { icon: MonitorPlay, label: 'Viendo ahora', from: '#f97316', to: '#e11d48' },
  [TOWATCH_LIST_ID]: { icon: Popcorn, label: 'Quiero ver', from: '#fbbf24', to: '#f97316' },
};

// Lists created before icons existed stored an emoji; map them to the closest icon.
const FROM_EMOJI: Record<string, string> = {
  '📁': 'bookmark', '⭐': 'star', '🏆': 'trophy', '🕹️': 'joystick', '👾': 'ghost', '🗡️': 'swords',
  '🚀': 'rocket', '🧩': 'puzzle', '👻': 'ghost', '🏎️': 'car', '⚽': 'trophy', '❤️': 'heart',
};

export function iconFor(list: Pick<GameList, 'id' | 'emoji'>): IconDef {
  return SYSTEM[list.id] ?? LIST_ICONS[list.emoji] ?? LIST_ICONS[FROM_EMOJI[list.emoji] ?? 'bookmark'];
}

const SIZES = { xs: { box: 24, icon: 13, radius: 8 }, sm: { box: 36, icon: 18, radius: 11 }, md: { box: 48, icon: 24, radius: 14 }, lg: { box: 56, icon: 28, radius: 17 } };

/** Gradient badge with the list's icon; "Jugando ahora" gets a live dot. */
export default function ListIcon({ list, size = 'md' }: { list: Pick<GameList, 'id' | 'emoji'>; size?: keyof typeof SIZES }) {
  const def = iconFor(list);
  const s = SIZES[size];
  const Icon = def.icon;
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center text-white"
      style={{
        width: s.box,
        height: s.box,
        borderRadius: s.radius,
        background: `linear-gradient(135deg, ${def.from}, ${def.to})`,
        boxShadow: `0 8px 20px -8px ${def.to}aa, inset 0 1px 0 rgba(255,255,255,.25)`,
      }}
      aria-hidden="true"
    >
      <Icon size={s.icon} strokeWidth={2.2} />
      {size !== 'xs' && (list.id === PLAYING_LIST_ID || list.id === WATCHING_LIST_ID) && (
        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-bg bg-emerald-300" />
        </span>
      )}
    </span>
  );
}

/** Just the icon, for large faint placeholders. */
export function ListGlyph({ list, size }: { list: Pick<GameList, 'id' | 'emoji'>; size: number }) {
  const Icon = iconFor(list).icon;
  return <Icon size={size} strokeWidth={1.5} />;
}
