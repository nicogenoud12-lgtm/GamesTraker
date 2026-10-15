import type { Rating } from './types';

/** Year and month a title counts for: when it was finished, or rated if no date was set. */
export function whenRated(r: Rating): { year: number; month: number } {
  if (r.finishedAt) return { year: Number(r.finishedAt.slice(0, 4)), month: Number(r.finishedAt.slice(5, 7)) - 1 };
  const d = new Date(r.createdAt);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function topCounts(values: string[], limit = 6): { label: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}
