import { Link } from 'react-router-dom';
import { Film, Star, Tv, X } from 'lucide-react';
import { dismissToRate, useTrakt, type ToRate } from '../lib/trakt';
import { useStore } from '../store/useStore';

// A selector must return the same value when nothing changed: a fresh `[]` on every
// read makes React re-render forever (error #185), so the empty case is one shared array.
const NONE: ToRate[] = [];

/** "Terminaste esto en Nuvio, ¿lo puntuás?" — what Trakt saw finished and isn't rated yet. */
export default function ToRateCard({ className = '' }: { className?: string }) {
  const pending = useTrakt((s) => s.status?.pending ?? NONE);
  const ratings = useStore((s) => s.ratings);
  const items = pending.filter((p) => !ratings[p.id]);
  if (!items.length) return null;
  return (
    <section className={`rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/15 to-accent-2/5 p-4 ${className}`}>
      <p className="flex items-center gap-2 font-display font-bold">
        <Star size={18} className="text-accent" fill="currentColor" /> Para puntuar
      </p>
      <p className="text-xs text-muted">Lo terminaste en Nuvio.</p>
      <ul className="mt-3 space-y-2">
        {items.slice(0, 5).map((p) => {
          const Icon = p.kind === 'tv' ? Tv : Film;
          return (
            <li key={p.key} className="flex items-center gap-3 rounded-2xl bg-black/25 p-2.5 pl-3">
              <Icon size={18} className="shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.title}</p>
                <p className="text-xs text-muted">
                  {p.kind === 'tv' ? 'Serie completa' : 'Película'}
                  {p.year ? ` · ${p.year}` : ''}
                </p>
              </div>
              <Link
                to={`/juego/${encodeURIComponent(p.id)}?puntuar=1`}
                className="rounded-full bg-gradient-to-r from-accent to-accent-2 px-3.5 py-1.5 text-xs font-bold text-black"
              >
                Puntuar
              </Link>
              <button aria-label={`Descartar ${p.title}`} onClick={() => void dismissToRate(p.key)} className="rounded-full p-1.5 text-muted hover:text-white">
                <X size={16} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
