import { Film, Layers, Tv } from 'lucide-react';
import type { ScreenKind } from './mode';

/** Series & movies can be shown together or one kind at a time (?tipo=pelis|series). */
export const KINDS: { id: string | null; kind: ScreenKind | null; label: string; icon: typeof Film }[] = [
  { id: null, kind: null, label: 'Todo', icon: Layers },
  { id: 'pelis', kind: 'movie', label: 'Películas', icon: Film },
  { id: 'series', kind: 'tv', label: 'Series', icon: Tv },
];
