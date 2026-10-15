import type { PlayStatus, TierId } from './types';

export interface Tier {
  id: TierId;
  label: string;
  emoji: string;
  /** Lowest score that maps to this tier by default. */
  min: number;
  color: string;
}

export const TIERS: Tier[] = [
  { id: 'malo', label: 'Malo', emoji: '💀', min: 0, color: '#f43f5e' },
  { id: 'aburrido', label: 'Aburrido', emoji: '😴', min: 35, color: '#ff8a3d' },
  { id: 'safa', label: 'Safa', emoji: '🤷', min: 50, color: '#facc15' },
  { id: 'bueno', label: 'Bueno', emoji: '👍', min: 65, color: '#4ade80' },
  { id: 'buenisimo', label: 'Buenísimo', emoji: '🔥', min: 80, color: '#22d3ee' },
  { id: 'historico', label: 'Histórico', emoji: '👑', min: 92, color: '#c084fc' },
];

export const TIER_BY_ID = Object.fromEntries(TIERS.map((t) => [t.id, t])) as Record<TierId, Tier>;

export function tierForScore(score: number): Tier {
  let found = TIERS[0];
  for (const t of TIERS) if (score >= t.min) found = t;
  return found;
}

/** Color for a 0–100 score, taken from the tier it falls in. */
export function scoreColor(score: number): string {
  return tierForScore(score).color;
}

export const STATUSES: { id: PlayStatus; label: string }[] = [
  { id: 'terminado', label: 'Terminado' },
  { id: 'completado', label: '100%' },
  { id: 'abandonado', label: 'Abandonado' },
];
