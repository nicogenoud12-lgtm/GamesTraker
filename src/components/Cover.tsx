import { useState, type CSSProperties } from 'react';
import { resizeImage } from '../lib/rawg';
import type { Game } from '../lib/types';

interface Props {
  game: Pick<Game, 'name' | 'cover'>;
  size?: 420 | 640 | 1280;
  className?: string;
  /** Show the title over generated covers. */
  showTitle?: boolean;
  style?: CSSProperties;
}

export default function Cover({ game, size = 420, className = '', showTitle = true, style }: Props) {
  const [failed, setFailed] = useState(false);
  const generated = !game.cover || game.cover.startsWith('data:') || failed;
  const src = !failed && game.cover ? (game.cover.startsWith('data:') ? game.cover : resizeImage(game.cover, size)) : null;

  return (
    <div
      className={`${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative'} overflow-hidden bg-surface-2 ${className}`}
      style={style}
    >
      {src ? (
        <img
          src={src}
          alt={game.name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
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
