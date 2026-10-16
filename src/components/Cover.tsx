import { useState, type CSSProperties } from 'react';
import { resizeImage } from '../lib/rawg';
import { useGameCover } from '../lib/covers';
import type { Game } from '../lib/types';

interface Props {
  /** With its id (and release date), a RAWG game shows IGDB's box art. */
  game: Pick<Game, 'name' | 'cover'> & { id?: string; released?: string | null };
  size?: 420 | 640 | 1280;
  className?: string;
  /** Show the title over generated covers. */
  showTitle?: boolean;
  style?: CSSProperties;
}

export default function Cover({ game, size = 420, className = '', showTitle = true, style }: Props) {
  const { cover, waiting } = useGameCover(game);
  // URLs that failed to load: if IGDB's does, RAWG's still gets a try.
  const [failed, setFailed] = useState<string[]>([]);
  // While IGDB's is looked up, nothing: RAWG's would flash and be swapped.
  const usable = waiting ? null : ([cover, game.cover].find((u) => u && !failed.includes(u)) ?? null);
  const generated = !waiting && (!usable || usable.startsWith('data:'));
  const src = usable ? (usable.startsWith('data:') ? usable : resizeImage(usable, size)) : null;

  return (
    <div
      data-cover
      className={`${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative'} overflow-hidden bg-surface-2 ${className}`}
      style={style}
    >
      {src ? (
        <img
          src={src}
          alt={game.name}
          loading="lazy"
          onError={() => setFailed((f) => [...f, usable!])}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : waiting ? (
        <div className="absolute inset-0 animate-pulse bg-white/5" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-accent/40 via-surface-2 to-accent-2/30" />
      )}
      {generated && showTitle && (
        <div className="absolute inset-0 flex items-end p-2">
          <span className="font-display text-[0.8em] leading-tight font-bold text-white drop-shadow line-clamp-4">
            {game.name}
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10" />
    </div>
  );
}
